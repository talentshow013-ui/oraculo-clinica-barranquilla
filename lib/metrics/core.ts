/**
 * Núcleo de cálculo — funciones puras.
 *
 * Regla de oro: solo se SUMAN campos crudos. Toda razón se recalcula desde las
 * sumas. No existe aquí, ni debe existir en el proyecto, una función que
 * promedie razones. Ver PROMPT_ORACULO_v2 §3.4 y §7.1.
 */
import type { InsightRow, Rango } from "@/lib/adapters/types";
import { diasEntre } from "@/lib/format/fechas";

// ---------------------------------------------------------------------------
// Primitivas nulables
// ---------------------------------------------------------------------------

/** null si falta cualquiera o el denominador es 0. Nunca Infinity ni NaN. */
export function razon(num: number | null, den: number | null): number | null {
  if (num === null || den === null) return null;
  if (!Number.isFinite(num) || !Number.isFinite(den)) return null;
  if (den === 0) return null;
  return num / den;
}

/** null si TODOS son null (o no hay valores); ignora los null si hay alguno. */
export function sumaNullable(valores: ReadonlyArray<number | null>): number | null {
  let acumulado: number | null = null;
  for (const v of valores) {
    if (v === null || !Number.isFinite(v)) continue;
    acumulado = (acumulado ?? 0) + v;
  }
  return acumulado;
}

/** 1 - b/a; null si a es 0 o falta. Sirve para "caída entre p25 y p50". */
function caida(a: number | null, b: number | null): number | null {
  const r = razon(b, a);
  return r === null ? null : 1 - r;
}

// ---------------------------------------------------------------------------
// Agregado — sumas de crudos
// ---------------------------------------------------------------------------

const CAMPOS_OBLIGATORIOS = ["gasto", "impresiones", "clics", "clicsEnlace", "resultados"] as const;

const CAMPOS_NULLABLES = [
  "alcance",
  "subastasGanadas",
  "clicsUnicos",
  "interacciones",
  "reacciones",
  "comentarios",
  "compartidos",
  "guardados",
  "visitasPerfil",
  "seguidoresNuevos",
  "vistasLandingPage",
  "reproducciones",
  "reproducciones2s",
  "reproducciones3s",
  "reproducciones6s",
  "reproduccionesThru",
  "p25",
  "p50",
  "p75",
  "p95",
  "p100",
  "tiempoReproduccionTotal",
  "conversacionesIniciadas",
  "conversacionesRespondidas",
  "valorConversion",
] as const;

type CampoObligatorio = (typeof CAMPOS_OBLIGATORIOS)[number];
type CampoNullable = (typeof CAMPOS_NULLABLES)[number];

export type Agregado = Record<CampoObligatorio, number> &
  Record<CampoNullable, number | null> & {
    /** Días distintos con al menos una fila. */
    dias: number;
    /** Entidades distintas (ids). */
    entidades: number;
    /** Suma de duracionCreativoSeg ponderada por impresiones (para tiempo promedio). */
    duracionPonderada: number | null;
    /** Frecuencia y puja no se suman: se guardan ponderadas por impresiones. */
    frecuenciaPonderada: number | null;
    pujaPonderada: number | null;
  };

export function agregar(filas: ReadonlyArray<InsightRow>): Agregado {
  const fechas = new Set<string>();
  const ids = new Set<string>();

  const obligatorios = Object.fromEntries(CAMPOS_OBLIGATORIOS.map((c) => [c, 0])) as Record<
    CampoObligatorio,
    number
  >;
  const nullables = Object.fromEntries(CAMPOS_NULLABLES.map((c) => [c, null])) as Record<
    CampoNullable,
    number | null
  >;

  let duracionPonderada: number | null = null;
  let frecuenciaPonderada: number | null = null;
  let pujaPonderada: number | null = null;

  for (const f of filas) {
    fechas.add(f.fecha);
    ids.add(f.id);
    for (const c of CAMPOS_OBLIGATORIOS) obligatorios[c] += f[c];
    for (const c of CAMPOS_NULLABLES) {
      const v = f[c];
      if (v !== null) nullables[c] = (nullables[c] ?? 0) + v;
    }
    if (f.duracionCreativoSeg !== null) {
      duracionPonderada = (duracionPonderada ?? 0) + f.duracionCreativoSeg * f.impresiones;
    }
    if (f.frecuencia !== null) {
      frecuenciaPonderada = (frecuenciaPonderada ?? 0) + f.frecuencia * f.impresiones;
    }
    if (f.pujaPromedio !== null) {
      pujaPonderada = (pujaPonderada ?? 0) + f.pujaPromedio * f.impresiones;
    }
  }

  return {
    ...obligatorios,
    ...nullables,
    dias: fechas.size,
    entidades: ids.size,
    duracionPonderada,
    frecuenciaPonderada,
    pujaPonderada,
  };
}

// ---------------------------------------------------------------------------
// Derivadas — todas puras sobre Agregado, todas number | null
// ---------------------------------------------------------------------------

const mil = (r: number | null) => (r === null ? null : r * 1000);

export const cpm = (a: Agregado) => mil(razon(a.gasto, a.impresiones));
export const cpc = (a: Agregado) => razon(a.gasto, a.clics);
export const cpcEnlace = (a: Agregado) => razon(a.gasto, a.clicsEnlace);
export const ctr = (a: Agregado) => razon(a.clics, a.impresiones);
export const ctrEnlace = (a: Agregado) => razon(a.clicsEnlace, a.impresiones);
export const ctrUnico = (a: Agregado) => razon(a.clicsUnicos, a.alcance);
/** Frecuencia recalculada: impresiones / alcance; si no hay alcance, ponderada de la fuente. */
export const frecuencia = (a: Agregado) =>
  razon(a.impresiones, a.alcance) ?? razon(a.frecuenciaPonderada, a.impresiones);
export const pujaPromedio = (a: Agregado) => razon(a.pujaPonderada, a.impresiones);
export const cpa = (a: Agregado) => razon(a.gasto, a.resultados);
export const roas = (a: Agregado) => razon(a.valorConversion, a.gasto);
export const costoConversacion = (a: Agregado) => razon(a.gasto, a.conversacionesIniciadas);
export const tasaConversacion = (a: Agregado) => razon(a.conversacionesIniciadas, a.clicsEnlace);
export const tasaRespuesta = (a: Agregado) => razon(a.conversacionesRespondidas, a.conversacionesIniciadas);
/** Clics de enlace sobre clics totales: cuánto del clic era intención real. */
export const calidadClic = (a: Agregado) => razon(a.clicsEnlace, a.clics);
export const tasaConversion = (a: Agregado) => razon(a.resultados, a.clicsEnlace);
export const tasaInteraccion = (a: Agregado) => razon(a.interacciones, a.impresiones);
export const tasaGuardado = (a: Agregado) => razon(a.guardados, a.impresiones);
export const tasaCompartido = (a: Agregado) => razon(a.compartidos, a.impresiones);
export const tasaComentario = (a: Agregado) => razon(a.comentarios, a.impresiones);
export const ratioGuardadoLike = (a: Agregado) => razon(a.guardados, a.reacciones);
export const tasaVisitaPerfil = (a: Agregado) => razon(a.visitasPerfil, a.impresiones);
export const costoMilAlcance = (a: Agregado) => mil(razon(a.gasto, a.alcance));
export const costoVistaLanding = (a: Agregado) => razon(a.gasto, a.vistasLandingPage);
export const costoInteraccion = (a: Agregado) => razon(a.gasto, a.interacciones);
/** Clics de enlace que no llegan a la página. */
export const fugaAterrizaje = (a: Agregado) => caida(a.clicsEnlace, a.vistasLandingPage);

// Video. Meta reporta gancho a 3s y ThruPlay; TikTok a 2s y 6s. Se cae con gracia.
/** Gancho: 3 s / impresiones; si la fuente no lo da, 2 s; si tampoco, el 25 % visto (Meta no entrega 3 s ni 2 s por anuncio). */
export const hookRate = (a: Agregado) =>
  razon(a.reproducciones3s, a.impresiones) ?? razon(a.reproducciones2s, a.impresiones) ?? razon(a.p25, a.impresiones);
export const holdRate = (a: Agregado) =>
  razon(a.reproduccionesThru, a.impresiones) ?? razon(a.reproducciones6s, a.impresiones);
export const tasaFinalizacion = (a: Agregado) => razon(a.p100, a.reproducciones);
export const retencion25 = (a: Agregado) => razon(a.p25, a.reproducciones);
export const retencion50 = (a: Agregado) => razon(a.p50, a.reproducciones);
export const retencion75 = (a: Agregado) => razon(a.p75, a.reproducciones);
export const caida2550 = (a: Agregado) => caida(a.p25, a.p50);
export const caida5075 = (a: Agregado) => caida(a.p50, a.p75);
export const tiempoPromedio = (a: Agregado) => razon(a.tiempoReproduccionTotal, a.reproducciones);
export const duracionPromedio = (a: Agregado) => razon(a.duracionPonderada, a.impresiones);
/** Segundos vistos por peso invertido. */
export const eficienciaSegundo = (a: Agregado) => razon(a.tiempoReproduccionTotal, a.gasto);
/** CTR de quienes aguantaron el video: clics de enlace sobre ThruPlay/6s. */
export const ctrPostHold = (a: Agregado) =>
  razon(a.clicsEnlace, a.reproduccionesThru) ?? razon(a.clicsEnlace, a.reproducciones6s);
export const costo3s = (a: Agregado) => razon(a.gasto, a.reproducciones3s) ?? razon(a.gasto, a.reproducciones2s);
export const costoThruplay = (a: Agregado) => razon(a.gasto, a.reproduccionesThru) ?? razon(a.gasto, a.reproducciones6s);
/** % del creativo visto en promedio. */
export const porcentajeDuracionVista = (a: Agregado) => razon(tiempoPromedio(a), duracionPromedio(a));

// ---------------------------------------------------------------------------
// Concentración, cambio y dispersión
// ---------------------------------------------------------------------------

/** Herfindahl: suma de cuotas al cuadrado. 1 = todo en uno. null si no hay total. */
export function concentracionHHI(valores: ReadonlyArray<number>): number | null {
  const total = valores.reduce((s, v) => s + v, 0);
  if (total <= 0) return null;
  return valores.reduce((s, v) => s + (v / total) ** 2, 0);
}

export function concentracionTop1(valores: ReadonlyArray<number>): number | null {
  const total = valores.reduce((s, v) => s + v, 0);
  if (total <= 0) return null;
  return Math.max(...valores) / total;
}

/** Cambio relativo actual vs base. null si la base es 0 o falta. */
export function delta(actual: number | null, base: number | null): number | null {
  if (actual === null || base === null) return null;
  if (base === 0) return null;
  return (actual - base) / base;
}

export function desviacion(valores: ReadonlyArray<number>): number | null {
  if (valores.length < 2) return null;
  const media = valores.reduce((s, v) => s + v, 0) / valores.length;
  const varianza = valores.reduce((s, v) => s + (v - media) ** 2, 0) / (valores.length - 1);
  return Math.sqrt(varianza);
}

export function coeficienteVariacion(valores: ReadonlyArray<number>): number | null {
  const sd = desviacion(valores);
  if (sd === null) return null;
  const media = valores.reduce((s, v) => s + v, 0) / valores.length;
  return razon(sd, media);
}

// ---------------------------------------------------------------------------
// Series y ventanas
// ---------------------------------------------------------------------------

export interface PuntoSerie {
  fecha: string;
  agregado: Agregado;
}

/** Agrega por fecha, ordenado ascendente. Solo suma crudos por día. */
export function serieDiaria(filas: ReadonlyArray<InsightRow>): PuntoSerie[] {
  const porFecha = new Map<string, InsightRow[]>();
  for (const f of filas) {
    const lista = porFecha.get(f.fecha);
    if (lista) lista.push(f);
    else porFecha.set(f.fecha, [f]);
  }
  return [...porFecha.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([fecha, lista]) => ({ fecha, agregado: agregar(lista) }));
}

/** Dos rangos son comparables solo si tienen el mismo número de días. */
export function ventanasIguales(a: Rango, b: Rango): boolean {
  return diasEntre(a.desde, a.hasta) === diasEntre(b.desde, b.hasta);
}

export function filtrarRango(filas: ReadonlyArray<InsightRow>, r: Rango): InsightRow[] {
  return filas.filter((f) => f.fecha >= r.desde && f.fecha <= r.hasta);
}
