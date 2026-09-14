/**
 * Resultados por pauta: lo que Meta no ve, campaña por campaña. Cinco números por campaña
 * (contactos cerrados, citas agendadas, citas asistidas, ventas, valor) que se escriben en la
 * pantalla Campañas. Sin semanas, sin planillas, sin nombres: el esquema es estricto y no admite
 * texto libre.
 *
 * - Se guarda en `datos/resultados.json` (fuera del repositorio): un registro por cuenta y campaña.
 * - Para el motor, los totales de la campaña se reparten en sus días con gasto como registros del
 *   embudo, así las ventanas de 14 días y el embudo en pesos funcionan igual que con datos diarios.
 * - Lo registrado manda: reemplaza cualquier paso de clínica que la sincronización trajera para
 *   esa campaña. Los pasos de pauta (impresión, clic, conversación) salen de los insights.
 */
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { z } from "zod";
import type { InsightRow, LoteDatos, RegistroEmbudo } from "@/lib/adapters/types";
import { razon } from "@/lib/metrics/core";

export const RUTA_RESULTADOS = resolve(process.cwd(), "datos", "resultados.json");

const entero = z.number().int().min(0);

export const RegistroPautaSchema = z
  .object({
    /** Cuenta publicitaria (el panel analiza una a la vez). */
    cuentaId: z.string().min(1),
    /** Campaña a la que pertenecen estos resultados. */
    campanaId: z.string().min(1),
    contactosCerrados: entero,
    citasAgendadas: entero,
    citasAsistidas: entero,
    ventas: entero,
    valorVentasCOP: entero.nullable(),
    /** ISO con zona. */
    registradoEn: z.string().min(10),
  })
  .strict()
  .refine((s) => s.citasAsistidas <= s.citasAgendadas, { message: "No pueden asistir más citas de las agendadas" })
  .refine((s) => s.ventas <= s.citasAsistidas, { message: "No puede haber más ventas que citas asistidas" });
export type RegistroPauta = z.infer<typeof RegistroPautaSchema>;

const ArchivoSchema = z.object({ registros: z.array(RegistroPautaSchema) }).strict();

export const tasaAsistencia = (s: RegistroPauta): number | null => razon(s.citasAsistidas, s.citasAgendadas);
export const tasaCierre = (s: RegistroPauta): number | null => razon(s.ventas, s.citasAsistidas);

// ---------------------------------------------------------------------------
// De la pauta al embudo
// ---------------------------------------------------------------------------

const PASOS_CLINICA = new Set<RegistroEmbudo["paso"]>(["lead_calificado", "cita_agendada", "cita_asistida", "venta", "recompra"]);

/** Reparte `total` en `n` enteros que suman exactamente `total` (los primeros reciben el resto). */
function repartir(total: number, n: number): number[] {
  const base = Math.floor(total / n);
  const resto = total - base * n;
  return Array.from({ length: n }, (_, i) => base + (i < resto ? 1 : 0));
}

/** Valor proporcional a las cantidades de cada día, en enteros que suman exactamente el total. */
function repartirValor(valorTotal: number, cantidades: number[]): number[] {
  const total = cantidades.reduce((a, b) => a + b, 0);
  if (total === 0) return cantidades.map(() => 0);
  const valores = cantidades.map((c) => Math.floor((valorTotal * c) / total));
  let resto = valorTotal - valores.reduce((a, b) => a + b, 0);
  for (let i = 0; resto > 0 && i < valores.length; i++) if (cantidades[i]! > 0) { valores[i]! += 1; resto -= 1; }
  return valores;
}

/** Días (ordenados) en que la campaña gastó, según los insights: nivel campaña o, si no, conjuntos por su padre. */
export function diasConGastoDeCampana(insights: ReadonlyArray<InsightRow>, campanaId: string): string[] {
  const campana = insights.filter((f) => f.nivel === "campana" && f.id === campanaId && f.gasto > 0);
  const filas = campana.length ? campana : insights.filter((f) => f.nivel === "conjunto" && f.padreId === campanaId && f.gasto > 0);
  return [...new Set(filas.map((f) => f.fecha))].sort();
}

export function pautaAEmbudo(s: RegistroPauta, dias: ReadonlyArray<string>): RegistroEmbudo[] {
  if (!dias.length) return [];
  const salida: RegistroEmbudo[] = [];
  const emitir = (paso: RegistroEmbudo["paso"], total: number, valorTotal: number | null) => {
    const cantidades = repartir(total, dias.length);
    const valores = valorTotal === null ? null : repartirValor(valorTotal, cantidades);
    dias.forEach((fecha, i) => {
      salida.push({ fecha, campanaId: s.campanaId, fuenteAtribuida: "meta", paso, cantidad: cantidades[i]!, valorCOP: valores ? valores[i]! : null, servicio: null, sede: null, nRegistros: cantidades[i]! });
    });
  };
  emitir("lead_calificado", s.contactosCerrados, null);
  emitir("cita_agendada", s.citasAgendadas, null);
  emitir("cita_asistida", s.citasAsistidas, null);
  emitir("venta", s.ventas, s.valorVentasCOP);
  return salida;
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

/** Mezcla los resultados por pauta en el lote (ya filtrado a una cuenta). Sin registros, devuelve el mismo objeto. */
export function fusionarResultados(lote: LoteDatos, registros: ReadonlyArray<RegistroPauta>): LoteDatos {
  if (!registros.length) return lote;
  const campanas = new Set(registros.map((r) => r.campanaId));
  const conservados = lote.embudo.filter((r) => !(PASOS_CLINICA.has(r.paso) && r.campanaId !== null && campanas.has(r.campanaId)));
  const hayPasosPauta = conservados.some((r) => r.paso === "impresion" || r.paso === "clic" || r.paso === "conversacion");
  const pauta = hayPasosPauta ? [] : derivarPasosDePauta(lote.insights);
  const manuales = registros.flatMap((s) => pautaAEmbudo(s, diasConGastoDeCampana(lote.insights, s.campanaId)));
  return { ...lote, embudo: [...conservados, ...pauta, ...manuales].sort((a, b) => a.fecha.localeCompare(b.fecha)) };
}

// ---------------------------------------------------------------------------
// Archivo
// ---------------------------------------------------------------------------

export function leerResultados(ruta: string = RUTA_RESULTADOS): RegistroPauta[] {
  if (!existsSync(ruta)) return [];
  const crudo: unknown = JSON.parse(readFileSync(ruta, "utf8"));
  const r = ArchivoSchema.safeParse(crudo);
  if (!r.success) throw new Error(`datos/resultados.json no tiene la forma esperada: ${r.error.issues[0]?.message ?? "error"}`);
  return [...r.data.registros].sort((a, b) => b.registradoEn.localeCompare(a.registradoEn));
}

/** Guarda los resultados de una campaña (reemplaza si ya existían). Escritura atómica. */
export function guardarResultado(ruta: string, registro: RegistroPauta): RegistroPauta[] {
  const valido = RegistroPautaSchema.parse(registro);
  const actuales = leerResultados(ruta).filter((s) => !(s.cuentaId === valido.cuentaId && s.campanaId === valido.campanaId));
  const registros = [valido, ...actuales];
  mkdirSync(dirname(ruta), { recursive: true });
  const tmp = `${ruta}.tmp`;
  writeFileSync(tmp, JSON.stringify({ registros }, null, 2), "utf8");
  renameSync(tmp, ruta);
  return registros;
}
