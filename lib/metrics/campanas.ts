/**
 * Campañas con cara propia. El resto del motor suma la cuenta; aquí cada pauta (viva, pausada o
 * archivada) tiene su fila con sus propios días de gasto, para verlas por separado y compararlas.
 *
 * Reglas:
 * - Solo se suman crudos; las razones se recalculan desde las sumas (nunca promedios de promedios).
 * - Se usa UN nivel: campaña si viene; si no, conjuntos agrupados por su padre; si no, lo que haya.
 * - `estado` es el de la fila más reciente: la plataforma reporta el estado ACTUAL, no el histórico.
 * - Comparar dos campañas que corrieron días distintos: las razones (costo por…, tasas) sí son
 *   comparables; las sumas (inversión, resultados) no, y se marca.
 */
import type { Estado, InsightRow, Rango } from "@/lib/adapters/types";
import type { MejorEs } from "@/lib/metrics/catalog";
import { sumarDias } from "@/lib/format/fechas";
import { agregar, cpm, ctrEnlace, cpa, costoConversacion, delta, filtrarRango, frecuencia, razon, tasaConversacion, type Agregado } from "./core";

export interface ResumenCampana {
  id: string;
  nombre: string;
  estado: Estado;
  objetivo: string | null;
  /** Activa según la plataforma Y con gasto en los últimos 3 días del periodo. */
  alAire: boolean;
  primerDia: string | null;
  ultimoDia: string | null;
  diasConGasto: number;
  nConjuntos: number;
  nAnuncios: number;
  total: Agregado;
  /** Fracción del gasto del periodo entre todas las campañas listadas (0–1). */
  participacionGasto: number | null;
  // Razones recalculadas desde las sumas
  costoResultado: number | null;
  costoConversacion: number | null;
  ctrEnlace: number | null;
  cpm: number | null;
  frecuencia: number | null;
  tasaConversacion: number | null;
}

const DIAS_AL_AIRE = 3;

/** Filas con las que se representa cada campaña (un nivel, nunca dos). */
function filasBase(filas: ReadonlyArray<InsightRow>): { filas: InsightRow[]; clave: (f: InsightRow) => string } {
  const campana = filas.filter((f) => f.nivel === "campana");
  if (campana.length) return { filas: campana, clave: (f) => f.id };
  const conjunto = filas.filter((f) => f.nivel === "conjunto" && f.padreId);
  if (conjunto.length) return { filas: conjunto, clave: (f) => f.padreId! };
  const anuncio = filas.filter((f) => f.nivel === "anuncio");
  if (anuncio.length) return { filas: anuncio, clave: (f) => f.padreId ?? f.id };
  return { filas: [...filas], clave: (f) => f.id };
}

export function resumirCampanas(insights: ReadonlyArray<InsightRow>, periodo: Rango): ResumenCampana[] {
  const enPeriodo = filtrarRango(insights, periodo);
  const { filas, clave } = filasBase(enPeriodo);
  const esNivelCampana = filas[0]?.nivel === "campana";

  const grupos = new Map<string, InsightRow[]>();
  for (const f of filas) {
    const k = clave(f);
    const g = grupos.get(k);
    if (g) g.push(f);
    else grupos.set(k, [f]);
  }

  // Hijos por campaña: conjuntos cuyo padre es la campaña; anuncios cuyo padre es uno de esos conjuntos.
  const conjuntosPorCampana = new Map<string, Set<string>>();
  const padreDeConjunto = new Map<string, string>();
  for (const f of enPeriodo) {
    if (f.nivel === "conjunto" && f.padreId) {
      padreDeConjunto.set(f.id, f.padreId);
      (conjuntosPorCampana.get(f.padreId) ?? conjuntosPorCampana.set(f.padreId, new Set()).get(f.padreId)!).add(f.id);
    }
  }
  const anunciosPorCampana = new Map<string, Set<string>>();
  for (const f of enPeriodo) {
    if (f.nivel !== "anuncio" || !f.padreId) continue;
    const c = padreDeConjunto.get(f.padreId);
    if (!c) continue;
    (anunciosPorCampana.get(c) ?? anunciosPorCampana.set(c, new Set()).get(c)!).add(f.id);
  }

  const umbralAlAire = sumarDias(periodo.hasta, -(DIAS_AL_AIRE - 1));
  const resumenes: ResumenCampana[] = [];
  for (const [id, g] of grupos) {
    const ordenadas = [...g].sort((a, b) => a.fecha.localeCompare(b.fecha));
    const ultima = ordenadas[ordenadas.length - 1]!;
    const conGasto = ordenadas.filter((f) => f.gasto > 0);
    if (!conGasto.length) continue; // sin gasto en el periodo: no hay qué juzgar
    const diasConGasto = new Set(conGasto.map((f) => f.fecha));
    const total = agregar(ordenadas);
    const gastoReciente = conGasto.some((f) => f.fecha >= umbralAlAire);
    resumenes.push({
      id,
      nombre: esNivelCampana ? ultima.nombre : id,
      estado: ultima.estado,
      objetivo: ultima.objetivo,
      alAire: ultima.estado === "activo" && gastoReciente,
      primerDia: conGasto[0]?.fecha ?? null,
      ultimoDia: conGasto[conGasto.length - 1]?.fecha ?? null,
      diasConGasto: diasConGasto.size,
      nConjuntos: conjuntosPorCampana.get(id)?.size ?? 0,
      nAnuncios: anunciosPorCampana.get(id)?.size ?? 0,
      total,
      participacionGasto: null,
      costoResultado: cpa(total),
      costoConversacion: costoConversacion(total),
      ctrEnlace: ctrEnlace(total),
      cpm: cpm(total),
      frecuencia: frecuencia(total),
      tasaConversacion: tasaConversacion(total),
    });
  }

  const gastoTotal = resumenes.reduce((s, c) => s + c.total.gasto, 0);
  for (const c of resumenes) c.participacionGasto = razon(c.total.gasto, gastoTotal);
  return resumenes.sort((a, b) => b.total.gasto - a.total.gasto || a.nombre.localeCompare(b.nombre, "es"));
}

// ---------------------------------------------------------------------------
// Comparación
// ---------------------------------------------------------------------------

export interface MetricaComparada {
  id: string;
  nombre: string;
  unidad: "cop" | "numero" | "porcentaje" | "ratio";
  mejorEs: MejorEs;
  a: number | null;
  b: number | null;
  /** (b − a) / a; null si falta alguno. */
  delta: number | null;
  /** false cuando es una suma y los días de pauta difieren: no se puede leer como mejor/peor. */
  comparable: boolean;
}

export interface ComparacionCampanas {
  a: ResumenCampana;
  b: ResumenCampana;
  diasDistintos: boolean;
  aviso: string | null;
  metricas: MetricaComparada[];
}

const METRICAS_COMPARACION: { id: string; nombre: string; unidad: MetricaComparada["unidad"]; mejorEs: MejorEs; suma: boolean; f: (c: ResumenCampana) => number | null }[] = [
  { id: "gasto", nombre: "Inversión", unidad: "cop", mejorEs: "rango", suma: true, f: (c) => c.total.gasto },
  { id: "resultados", nombre: "Resultados", unidad: "numero", mejorEs: "mayor", suma: true, f: (c) => c.total.resultados },
  { id: "conversaciones", nombre: "Conversaciones", unidad: "numero", mejorEs: "mayor", suma: true, f: (c) => c.total.conversacionesIniciadas },
  { id: "costo_resultado", nombre: "Costo por resultado", unidad: "cop", mejorEs: "menor", suma: false, f: (c) => c.costoResultado },
  { id: "costo_conversacion", nombre: "Costo por conversación", unidad: "cop", mejorEs: "menor", suma: false, f: (c) => c.costoConversacion },
  { id: "ctr_enlace", nombre: "Clic en el enlace", unidad: "porcentaje", mejorEs: "mayor", suma: false, f: (c) => c.ctrEnlace },
  { id: "cpm", nombre: "Costo por mil", unidad: "cop", mejorEs: "menor", suma: false, f: (c) => c.cpm },
  { id: "frecuencia", nombre: "Frecuencia", unidad: "ratio", mejorEs: "rango", suma: false, f: (c) => c.frecuencia },
  { id: "tasa_conversacion", nombre: "Clics que se vuelven conversación", unidad: "porcentaje", mejorEs: "mayor", suma: false, f: (c) => c.tasaConversacion },
];

export function compararCampanas(a: ResumenCampana, b: ResumenCampana): ComparacionCampanas {
  const diasDistintos = a.diasConGasto !== b.diasConGasto;
  return {
    a,
    b,
    diasDistintos,
    aviso: diasDistintos
      ? `${a.nombre} corrió ${a.diasConGasto} días y ${b.nombre} ${b.diasConGasto}: compara los costos y las tasas, no las sumas.`
      : null,
    metricas: METRICAS_COMPARACION.map((m) => {
      const va = m.f(a);
      const vb = m.f(b);
      return { id: m.id, nombre: m.nombre, unidad: m.unidad, mejorEs: m.mejorEs, a: va, b: vb, delta: delta(vb, va), comparable: !(m.suma && diasDistintos) };
    }),
  };
}
