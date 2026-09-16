/**
 * De los archivos crudos del conector de Meta al lote del panel.
 *
 * Los archivos viven en `datos/crudo/` y su nombre dice qué son:
 *   <cuentaId>__campana__<n>.json · <cuentaId>__conjunto__<n>.json · <cuentaId>__anuncio__<n>.json
 *   <cuentaId>__desglose-<edad|genero|ubicacion|hora|plataforma|dispositivo>__<n>.json           (nivel cuenta)
 *   <cuentaId>__desglose-<dim>__campana__<n>.json   (nivel campaña: trae resultados por segmento; sin fecha → la última del lote)
 *   <cuentaId>__creativo__<n>.json  (respuesta de `ads_get_creatives`; se cruza con los anuncios)
 *   <cuentaId>__ranking__<n>.json   (respuesta de `ads_insights_auction_ranking_benchmarks`, {capturado, result})
 *   <cuentaId>__bitacora-<categoria>__<n>.json (respuestas de `ads_account_get_activity_logs`, {ventanas:[{eventos}]})
 * Cada uno es la respuesta de `ads_get_ad_entities` tal cual (o el arreglo de filas).
 * Las páginas se pueden solapar: se quitan duplicados por (nivel, id, fecha) y por segmento.
 * Los creativos salen del cruce creativo × anuncio (un Creativo por anuncio que lo usa). Lo que el
 * conector no trae (embudo, competidores, experimentos) se conserva del lote base si lo hay.
 */
import type { BreakdownRow, CambioCuenta, Dimension, InsightRow, LoteDatos, RankingAnuncio } from "./types";
import { LoteDatosSchema } from "./types";
import { listarHuecos } from "@/lib/format/fechas";
import { mapearDesgloseMeta, mapearFilaMeta, parsearRespuesta, type FilaMetaCruda } from "./meta.mcp";
import { mapearCreativosMeta, parsearCreativos, type AnuncioParaCreativo, type CreativoMetaCrudo } from "./meta.creativos";
import { parsearRankingsMeta } from "./meta.rankings";
import { parsearBitacoraMeta } from "./meta.bitacora";

export interface ArchivoCrudo {
  nombre: string;
  contenido: string;
}

const NIVELES = new Set(["campana", "conjunto", "anuncio"]);

/** Cómo se lee cada dimensión del conector: qué campo trae y cómo se traduce al vocabulario del panel. */
const desconocido = (v: unknown): string => {
  const t = String(v ?? "").trim();
  return t === "" || /^unknown$/i.test(t) ? "desconocido" : t;
};

const DIMENSIONES: Record<string, { dimension: Dimension; valorDe: (f: FilaMetaCruda) => string }> = {
  edad: { dimension: "edad", valorDe: (f) => desconocido(f.age) },
  genero: {
    dimension: "genero",
    valorDe: (f) => {
      const g = String(f.gender ?? "").toLowerCase();
      return g === "female" ? "mujer" : g === "male" ? "hombre" : "desconocido";
    },
  },
  ubicacion: { dimension: "ubicacion", valorDe: (f) => desconocido(f.region ?? f.city ?? f.country) },
  pais: { dimension: "pais", valorDe: (f) => desconocido(f.country) },
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

function interpretarNombre(nombre: string): { cuentaId: string; tipo: string; porCampana: boolean } | null {
  const base = nombre.replace(/^.*[\\/]/, "").replace(/\.json$/i, "");
  const partes = base.split("__");
  if (partes.length < 2) return null;
  return { cuentaId: partes[0]!, tipo: partes[1]!, porCampana: partes[2] === "campana" };
}

export interface ResultadoImportacion extends LoteDatos {
  resumen: { archivos: number; filasLeidas: number; insights: number; desgloses: number; creativos: number; rankings: number; bitacora: number; cuentas: string[]; ignorados: string[] };
}

export function construirLoteDesdeCrudos(archivos: ReadonlyArray<ArchivoCrudo>, base?: LoteDatos, generadoEn: string = new Date().toISOString()): ResultadoImportacion {
  const insights = new Map<string, InsightRow>();
  const desgloses = new Map<string, BreakdownRow>();
  const creativosCrudos = new Map<string, CreativoMetaCrudo>();
  /** anuncio → creativo que usa y sus días con gasto (para fechaPrimerGasto/diasActivo). */
  const anunciosCreativo = new Map<string, AnuncioParaCreativo>();
  const cuentas = new Set<string>();
  const ignorados: string[] = [];
  const rankings = new Map<string, RankingAnuncio>();
  const bitacora = new Map<string, CambioCuenta>();
  let filasLeidas = 0;

  for (const a of archivos) {
    const meta = interpretarNombre(a.nombre);
    if (!meta) {
      ignorados.push(a.nombre);
      continue;
    }
    cuentas.add(meta.cuentaId);
    if (meta.tipo === "creativo") {
      const lista = parsearCreativos(a.contenido);
      filasLeidas += lista.length;
      for (const c of lista) if (c?.id) creativosCrudos.set(String(c.id), c);
      continue;
    }
    if (meta.tipo.startsWith("bitacora")) {
      const lista = parsearBitacoraMeta(a.contenido, meta.cuentaId);
      filasLeidas += lista.length;
      for (const c of lista) bitacora.set(`${c.cuentaId}|${c.fecha}|${c.hora}|${c.actor}|${c.objetoId}|${c.tipo}|${c.de ?? ""}|${c.a ?? ""}`, c);
      continue;
    }
    if (meta.tipo === "ranking") {
      const capturado = fechaCaptura(a.contenido) ?? generadoEn.slice(0, 10);
      const lista = parsearRankingsMeta(a.contenido, meta.cuentaId, capturado);
      filasLeidas += lista.length;
      for (const r of lista) rankings.set(`${r.cuentaId}|${r.anuncioId}`, r);
      continue;
    }
    const { filas } = parsearRespuesta(a.contenido);
    filasLeidas += filas.length;
    if (NIVELES.has(meta.tipo)) {
      const nivel = meta.tipo as "campana" | "conjunto" | "anuncio";
      for (const f of filas) {
        const fila = mapearFilaMeta(f, { cuentaId: meta.cuentaId, nivel });
        if (!fila.fecha || !fila.id) continue;
        insights.set(`${nivel}|${fila.id}|${fila.fecha}`, fila);
        if (nivel === "anuncio") {
          const creativeId = typeof f.creative_id === "string" || typeof f.creative_id === "number" ? String(f.creative_id) : null;
          const registro = anunciosCreativo.get(fila.id) ?? { id: fila.id, creativeId, fechas: [] };
          (registro.fechas as Array<{ fecha: string; gasto: number }>).push({ fecha: fila.fecha, gasto: fila.gasto });
          anunciosCreativo.set(fila.id, { ...registro, creativeId: registro.creativeId ?? creativeId });
        }
      }
      continue;
    }
    const dim = meta.tipo.startsWith("desglose-") ? DIMENSIONES[meta.tipo.slice("desglose-".length)] : undefined;
    if (!dim) {
      ignorados.push(a.nombre);
      continue;
    }
    for (const f of filas) {
      const d = mapearDesgloseMeta(f, { cuentaId: meta.cuentaId, dimension: dim.dimension, valorDe: dim.valorDe, nivel: meta.porCampana ? "campana" : "cuenta" });
      if (!d.id) continue;
      // Sin fecha (rango agregado) se estampa después con la última fecha del lote.
      desgloses.set(`${meta.cuentaId}|${d.nivel}|${d.id}|${d.dimension}|${d.valor}|${d.fecha}`, d);
    }
  }

  const filas = [...insights.values()].sort((x, y) => x.fecha.localeCompare(y.fecha) || x.nivel.localeCompare(y.nivel) || x.id.localeCompare(y.id));
  const fechas = filas.map((f) => f.fecha);
  const desde = fechas.length ? fechas.reduce((a, b) => (a < b ? a : b)) : base?.meta.desde ?? "2000-01-01";
  const hasta = fechas.length ? fechas.reduce((a, b) => (a > b ? a : b)) : base?.meta.hasta ?? desde;
  const huecos = listarHuecos(desde, hasta, new Set(fechas));
  const desglosesConFecha = [...desgloses.values()].map((d) => (d.fecha ? d : { ...d, fecha: hasta }));
  const creativos = creativosCrudos.size ? mapearCreativosMeta([...creativosCrudos.values()], [...anunciosCreativo.values()]) : (base?.creativos ?? []);

  const lote: LoteDatos = {
    insights: filas,
    desgloses: desglosesConFecha,
    creativos,
    embudo: base?.embudo ?? [],
    competidores: base?.competidores ?? [],
    anunciosCompetencia: base?.anunciosCompetencia ?? [],
    experimentos: base?.experimentos ?? [],
    rankings: rankings.size ? [...rankings.values()] : (base?.rankings ?? []),
    bitacora: bitacora.size ? [...bitacora.values()].sort((x, y) => `${x.fecha} ${x.hora}`.localeCompare(`${y.fecha} ${y.hora}`)) : (base?.bitacora ?? []),
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
  return { ...validado, resumen: { archivos: archivos.length, filasLeidas, insights: filas.length, desgloses: lote.desgloses.length, creativos: creativos.length, rankings: lote.rankings?.length ?? 0, bitacora: lote.bitacora?.length ?? 0, cuentas: [...cuentas], ignorados } };
}

/** Fecha de captura declarada en el archivo crudo ({capturado: "YYYY-MM-DD"}), si la trae. */
function fechaCaptura(contenido: string): string | null {
  try {
    const obj = JSON.parse(contenido) as { capturado?: unknown };
    return typeof obj.capturado === "string" && /^\d{4}-\d{2}-\d{2}$/.test(obj.capturado) ? obj.capturado : null;
  } catch {
    return null;
  }
}
