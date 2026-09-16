/**
 * Utilidades compartidas por las reglas. Redacción en lenguaje de dueño de clínica.
 */
import type { Umbral } from "@/config/benchmarks";
import type { Rango } from "@/lib/adapters/types";
import type { Evidencia, FuenteHallazgo } from "@/lib/diagnostics/engine";
import { cop, num, pct, ratio, VACIO } from "@/lib/format";
import { rutaAnuncio } from "@/lib/format/rutas";

export const ev = (etiqueta: string, valor: string, enlace?: string): Evidencia => (enlace ? { etiqueta, valor, enlace } : { etiqueta, valor });
export const evPct = (etiqueta: string, v: number | null, enlace?: string) => ev(etiqueta, pct(v), enlace);
export const evCop = (etiqueta: string, v: number | null, enlace?: string) => ev(etiqueta, cop(v), enlace);
export const evNum = (etiqueta: string, v: number | null, d: 0 | 1 | 2 = 0, enlace?: string) => ev(etiqueta, num(v, d), enlace);
export const evRatio = (etiqueta: string, v: number | null, enlace?: string) => ev(etiqueta, ratio(v), enlace);

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

/** Nombres de las fuentes en palabras de la clínica (nunca «API» ni «MCP»). */
export const ORIGEN = {
  anuncios: "Meta · rendimiento diario de cada anuncio",
  conjuntos: "Meta · rendimiento diario de cada conjunto de anuncios",
  campanas: "Meta · rendimiento diario de cada campaña",
  desglose: (dimension: string) => `Meta · desglose por ${dimension} de cada campaña (últimos 28 días)`,
  creativos: "Meta · texto, formato y fecha de arranque de cada anuncio",
  clinica: "Resultados anotados por la clínica en Campañas",
  radar: "Biblioteca de anuncios de Meta · radar de mercado",
  bitacora: "Meta · historial de cambios de la cuenta (quién prendió y apagó qué)",
  lote: "Todas las fuentes cargadas en el panel",
  nivel: (nivel: "anuncio" | "conjunto" | "campana" | "cuenta") =>
    nivel === "anuncio" ? ORIGEN.anuncios : nivel === "conjunto" ? ORIGEN.conjuntos : ORIGEN.campanas,
} as const;

/** Rango real que cubren unas filas con fecha; si no hay filas, el de respaldo. */
export function rangoDe(filas: ReadonlyArray<{ fecha: string }>, respaldo: Rango): Rango {
  if (!filas.length) return respaldo;
  let desde = filas[0]!.fecha;
  let hasta = desde;
  for (const f of filas) {
    if (f.fecha < desde) desde = f.fecha;
    if (f.fecha > hasta) hasta = f.fecha;
  }
  return { desde, hasta };
}

/** Los desgloses por campaña son 28 días agregados con la fecha del último día: el rango honesto son esos 28 días. */
export function rangoDesglose(filas: ReadonlyArray<{ fecha: string }>, respaldo: Rango): Rango {
  const r = rangoDe(filas, respaldo);
  const hastaMs = Date.parse(`${r.hasta}T00:00:00Z`);
  const desde = new Date(hastaMs - 27 * 86_400_000).toISOString().slice(0, 10);
  return { desde: r.desde < desde ? r.desde : desde, hasta: r.hasta };
}

/** Rutas del panel a las que apunta la evidencia. Cambiarlas aquí cambia todos los hallazgos. */
export const RUTA = {
  anuncio: rutaAnuncio,
  creativos: "/creativos",
  campana: (campanaId: string) => `/campanas#campana-${campanaId}`,
  campanas: "/campanas",
  hora: "/audiencias#hora",
  zona: "/audiencias#zona",
  edad: "/audiencias#edad",
  serie: "/rendimiento#serie",
  comparacion: "/rendimiento#comparacion",
  embudo: "/embudo",
  paso: (paso: string) => `/embudo#paso-${paso}`,
  radar: "/competencia",
  cadencia: "/competencia#cadencia",
  bitacora: "/campanas#bitacora",
  fuentes: "/fuentes",
} as const;

/** Arma la fuente de un hallazgo: origen en palabras, rango mirado, filas y método. */
export function fuenteDe(origen: string, rango: Rango, registros: number, metodo: string, enlace: string): FuenteHallazgo {
  return { origen, desde: rango.desde, hasta: rango.hasta, registros, metodo, enlace };
}

