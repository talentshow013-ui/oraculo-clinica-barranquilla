/**
 * Cualquier periodo de pauta (un mes, unas fechas, los últimos N días) y la comparación entre dos, por
 * cuenta y por campaña. Los datos llegan sumados del periodo desde la API de Meta (`npm run periodo`),
 * sin depender de cuánto historial tenga `datos/lote.json`. Resultado = columna «Resultados» de Meta.
 */
import { sumarDias } from "@/lib/format/fechas";

export interface FilaPeriodo {
  cuenta: string;
  campanaId: string;
  campana: string;
  gasto: number;
  resultados: number;
  /** conversacion, lead, compra; null = el objetivo no da frutos (tráfico, alcance…). */
  tipoResultado: string | null;
  impresiones: number;
  clics: number;
}

export interface Cifras {
  gasto: number;
  resultados: number;
  costoPorResultado: number | null;
  impresiones: number;
  ctr: number | null;
}

export interface CampanaComparada {
  cuenta: string;
  campanaId: string;
  campana: string;
  a: Cifras | null;
  b: Cifras | null;
}

export interface Comparacion {
  a: Cifras;
  b: Cifras;
  porCuenta: { cuenta: string; a: Cifras; b: Cifras }[];
  campanas: CampanaComparada[];
}

const ultimoDia = (anio: number, mes: number) => new Date(Date.UTC(anio, mes, 0)).getUTCDate();

/** «2026-05» → del 1 al último día; si es el mes en curso, hasta hoy. */
export function rangoDeMes(mes: string, hoy: string): { desde: string; hasta: string } {
  const [a, m] = mes.split("-").map(Number) as [number, number];
  const hasta = `${mes}-${String(ultimoDia(a, m)).padStart(2, "0")}`;
  return { desde: `${mes}-01`, hasta: hasta > hoy ? hoy : hasta };
}

/** Los últimos N días contando hoy. */
export function rangoUltimos(n: number, hoy: string): { desde: string; hasta: string } {
  return { desde: sumarDias(hoy, -(n - 1)), hasta: hoy };
}

export function sumar(filas: ReadonlyArray<FilaPeriodo>): Cifras {
  const gasto = filas.reduce((s, x) => s + x.gasto, 0);
  const resultados = filas.reduce((s, x) => s + (x.tipoResultado ? x.resultados : 0), 0);
  const impresiones = filas.reduce((s, x) => s + x.impresiones, 0);
  const clics = filas.reduce((s, x) => s + x.clics, 0);
  return { gasto, resultados, costoPorResultado: resultados ? Math.round(gasto / resultados) : null, impresiones, ctr: impresiones ? clics / impresiones : null };
}

export function compararPeriodos(a: ReadonlyArray<FilaPeriodo>, b: ReadonlyArray<FilaPeriodo>): Comparacion {
  const cuentas = [...new Set([...a, ...b].map((x) => x.cuenta))];
  const ids = new Map<string, { cuenta: string; campana: string }>();
  for (const x of [...b, ...a]) ids.set(x.campanaId, { cuenta: x.cuenta, campana: x.campana });
  const campanas: CampanaComparada[] = [...ids.entries()].map(([id, d]) => {
    const fa = a.filter((x) => x.campanaId === id);
    const fb = b.filter((x) => x.campanaId === id);
    return { campanaId: id, ...d, a: fa.length ? sumar(fa) : null, b: fb.length ? sumar(fb) : null };
  });
  campanas.sort((x, y) => (y.a?.gasto ?? 0) + (y.b?.gasto ?? 0) - ((x.a?.gasto ?? 0) + (x.b?.gasto ?? 0)));
  return {
    a: sumar(a),
    b: sumar(b),
    porCuenta: cuentas.map((c) => ({ cuenta: c, a: sumar(a.filter((x) => x.cuenta === c)), b: sumar(b.filter((x) => x.cuenta === c)) })),
    campanas,
  };
}
