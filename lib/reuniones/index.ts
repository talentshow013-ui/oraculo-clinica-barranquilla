/**
 * Reunión quincenal: la bitácora. Cada quince días el equipo se sienta con el panel, el motor
 * toma una FOTO de las cifras que mandan, y se anotan las DECISIONES ("subir presupuesto de
 * Facial", "probar gancho de precio"). En la siguiente reunión, cada decisión se evalúa contra la
 * cifra actual: ganó, perdió o sin señal, y qué se aprendió. Así la próxima reunión no empieza
 * de cero y las oportunidades recuerdan lo que ya se probó.
 *
 * - Se guarda en `datos/reuniones.json` (fuera del repositorio), por cuenta publicitaria.
 * - Texto libre solo para la decisión y el aprendizaje; se rechaza cualquier cosa que parezca un
 *   teléfono, un correo o una cédula. Aquí se habla de pauta, nunca de pacientes.
 * - Los números los pone el motor (foto), nunca la persona.
 */
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { z } from "zod";
import { RESULTADOS_EXPERIMENTO, TIPOS_PRUEBA, type Experimento } from "@/lib/adapters/types";
import type { ValorMetrica } from "@/lib/metrics/resolver";
import { sumarDias } from "@/lib/format/fechas";
import { delta } from "@/lib/metrics/core";

export const RUTA_REUNIONES = resolve(process.cwd(), "datos", "reuniones.json");
export const DIAS_ENTRE_REUNIONES = 14;

const FECHA = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

/** Decisiones hablan de pauta. Un teléfono, un correo o una cédula no caben. */
export function sinDatosPersonales(texto: string): boolean {
  const t = texto.trim();
  if (!t) return false;
  if (/@/.test(t)) return false;
  if (/\d[\d .-]{6,}\d/.test(t)) return false; // 7+ dígitos seguidos (con o sin separadores)
  if (/\b(c[eé]dula|paciente|historia cl[ií]nica)\b/i.test(t) && /\d{4,}/.test(t)) return false;
  return true;
}
const textoSeguro = z.string().min(1).max(500).refine(sinDatosPersonales, { message: "Aquí solo va la decisión de pauta: sin teléfonos, correos ni datos de pacientes" });

export const MetricaFotoSchema = z
  .object({
    id: z.string(),
    nombre: z.string(),
    unidad: z.enum(["cop", "numero", "porcentaje", "ratio", "segundos", "dias", "indice", "texto"]),
    mejorEs: z.enum(["mayor", "menor", "rango", "informativo"]),
    reciente: z.number().nullable(),
    previo: z.number().nullable(),
    /** "14d" = ventana de 14 días; "periodo" = el motor solo tiene el valor del periodo completo. */
    ventana: z.enum(["14d", "periodo"]),
  })
  .strict();
export type MetricaFoto = z.infer<typeof MetricaFotoSchema>;

export const FotoSchema = z.object({ fecha: FECHA, metricas: z.array(MetricaFotoSchema) }).strict();
export type FotoReunion = z.infer<typeof FotoSchema>;

export const DecisionSchema = z
  .object({
    id: z.string().min(1),
    texto: textoSeguro,
    /** Métrica maestra con la que se juzga; null = sin métrica (solo se anota). */
    metricaId: z.string().nullable(),
    valorAlDecidir: z.number().nullable(),
    objetivo: z.number().nullable(),
    tipoPrueba: z.enum(TIPOS_PRUEBA),
    evaluarEl: FECHA,
    resultado: z.enum(RESULTADOS_EXPERIMENTO),
    valorAlEvaluar: z.number().nullable(),
    aprendizaje: textoSeguro.nullable(),
    evaluadaEn: z.string().nullable(),
  })
  .strict();
export type Decision = z.infer<typeof DecisionSchema>;

export const ReunionSchema = z
  .object({
    id: z.string().min(1),
    cuentaId: z.string().min(1),
    fecha: FECHA,
    foto: FotoSchema,
    decisiones: z.array(DecisionSchema),
    registradaEn: z.string().min(10),
  })
  .strict();
export type Reunion = z.infer<typeof ReunionSchema>;

const ArchivoSchema = z.object({ reuniones: z.array(ReunionSchema) }).strict();

// ---------------------------------------------------------------------------
// Foto y decisiones
// ---------------------------------------------------------------------------

const numero = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);

export function tomarFoto(maestras: ReadonlyArray<ValorMetrica>, fecha: string): FotoReunion {
  return {
    fecha,
    metricas: maestras.map((m) => {
      const tieneVentana = m.valorReciente !== undefined;
      return {
        id: m.id,
        nombre: m.nombre,
        unidad: m.unidad,
        mejorEs: m.mejorEs,
        reciente: tieneVentana ? numero(m.valorReciente) : numero(m.valor),
        previo: tieneVentana ? numero(m.valorPrevio) : null,
        ventana: tieneVentana ? "14d" : "periodo",
      };
    }),
  };
}

const idNuevo = (prefijo: string, semilla: string) => `${prefijo}_${semilla.replace(/[^0-9]/g, "").slice(0, 14)}_${Math.random().toString(36).slice(2, 7)}`;

export function crearReunion(p: { cuentaId: string; fecha: string; foto: FotoReunion; registradaEn: string }): Reunion {
  return ReunionSchema.parse({ id: idNuevo("reu", p.registradaEn), cuentaId: p.cuentaId, fecha: p.fecha, foto: p.foto, decisiones: [], registradaEn: p.registradaEn });
}

export interface NuevaDecision {
  texto: string;
  metricaId: string | null;
  objetivo: number | null;
  tipoPrueba: Decision["tipoPrueba"];
  /** Por defecto, la próxima reunión (14 días). */
  evaluarEl?: string;
}

export function agregarDecision(r: Reunion, n: NuevaDecision): Reunion {
  const metrica = n.metricaId ? r.foto.metricas.find((m) => m.id === n.metricaId) : undefined;
  const d = DecisionSchema.parse({
    id: idNuevo("dec", r.registradaEn + Date.now()),
    texto: n.texto.trim(),
    metricaId: metrica?.id ?? null,
    valorAlDecidir: metrica?.reciente ?? null,
    objetivo: n.objetivo,
    tipoPrueba: n.tipoPrueba,
    evaluarEl: n.evaluarEl ?? sumarDias(r.fecha, DIAS_ENTRE_REUNIONES),
    resultado: "en_curso",
    valorAlEvaluar: null,
    aprendizaje: null,
    evaluadaEn: null,
  });
  return { ...r, decisiones: [...r.decisiones, d] };
}

export interface DecisionPendiente extends Decision {
  reunionId: string;
  reunionFecha: string;
}

export function decisionesPendientes(reuniones: ReadonlyArray<Reunion>): DecisionPendiente[] {
  return reuniones
    .flatMap((r) => r.decisiones.filter((d) => d.resultado === "en_curso").map((d) => ({ ...d, reunionId: r.id, reunionFecha: r.fecha })))
    .sort((a, b) => a.evaluarEl.localeCompare(b.evaluarEl));
}

export function evaluarDecision(
  reuniones: ReadonlyArray<Reunion>,
  decisionId: string,
  veredicto: { resultado: Exclude<Decision["resultado"], "en_curso">; aprendizaje: string | null },
  fotoActual: FotoReunion,
  evaluadaEn: string,
): Reunion[] {
  return reuniones.map((r) => ({
    ...r,
    decisiones: r.decisiones.map((d) => {
      if (d.id !== decisionId) return d;
      const ahora = d.metricaId ? (fotoActual.metricas.find((m) => m.id === d.metricaId)?.reciente ?? null) : null;
      return DecisionSchema.parse({ ...d, resultado: veredicto.resultado, aprendizaje: veredicto.aprendizaje?.trim() || null, valorAlEvaluar: ahora, evaluadaEn });
    }),
  }));
}

export interface ComparacionDecision {
  antes: number | null;
  ahora: number | null;
  delta: number | null;
  /** true/false según mejorEs; null si no hay métrica, no hay valores o la métrica es informativa. */
  mejoro: boolean | null;
  objetivoCumplido: boolean | null;
  mejorEs: MetricaFoto["mejorEs"] | null;
  unidad: MetricaFoto["unidad"] | null;
  nombre: string | null;
}

/** Antes (al decidir) contra ahora (foto actual, o el valor guardado al evaluar si ya se cerró). */
export function compararDecision(d: Decision, fotoActual: FotoReunion): ComparacionDecision {
  const m = d.metricaId ? fotoActual.metricas.find((x) => x.id === d.metricaId) : undefined;
  const antes = d.valorAlDecidir;
  const ahora = d.resultado === "en_curso" ? (m?.reciente ?? null) : d.valorAlEvaluar;
  const dl = delta(ahora, antes);
  const mejorEs = m?.mejorEs ?? null;
  let mejoro: boolean | null = null;
  if (dl !== null && mejorEs === "mayor") mejoro = dl > 0;
  if (dl !== null && mejorEs === "menor") mejoro = dl < 0;
  let objetivoCumplido: boolean | null = null;
  if (d.objetivo !== null && ahora !== null && mejorEs === "mayor") objetivoCumplido = ahora >= d.objetivo;
  if (d.objetivo !== null && ahora !== null && mejorEs === "menor") objetivoCumplido = ahora <= d.objetivo;
  return { antes, ahora, delta: dl, mejoro, objetivoCumplido, mejorEs, unidad: m?.unidad ?? null, nombre: m?.nombre ?? null };
}

/** Las decisiones alimentan la memoria de experimentos (oportunidades ya probadas). */
export function reunionesAExperimentos(reuniones: ReadonlyArray<Reunion>): Experimento[] {
  return reuniones.flatMap((r) =>
    r.decisiones.map((d) => ({
      id: d.id,
      hipotesis: d.texto,
      servicio: null,
      angulo: null,
      tipoPrueba: d.tipoPrueba,
      inicio: r.fecha,
      fin: d.evaluadaEn ? d.evaluadaEn.slice(0, 10) : null,
      resultado: d.resultado,
      metricaExito: r.foto.metricas.find((m) => m.id === d.metricaId)?.nombre ?? "sin métrica",
      aprendizaje: d.aprendizaje,
      origenOportunidadId: null,
    })),
  );
}

// ---------------------------------------------------------------------------
// Archivo
// ---------------------------------------------------------------------------

export function leerReuniones(ruta: string = RUTA_REUNIONES): Reunion[] {
  if (!existsSync(ruta)) return [];
  const crudo: unknown = JSON.parse(readFileSync(ruta, "utf8"));
  const r = ArchivoSchema.safeParse(crudo);
  if (!r.success) throw new Error(`datos/reuniones.json no tiene la forma esperada: ${r.error.issues[0]?.message ?? "error"}`);
  return [...r.data.reuniones].sort((a, b) => b.fecha.localeCompare(a.fecha));
}

export function guardarReuniones(ruta: string, reuniones: ReadonlyArray<Reunion>): void {
  const datos = ArchivoSchema.parse({ reuniones: [...reuniones].sort((a, b) => b.fecha.localeCompare(a.fecha)) });
  mkdirSync(dirname(ruta), { recursive: true });
  const tmp = `${ruta}.tmp`;
  writeFileSync(tmp, JSON.stringify(datos, null, 2), "utf8");
  renameSync(tmp, ruta);
}
