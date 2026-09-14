/**
 * De los archivos crudos del conector de Meta al lote del panel.
 *
 * Los archivos viven en `datos/crudo/` y su nombre dice qué son:
 *   <cuentaId>__campana__<n>.json · <cuentaId>__conjunto__<n>.json · <cuentaId>__anuncio__<n>.json
 *   <cuentaId>__desglose-<edad|genero|ubicacion|hora|plataforma|dispositivo>__<n>.json
 * Cada uno es la respuesta de `ads_get_ad_entities` tal cual (o el arreglo de filas).
 * Las páginas se pueden solapar: se quitan duplicados por (nivel, id, fecha) y por segmento.
 * Lo que el conector no trae (creativos, embudo, competidores, experimentos) se conserva del
 * lote base si lo hay.
 */
import type { BreakdownRow, Dimension, InsightRow, LoteDatos } from "./types";
import { LoteDatosSchema } from "./types";
import { listarHuecos } from "@/lib/format/fechas";
import { mapearDesgloseMeta, mapearFilaMeta, parsearRespuesta, type FilaMetaCruda } from "./meta.mcp";

export interface ArchivoCrudo {
  nombre: string;
  contenido: string;
}

const NIVELES = new Set(["campana", "conjunto", "anuncio"]);

/** Cómo se lee cada dimensión del conector: qué campo trae y cómo se traduce al vocabulario del panel. */
const DIMENSIONES: Record<string, { dimension: Dimension; valorDe: (f: FilaMetaCruda) => string }> = {
  edad: { dimension: "edad", valorDe: (f) => String(f.age ?? "desconocido") },
  genero: {
    dimension: "genero",
    valorDe: (f) => {
      const g = String(f.gender ?? "").toLowerCase();
      return g === "female" ? "mujer" : g === "male" ? "hombre" : "desconocido";
    },
  },
  ubicacion: { dimension: "ubicacion", valorDe: (f) => String(f.region ?? f.city ?? f.country ?? "desconocido") },
  pais: { dimension: "pais", valorDe: (f) => String(f.country ?? "desconocido") },
  hora: {
    dimension: "hora",
    valorDe: (f) => {
      const h = String(f.hourly_stats_aggregated_by_advertiser_time_zone ?? f.hourly_stats_aggregated_by_audience_time_zone ?? "");
      const m = /^(\d{1,2}):/.exec(h);
      return m ? String(Number(m[1])) : "desconocido";
    },
  },
  plataforma: {
    dimension: "plataforma",
    valorDe: (f) => {
      const pos = String(f.platform_position ?? "").toLowerCase();
      const plat = String(f.publisher_platform ?? "").toLowerCase();
      if (pos && pos !== "unknown") return pos.startsWith(plat) ? pos : `${plat}_${pos}`;
      return plat || "desconocido";
    },
  },
  dispositivo: { dimension: "dispositivo", valorDe: (f) => String(f.impression_device ?? f.device_platform ?? "desconocido") },
};

function interpretarNombre(nombre: string): { cuentaId: string; tipo: string } | null {
  const base = nombre.replace(/^.*[\\/]/, "").replace(/\.json$/i, "");
  const partes = base.split("__");
  if (partes.length < 2) return null;
  return { cuentaId: partes[0]!, tipo: partes[1]! };
}

export interface ResultadoImportacion extends LoteDatos {
  resumen: { archivos: number; filasLeidas: number; insights: number; desgloses: number; cuentas: string[]; ignorados: string[] };
}

export function construirLoteDesdeCrudos(archivos: ReadonlyArray<ArchivoCrudo>, base?: LoteDatos, generadoEn: string = new Date().toISOString()): ResultadoImportacion {
  const insights = new Map<string, InsightRow>();
  const desgloses = new Map<string, BreakdownRow>();
  const cuentas = new Set<string>();
  const ignorados: string[] = [];
  let filasLeidas = 0;

  for (const a of archivos) {
    const meta = interpretarNombre(a.nombre);
    if (!meta) {
      ignorados.push(a.nombre);
      continue;
    }
    const { filas } = parsearRespuesta(a.contenido);
    filasLeidas += filas.length;
    cuentas.add(meta.cuentaId);
    if (NIVELES.has(meta.tipo)) {
      const nivel = meta.tipo as "campana" | "conjunto" | "anuncio";
      for (const f of filas) {
        const fila = mapearFilaMeta(f, { cuentaId: meta.cuentaId, nivel });
        if (!fila.fecha || !fila.id) continue;
        insights.set(`${nivel}|${fila.id}|${fila.fecha}`, fila);
      }
      continue;
    }
    const dim = meta.tipo.startsWith("desglose-") ? DIMENSIONES[meta.tipo.slice("desglose-".length)] : undefined;
    if (!dim) {
      ignorados.push(a.nombre);
      continue;
    }
    for (const f of filas) {
      const d = mapearDesgloseMeta(f, { cuentaId: meta.cuentaId, dimension: dim.dimension, valorDe: dim.valorDe });
      if (!d.fecha) continue;
      desgloses.set(`${meta.cuentaId}|${d.dimension}|${d.valor}|${d.fecha}`, d);
    }
  }

  const filas = [...insights.values()].sort((x, y) => x.fecha.localeCompare(y.fecha) || x.nivel.localeCompare(y.nivel) || x.id.localeCompare(y.id));
  const fechas = filas.map((f) => f.fecha);
  const desde = fechas.length ? fechas.reduce((a, b) => (a < b ? a : b)) : base?.meta.desde ?? "2000-01-01";
  const hasta = fechas.length ? fechas.reduce((a, b) => (a > b ? a : b)) : base?.meta.hasta ?? desde;
  const huecos = listarHuecos(desde, hasta, new Set(fechas));

  const lote: LoteDatos = {
    insights: filas,
    desgloses: [...desgloses.values()],
    creativos: base?.creativos ?? [],
    embudo: base?.embudo ?? [],
    competidores: base?.competidores ?? [],
    anunciosCompetencia: base?.anunciosCompetencia ?? [],
    experimentos: base?.experimentos ?? [],
    meta: {
      generadoEn,
      desde,
      hasta,
      origen: "archivo",
      huecos,
      advertencias: [
        "Conversaciones = resultados de las pautas de mensajes (el conector no separa respondidas).",
        ...(base?.meta.advertencias.filter((t) => /radar|competencia|Biblioteca/i.test(t)) ?? []),
      ],
    },
  };
  const validado = LoteDatosSchema.parse(lote);
  return { ...validado, resumen: { archivos: archivos.length, filasLeidas, insights: filas.length, desgloses: lote.desgloses.length, cuentas: [...cuentas], ignorados } };
}
