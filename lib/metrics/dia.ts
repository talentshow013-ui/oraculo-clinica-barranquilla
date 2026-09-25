/**
 * Gasto y resultados de un día (hoy y el anterior), por cuenta y por campaña. Responde «¿cuánto
 * llevamos hoy?» con las filas de campaña del lote; el resultado es la columna «Resultados» de
 * cada plataforma. Costo por resultado = gasto ÷ resultados (null si no hubo resultados).
 */
import type { InsightRow } from "@/lib/adapters/types";
import { sumarDias } from "@/lib/format/fechas";
import { agregar, cpa } from "./core";

export interface CifrasDia {
  gasto: number;
  resultados: number;
  costoPorResultado: number | null;
}
export interface ResumenCuentaDia {
  nombre: string;
  hoy: CifrasDia;
  ayer: CifrasDia;
  campanas: ({ nombre: string } & CifrasDia)[];
}
export interface ResumenDia {
  fecha: string;
  cuentas: ResumenCuentaDia[];
  total: { hoy: CifrasDia; ayer: CifrasDia };
}

const cifras = (filas: ReadonlyArray<InsightRow>): CifrasDia => {
  const a = agregar(filas);
  return { gasto: a.gasto, resultados: a.resultados, costoPorResultado: cpa(a) };
};

export function resumenDelDia(cuentas: ReadonlyArray<{ nombre: string; insights: ReadonlyArray<InsightRow> }>, fecha: string): ResumenDia {
  const anterior = sumarDias(fecha, -1);
  const deCampana = (x: ReadonlyArray<InsightRow>, d: string) => x.filter((f) => f.nivel === "campana" && f.fecha === d);
  const todasHoy: InsightRow[] = [];
  const todasAyer: InsightRow[] = [];
  const salida = cuentas.map(({ nombre, insights }) => {
    const hoy = deCampana(insights, fecha);
    const ayer = deCampana(insights, anterior);
    todasHoy.push(...hoy);
    todasAyer.push(...ayer);
    const porCampana = new Map<string, InsightRow[]>();
    for (const f of hoy) porCampana.set(f.id, [...(porCampana.get(f.id) ?? []), f]);
    const campanas = [...porCampana.values()].map((fs) => ({ nombre: fs[fs.length - 1]!.nombre, ...cifras(fs) })).sort((a, b) => b.gasto - a.gasto);
    return { nombre, hoy: cifras(hoy), ayer: cifras(ayer), campanas };
  });
  return { fecha, cuentas: salida, total: { hoy: cifras(todasHoy), ayer: cifras(todasAyer) } };
}
