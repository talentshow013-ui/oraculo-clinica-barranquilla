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

// Alias y variantes usadas por la interfaz.
export const dias = (v: number | null | undefined) => (v === null || v === undefined || !Number.isFinite(v) ? VACIO : `${num(v)} d`);
export const minutos = (v: number | null | undefined) => (v === null || v === undefined || !Number.isFinite(v) ? VACIO : v < 60 ? `${num(v)} min` : `${num(v / 60, 1)} h`);
/** Cambio relativo con signo: 0.123 → "+12,3 %". */
export const conSigno = (v: number | null | undefined, decimales: 0 | 1 | 2 = 1) =>
  v === null || v === undefined || !Number.isFinite(v) ? VACIO : `${v > 0 ? "+" : v < 0 ? "−" : ""}${num(Math.abs(v) * 100, decimales)} %`;
/** Pesos abreviados para ejes y chips: 1.234.567 → "$ 1,2 M". */
export const copCorto = (v: number | null | undefined) =>
  v === null || v === undefined || !Number.isFinite(v) ? VACIO : Math.abs(v) >= 1e6 ? `$ ${num(v / 1e6, 1)} M` : Math.abs(v) >= 1e3 ? `$ ${num(v / 1e3)} k` : `$ ${num(v)}`;

import type { Unidad } from "@/lib/metrics/catalog";
/** Formatea según la unidad del catálogo. null → "—". */
export function formatear(valor: number | string | null | undefined, unidad: Unidad): string {
  if (valor === null || valor === undefined) return VACIO;
  if (typeof valor === "string") return valor;
  switch (unidad) {
    case "cop":
      return cop(valor);
    case "porcentaje":
      return pct(valor);
    case "ratio":
      return ratio(valor);
    case "segundos":
      return seg(valor);
    case "dias":
      return dias(valor);
    case "indice":
      return indice(valor);
    case "numero":
      return num(valor, Number.isInteger(valor) ? 0 : 1);
    default:
      return String(valor);
  }
}
