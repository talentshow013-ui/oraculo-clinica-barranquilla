/**
 * Agenda semanal de la clínica: lo que Meta no ve. Cinco números por semana (contactos
 * calificados, citas agendadas, citas asistidas, ventas, valor) que la coordinadora escribe en el
 * panel. Sin planillas, sin nombres: el esquema es estricto y no admite texto libre.
 *
 * - Se guarda en `datos/agenda.json` (fuera del repositorio).
 * - Cada semana se reparte en sus 7 días como registros del embudo, para que las ventanas de
 *   14 días del motor funcionen igual que con datos diarios.
 * - Lo manual manda: en una semana registrada, reemplaza los pasos de clínica que trajera la
 *   sincronización. Los pasos de pauta (impresión, clic, conversación) salen de los insights.
 */
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { z } from "zod";
import type { InsightRow, LoteDatos, RegistroEmbudo } from "@/lib/adapters/types";
import { diaSemana, rangoDias, sumarDias } from "@/lib/format/fechas";
import { razon } from "@/lib/metrics/core";

export const RUTA_AGENDA = resolve(process.cwd(), "datos", "agenda.json");

const FECHA = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const entero = z.number().int().min(0);

export const RegistroSemanalSchema = z
  .object({
    /** Lunes. */
    desde: FECHA,
    /** Domingo. */
    hasta: FECHA,
    contactosCalificados: entero,
    citasAgendadas: entero,
    citasAsistidas: entero,
    ventas: entero,
    valorVentasCOP: entero.nullable(),
    recompras: entero.nullable(),
    /** ISO con zona. */
    registradoEn: z.string().min(10),
  })
  .strict()
  .refine((s) => diaSemana(s.desde) === 1 && diaSemana(s.hasta) === 0 && sumarDias(s.desde, 6) === s.hasta, { message: "La semana va de lunes a domingo" })
  .refine((s) => s.citasAsistidas <= s.citasAgendadas, { message: "No pueden asistir más citas de las agendadas" })
  .refine((s) => s.ventas <= s.citasAsistidas, { message: "No puede haber más ventas que citas asistidas" });
export type RegistroSemanal = z.infer<typeof RegistroSemanalSchema>;

const ArchivoAgendaSchema = z.object({ semanas: z.array(RegistroSemanalSchema) }).strict();

export const tasaAsistencia = (s: RegistroSemanal): number | null => razon(s.citasAsistidas, s.citasAgendadas);
export const tasaCierre = (s: RegistroSemanal): number | null => razon(s.ventas, s.citasAsistidas);

// ---------------------------------------------------------------------------
// Semanas
// ---------------------------------------------------------------------------

export interface Semana {
  desde: string;
  hasta: string;
}

/** Lunes y domingo de la semana que contiene la fecha (Bogotá). */
export function semanaDe(fecha: string): Semana {
  const d = diaSemana(fecha); // 0 = domingo
  const desde = sumarDias(fecha, d === 0 ? -6 : -(d - 1));
  return { desde, hasta: sumarDias(desde, 6) };
}

/** Las últimas `n` semanas completas antes de `hoy` (la semana en curso no cuenta), reciente primero. */
export function semanasRecientes(hoy: string, n: number): Semana[] {
  const actual = semanaDe(hoy);
  const salida: Semana[] = [];
  let desde = sumarDias(actual.desde, -7);
  for (let i = 0; i < n; i++) {
    salida.push({ desde, hasta: sumarDias(desde, 6) });
    desde = sumarDias(desde, -7);
  }
  return salida;
}

// ---------------------------------------------------------------------------
// De la semana al embudo
// ---------------------------------------------------------------------------

const PASOS_CLINICA = new Set<RegistroEmbudo["paso"]>(["lead_calificado", "cita_agendada", "cita_asistida", "venta", "recompra"]);

/** Reparte `total` en `n` enteros que suman exactamente `total` (los primeros reciben el resto). */
function repartir(total: number, n: number): number[] {
  const base = Math.floor(total / n);
  const resto = total - base * n;
  return Array.from({ length: n }, (_, i) => base + (i < resto ? 1 : 0));
}

export function semanalAEmbudo(s: RegistroSemanal): RegistroEmbudo[] {
  const dias = rangoDias(s.desde, s.hasta);
  const salida: RegistroEmbudo[] = [];
  const emitir = (paso: RegistroEmbudo["paso"], total: number, valorTotal: number | null) => {
    const cantidades = repartir(total, dias.length);
    const valores = valorTotal === null ? null : total === 0 ? cantidades.map(() => 0) : repartirValor(valorTotal, cantidades);
    dias.forEach((fecha, i) => {
      salida.push({ fecha, campanaId: null, fuenteAtribuida: "meta", paso, cantidad: cantidades[i]!, valorCOP: valores ? valores[i]! : null, servicio: null, sede: null, nRegistros: cantidades[i]! });
    });
  };
  emitir("lead_calificado", s.contactosCalificados, null);
  emitir("cita_agendada", s.citasAgendadas, null);
  emitir("cita_asistida", s.citasAsistidas, null);
  emitir("venta", s.ventas, s.valorVentasCOP);
  if (s.recompras !== null) emitir("recompra", s.recompras, null);
  return salida;
}

/** Valor proporcional a las cantidades de cada día, en enteros que suman exactamente el total. */
function repartirValor(valorTotal: number, cantidades: number[]): number[] {
  const total = cantidades.reduce((a, b) => a + b, 0);
  const valores = cantidades.map((c) => Math.floor((valorTotal * c) / total));
  let resto = valorTotal - valores.reduce((a, b) => a + b, 0);
  for (let i = 0; resto > 0 && i < valores.length; i++) if (cantidades[i]! > 0) { valores[i]! += 1; resto -= 1; }
  return valores;
}

/** Impresión, clic y conversación diarios desde los insights (un solo nivel; campaña si existe). */
export function derivarPasosDePauta(insights: ReadonlyArray<InsightRow>): RegistroEmbudo[] {
  const campana = insights.filter((f) => f.nivel === "campana");
  const conjunto = insights.filter((f) => f.nivel === "conjunto");
  const anuncio = insights.filter((f) => f.nivel === "anuncio");
  const base = campana.length ? campana : conjunto.length ? conjunto : anuncio.length ? anuncio : [...insights];
  const salida: RegistroEmbudo[] = [];
  for (const f of base) {
    const campanaId = f.nivel === "campana" ? f.id : f.nivel === "conjunto" ? f.padreId : null;
    const reg = (paso: RegistroEmbudo["paso"], cantidad: number) =>
      salida.push({ fecha: f.fecha, campanaId, fuenteAtribuida: "meta", paso, cantidad, valorCOP: null, servicio: null, sede: null, nRegistros: cantidad });
    reg("impresion", f.impresiones);
    reg("clic", f.clicsEnlace);
    if (f.conversacionesIniciadas !== null) reg("conversacion", f.conversacionesIniciadas);
  }
  return salida;
}

/** Mezcla la agenda manual en el lote. Sin semanas, devuelve el mismo objeto. */
export function fusionarAgenda(lote: LoteDatos, semanas: ReadonlyArray<RegistroSemanal>): LoteDatos {
  if (!semanas.length) return lote;
  const enSemanaManual = (fecha: string) => semanas.some((s) => fecha >= s.desde && fecha <= s.hasta);
  const conservados = lote.embudo.filter((r) => !(PASOS_CLINICA.has(r.paso) && enSemanaManual(r.fecha)));
  const hayPasosPauta = conservados.some((r) => r.paso === "impresion" || r.paso === "clic" || r.paso === "conversacion");
  const pauta = hayPasosPauta ? [] : derivarPasosDePauta(lote.insights);
  const manuales = semanas.flatMap(semanalAEmbudo);
  return { ...lote, embudo: [...conservados, ...pauta, ...manuales].sort((a, b) => a.fecha.localeCompare(b.fecha)) };
}

// ---------------------------------------------------------------------------
// Archivo
// ---------------------------------------------------------------------------

export function leerAgenda(ruta: string = RUTA_AGENDA): RegistroSemanal[] {
  if (!existsSync(ruta)) return [];
  const crudo: unknown = JSON.parse(readFileSync(ruta, "utf8"));
  const r = ArchivoAgendaSchema.safeParse(crudo);
  if (!r.success) throw new Error(`datos/agenda.json no tiene la forma esperada: ${r.error.issues[0]?.message ?? "error"}`);
  return [...r.data.semanas].sort((a, b) => b.desde.localeCompare(a.desde));
}

/** Guarda una semana (reemplaza si ya existía). Escritura atómica: primero a un temporal. */
export function guardarSemana(ruta: string, semana: RegistroSemanal): RegistroSemanal[] {
  const valida = RegistroSemanalSchema.parse(semana);
  const actuales = leerAgenda(ruta).filter((s) => s.desde !== valida.desde);
  const semanas = [...actuales, valida].sort((a, b) => b.desde.localeCompare(a.desde));
  mkdirSync(dirname(ruta), { recursive: true });
  const tmp = `${ruta}.tmp`;
  writeFileSync(tmp, JSON.stringify({ semanas }, null, 2), "utf8");
  renameSync(tmp, ruta);
  return semanas;
}
