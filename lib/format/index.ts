/**
 * Formato para la interfaz: COP sin decimales, es-CO, `—` para lo desconocido.
 * Estado vacío ≠ estado cero.
 */

export const VACIO = "—";

const fmtCOP = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 });
const fmtNum = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 });
const fmtDec1 = new Intl.NumberFormat("es-CO", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const fmtDec2 = new Intl.NumberFormat("es-CO", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function cop(v: number | null | undefined): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return VACIO;
  return `$ ${fmtCOP.format(Math.round(v))}`;
}

export function num(v: number | null | undefined, decimales: 0 | 1 | 2 = 0): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return VACIO;
  if (decimales === 1) return fmtDec1.format(v);
  if (decimales === 2) return fmtDec2.format(v);
  return fmtNum.format(v);
}

/** 0.0913 → "9,1 %" */
export function pct(v: number | null | undefined, decimales: 0 | 1 | 2 = 1): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return VACIO;
  return `${num(v * 100, decimales)} %`;
}

/** 4 → "4,0x" */
export function ratio(v: number | null | undefined): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return VACIO;
  return `${fmtDec1.format(v)}x`;
}

/** Segundos → "12,5 s" */
export function seg(v: number | null | undefined): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return VACIO;
  return `${fmtDec1.format(v)} s`;
}

/** Índice 0-1 → "0,72" */
export function indice(v: number | null | undefined): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return VACIO;
  return fmtDec2.format(v);
}

/** Delta relativo → "+12,3 %" / "−4,0 %" */
export function deltaPct(v: number | null | undefined): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return VACIO;
  const signo = v > 0 ? "+" : v < 0 ? "−" : "";
  return `${signo}${num(Math.abs(v) * 100, 1)} %`;
}

export { hoyBogota, aFechaBogota, sumarDias, diasEntre, rangoDias, listarHuecos, semanaISO } from "./fechas";
