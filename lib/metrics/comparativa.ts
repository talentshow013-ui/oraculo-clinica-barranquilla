/**
 * «Frente a quién te comparas»: tres referencias, cada una con su fuente declarada, para que la
 * comparación deje de ser un espejo. (1) Tú, últimos 14 días. (2) Tu mejor mes de los que hay
 * cargados. (3) El mercado: el ranking que entrega Meta frente a la competencia en subasta y lo que
 * el radar observa en la Biblioteca de anuncios. Nada se estima: lo que no hay, es null.
 */
import type { InsightRow, RankingAnuncio } from "@/lib/adapters/types";
import type { Rango } from "@/lib/adapters/types";
import { agregar, costoConversacion, cpm, ctrEnlace, frecuencia, type Agregado } from "@/lib/metrics/core";
import { ES_INFERIOR } from "@/lib/adapters/meta.rankings";

export interface ColumnaPropia {
  etiqueta: string;
  desde: string;
  hasta: string;
  dias: number;
  gasto: number;
  conversaciones: number | null;
  costoConversacion: number | null;
  ctrEnlace: number | null;
  cpm: number | null;
  frecuencia: number | null;
}

export interface MercadoMeta {
  /** Día de la captura del ranking. */
  fecha: string;
  anunciosConDato: number;
  mejor: number;
  igual: number;
  inferior: number;
  sinDato: number;
}

export interface Comparativa {
  tu: ColumnaPropia;
  anterior: ColumnaPropia;
  /** Mejor mes por costo por conversación entre los meses con al menos `minimoDias` días de datos. null si ninguno califica. */
  mejorMes: ColumnaPropia | null;
  mesesConsiderados: number;
  mercadoMeta: MercadoMeta | null;
}

/** Días mínimos con gasto para que un mes cuente como referencia. */
export const MINIMO_DIAS_MES = 15;

function columna(etiqueta: string, filas: ReadonlyArray<InsightRow>, rango: Rango): ColumnaPropia {
  const a: Agregado = agregar(filas);
  return {
    etiqueta,
    desde: rango.desde,
    hasta: rango.hasta,
    dias: new Set(filas.filter((f) => f.gasto > 0).map((f) => f.fecha)).size,
    gasto: a.gasto,
    conversaciones: a.conversacionesIniciadas,
    costoConversacion: costoConversacion(a),
    ctrEnlace: ctrEnlace(a),
    cpm: cpm(a),
    frecuencia: frecuencia(a),
  };
}

const NOMBRE_MES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

/** Mejor mes = menor costo por conversación entre meses con datos suficientes. */
export function mejorMes(filas: ReadonlyArray<InsightRow>, minimoDias = MINIMO_DIAS_MES): { mejor: ColumnaPropia | null; considerados: number } {
  const porMes = new Map<string, InsightRow[]>();
  for (const f of filas) {
    const clave = f.fecha.slice(0, 7);
    const lista = porMes.get(clave);
    if (lista) lista.push(f);
    else porMes.set(clave, [f]);
  }
  let mejor: ColumnaPropia | null = null;
  let considerados = 0;
  for (const [mes, lista] of porMes) {
    const dias = new Set(lista.filter((f) => f.gasto > 0).map((f) => f.fecha)).size;
    if (dias < minimoDias) continue;
    considerados++;
    const fechas = lista.map((f) => f.fecha).sort();
    const [anio, num] = mes.split("-");
    const col = columna(`${NOMBRE_MES[Number(num) - 1]} ${anio}`, lista, { desde: fechas[0]!, hasta: fechas[fechas.length - 1]! });
    if (col.costoConversacion === null) continue;
    if (mejor === null || mejor.costoConversacion === null || col.costoConversacion < mejor.costoConversacion) mejor = col;
  }
  return { mejor, considerados };
}

export function resumenMercadoMeta(rankings: ReadonlyArray<RankingAnuncio>): MercadoMeta | null {
  if (!rankings.length) return null;
  const conDato = rankings.filter((r) => r.interaccion !== "sin_dato" || r.conversion !== "sin_dato");
  const inferior = conDato.filter((r) => ES_INFERIOR(r.interaccion) || ES_INFERIOR(r.conversion)).length;
  const mejor = conDato.filter((r) => (r.interaccion === "superior" || r.conversion === "superior") && !ES_INFERIOR(r.interaccion) && !ES_INFERIOR(r.conversion)).length;
  return {
    fecha: rankings.map((r) => r.fecha).sort().at(-1)!,
    anunciosConDato: conDato.length,
    mejor,
    igual: conDato.length - inferior - mejor,
    inferior,
    sinDato: rankings.length - conDato.length,
  };
}

export function construirComparativa(base: ReadonlyArray<InsightRow>, ventanas: { reciente: Rango; previa: Rango }, rankings: ReadonlyArray<RankingAnuncio>): Comparativa {
  const en = (r: Rango) => base.filter((f) => f.fecha >= r.desde && f.fecha <= r.hasta);
  const mm = mejorMes(base);
  return {
    tu: columna("últimos 14 días", en(ventanas.reciente), ventanas.reciente),
    anterior: columna("14 días anteriores", en(ventanas.previa), ventanas.previa),
    mejorMes: mm.mejor,
    mesesConsiderados: mm.considerados,
    mercadoMeta: resumenMercadoMeta(rankings),
  };
}
