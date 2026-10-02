/**
 * AgendaPro: la agenda real de la clínica (citas, estados, servicios, profesional). API v1 con
 * usuario y clave de integración (`AGENDAPRO_USUARIO`, `AGENDAPRO_CLAVE` en `.env`).
 *
 * Privacidad: de cada cita se guarda solo lo agregable (fecha, hora, estado, servicio, profesional,
 * sede, precio). Nunca la paciente: el bloque `client`, las notas y los comentarios se descartan
 * al leer. En `datos/agendapro.json` cada cita va por su id para poder actualizar su estado
 * (Reservado → Asiste); al lote entran solo conteos por día.
 *
 * La agenda manda en las citas: cuando hay AgendaPro, las citas que Kommo deducía de sus etapas
 * se reemplazan por las reales; Kommo sigue mandando en leads y ventas.
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { z } from "zod";
import { aFechaBogota } from "@/lib/format/fechas";
import { validarSinPII } from "@/lib/privacy";
import type { LoteDatos, RegistroEmbudo } from "./types";
import type { LoteKommo } from "./kommo";

export const API_AGENDAPRO = "https://api.agendapro.com/v1";
export const RUTA_AGENDAPRO = process.env.ORACULO_RUTA_AGENDAPRO ? resolve(process.env.ORACULO_RUTA_AGENDAPRO) : resolve(process.cwd(), "datos", "agendapro.json");

/** Estado de AgendaPro → paso del embudo. null = no cuenta (cancelada). Las demás cuentan como agendadas. */
export const PASO_DE_ESTADO: Record<string, "cita_agendada" | "cita_asistida" | null> = {
  Reservado: "cita_agendada",
  Confirmado: "cita_agendada",
  "En Espera": "cita_agendada",
  Pendiente: "cita_agendada",
  "No Asiste": "cita_agendada",
  Asiste: "cita_asistida",
  Cancelado: null,
};

export const CitaSchema = z.object({
  id: z.number(),
  fecha: z.string(),
  hora: z.number(),
  creada: z.string(),
  estado: z.string(),
  servicio: z.string().nullable(),
  profesional: z.string().nullable(),
  sede: z.string().nullable(),
  precio: z.number().nullable(),
});
export type Cita = z.infer<typeof CitaSchema>;

export const LoteAgendaSchema = z.object({
  citas: z.array(CitaSchema),
  meta: z.object({ capturadoEn: z.string(), desde: z.string(), hasta: z.string(), origen: z.literal("agendapro"), avisos: z.array(z.string()) }),
});
export type LoteAgenda = z.infer<typeof LoteAgendaSchema>;

const texto = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);
const horaBogota = (d: Date) => Number(new Intl.DateTimeFormat("en-US", { timeZone: "America/Bogota", hour: "numeric", hour12: false }).format(d)) % 24;

/** Una cita de la API → solo lo agregable. Lo que identifica a la paciente no se copia. */
export function citaDesdeApi(x: Record<string, unknown>): Cita {
  const inicio = new Date(String(x.start ?? x.start_time ?? ""));
  const precio = Number(x.price);
  return {
    id: Number(x.id),
    fecha: aFechaBogota(inicio),
    hora: horaBogota(inicio),
    creada: aFechaBogota(new Date(String(x.created_date ?? x.created_at ?? x.start))),
    estado: texto(x.status) ?? "Desconocido",
    servicio: texto(x.service),
    profesional: texto(x.service_provider),
    sede: texto(x.location),
    precio: Number.isFinite(precio) ? precio : null,
  };
}

/** Citas nuevas reemplazan a las viejas con el mismo id (el estado cambia: Reservado → Asiste). */
export function fusionarCitas(viejas: ReadonlyArray<Cita>, nuevas: ReadonlyArray<Cita>): Cita[] {
  const m = new Map(viejas.map((c) => [c.id, c]));
  for (const c of nuevas) m.set(c.id, c);
  return [...m.values()].sort((a, b) => a.fecha.localeCompare(b.fecha) || a.id - b.id);
}

/** Conteos por día × paso × servicio × sede. Solo hasta hoy (lo futuro es agenda, no resultado). */
export function agregarAgenda(citas: ReadonlyArray<Cita>, hoy: string): RegistroEmbudo[] {
  const m = new Map<string, RegistroEmbudo>();
  const sumar = (c: Cita, paso: "cita_agendada" | "cita_asistida", valor: number | null) => {
    const k = `${c.fecha}|${paso}|${c.servicio ?? ""}|${c.sede ?? ""}`;
    const r = m.get(k) ?? { fecha: c.fecha, campanaId: null, fuenteAtribuida: "desconocido", paso, cantidad: 0, valorCOP: null, servicio: c.servicio, sede: c.sede, nRegistros: 0 };
    r.cantidad += 1;
    r.nRegistros += 1;
    if (valor != null) r.valorCOP = (r.valorCOP ?? 0) + valor;
    m.set(k, r);
  };
  for (const c of citas) {
    if (c.fecha > hoy) continue;
    const paso = PASO_DE_ESTADO[c.estado] ?? (c.estado === "Cancelado" ? null : "cita_agendada");
    if (!paso) continue;
    sumar(c, "cita_agendada", null);
    if (paso === "cita_asistida") sumar(c, "cita_asistida", c.precio);
  }
  return [...m.values()].sort((a, b) => a.fecha.localeCompare(b.fecha));
}

export function parsearAgenda(contenido: string): LoteAgenda {
  const crudo: unknown = JSON.parse(contenido);
  validarSinPII(crudo);
  return LoteAgendaSchema.parse(crudo);
}

export function cargarAgenda(ruta: string = RUTA_AGENDAPRO): LoteAgenda | null {
  if (!existsSync(ruta)) return null;
  try {
    return parsearAgenda(readFileSync(ruta, "utf8"));
  } catch (e) {
    console.warn(`[oráculo] datos/agendapro.json no se pudo leer: ${e instanceof Error ? e.message : String(e)}`);
    return null;
  }
}

const esCita = (r: RegistroEmbudo) => r.paso === "cita_agendada" || r.paso === "cita_asistida";

/** Al lote: las citas reales de la agenda reemplazan las que venían de Kommo; lo demás queda igual. */
export function fusionarAgendaEnLote(lote: LoteDatos, agenda: LoteAgenda | null, hoy: string): LoteDatos {
  if (!agenda || !agenda.citas.length) return lote;
  return { ...lote, embudo: [...lote.embudo.filter((r) => !esCita(r)), ...agregarAgenda(agenda.citas, hoy)], meta: { ...lote.meta, advertencias: [...lote.meta.advertencias, ...agenda.meta.avisos] } };
}

/** Para la pantalla Pacientes: leads y ventas de Kommo + citas de la agenda. Sin Kommo, solo la agenda. */
export function combinarConKommo(kommo: LoteKommo | null, agenda: LoteAgenda | null, hoy: string): LoteKommo | null {
  if (!agenda || !agenda.citas.length) return kommo;
  const citas = agregarAgenda(agenda.citas, hoy);
  const aviso = "Citas y asistencia salen de AgendaPro (la agenda real); leads y ventas, de Kommo.";
  if (!kommo) return { etapas: [], embudo: citas, meta: { capturadoEn: agenda.meta.capturadoEn, desde: agenda.meta.desde, hasta: agenda.meta.hasta, origen: "kommo", leads: 0, avisos: [aviso, ...agenda.meta.avisos] } };
  return { ...kommo, embudo: [...kommo.embudo.filter((r) => !esCita(r)), ...citas], meta: { ...kommo.meta, avisos: [aviso, ...kommo.meta.avisos, ...agenda.meta.avisos] } };
}
