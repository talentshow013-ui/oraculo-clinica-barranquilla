/**
 * Utilidades compartidas por las reglas. Redacción en lenguaje de dueño de clínica.
 */
import type { Umbral } from "@/config/benchmarks";
import type { Evidencia } from "@/lib/diagnostics/engine";
import { cop, num, pct, ratio, VACIO } from "@/lib/format";

export const ev = (etiqueta: string, valor: string): Evidencia => ({ etiqueta, valor });
export const evPct = (etiqueta: string, v: number | null) => ev(etiqueta, pct(v));
export const evCop = (etiqueta: string, v: number | null) => ev(etiqueta, cop(v));
export const evNum = (etiqueta: string, v: number | null, d: 0 | 1 | 2 = 0) => ev(etiqueta, num(v, d));
export const evRatio = (etiqueta: string, v: number | null) => ev(etiqueta, ratio(v));

/** Nota estándar cuando el umbral usado todavía no está calibrado con la historia del cliente. */
export function notaUmbral(...umbrales: Umbral[]): string | undefined {
  const sinCalibrar = umbrales.filter((u) => !u.calibrado);
  if (sinCalibrar.length === 0) return undefined;
  return "El umbral usado es provisional y se ajustará con la historia de la cuenta.";
}

/** Redondea a pesos enteros; null se conserva. */
export function pesos(v: number | null): number | null {
  return v === null || !Number.isFinite(v) ? null : Math.round(v);
}

export { VACIO };
