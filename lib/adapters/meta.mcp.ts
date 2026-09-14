/**
 * Mapeo del conector oficial de Meta (mcp.facebook.com/ads, herramienta ads_get_ad_entities) al
 * contrato. Cada fila del conector es una entidad × un día (con `time_increment: "1"`), con los
 * números como texto («$ 29.733.426 COP», «98765», «1.82»), los ausentes como null o «Not
 * available», y el resultado como {indicator, value} donde el indicador dice de qué tipo es.
 *
 * Reglas: solo crudos; lo que no viene es null; lo único derivado es tiempoReproduccionTotal
 * (= promedio por reproducción × reproducciones) y se declara aquí. Nada se estima.
 */
import type { BreakdownRow, Dimension, Estado, InsightRow } from "./types";

export type ValorCrudo = string | number | null | undefined;
export interface ResultadoCrudo {
  indicator?: string | null;
  value?: ValorCrudo;
  /** Forma alterna del conector: una entrada por ventana de atribución; se toma la primera. */
  values?: Array<{ attribution_windows?: string[]; value?: ValorCrudo }> | null;
}
/** Fila tal cual llega; los campos que no pedimos simplemente no están. */
export type FilaMetaCruda = Record<string, ValorCrudo | ResultadoCrudo>;

const VENTANA_POR_DEFECTO = "7d_click_1d_view";

export function pesosMeta(v: ValorCrudo): number {
  if (v === null || v === undefined || v === "") return 0;
  if (typeof v === "number") return v;
  const t = v.replace(/ /g, " ").trim();
  if (/USD|EUR|MXN|USD$/.test(t) && !/COP/.test(t)) throw new Error(`Moneda distinta de COP en el conector: «${t}». No se mezclan monedas.`);
  const limpio = t.replace(/COP|\$|\s/g, "").replace(/\./g, "").replace(",", ".");
  const n = Number(limpio);
  if (!Number.isFinite(n)) throw new Error(`Monto ilegible del conector: «${v}»`);
  return Math.round(n);
}

export function numeroMeta(v: ValorCrudo): number | null {
  if (v === null || v === undefined) return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  const t = v.replace(/ /g, " ").trim();
  if (t === "" || /not available/i.test(t)) return null;
  const n = Number(t.replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}

const entero = (v: ValorCrudo): number | null => {
  const n = numeroMeta(v);
  return n === null ? null : Math.round(n);
};

/** Tipo de resultado en palabras del contrato a partir del indicador del conector. */
function tipoDesdeIndicador(indicator: string | null | undefined): string | null {
  if (!indicator) return null;
  const cola = indicator.split(":").pop() ?? indicator;
  if (/messaging_conversation_started|messaging_first_reply|total_messaging_connection/.test(cola)) return "conversacion";
  if (/^lead$|lead_grouped|leadgen/.test(cola)) return "lead";
  if (/purchase/.test(cola)) return "compra";
  return cola.replace(/^onsite_conversion\./, "").replace(/^offsite_conversion\./, "");
}

export function resultadoMeta(r: ResultadoCrudo | ValorCrudo): { valor: number | null; tipo: string | null } {
  if (r === null || r === undefined) return { valor: null, tipo: null };
  if (typeof r !== "object") return { valor: entero(r), tipo: null };
  const crudo = r.value !== undefined ? r.value : r.values?.[0]?.value;
  return { valor: entero(crudo), tipo: tipoDesdeIndicador(r.indicator) };
}

export function estadoMeta(status: ValorCrudo, effective: ValorCrudo): Estado {
  const e = String(effective ?? "").toUpperCase();
  if (e === "PENDING_REVIEW" || e === "PREAPPROVED") return "en_revision";
  if (e === "DISAPPROVED") return "rechazado";
  const s = String(status ?? "").toUpperCase();
  if (s === "PAUSED") return "pausado";
  if (s === "ARCHIVED" || s === "DELETED") return "archivado";
  return "activo";
}

export interface ContextoFila {
  cuentaId: string;
  nivel: "campana" | "conjunto" | "anuncio";
}

const texto = (v: ValorCrudo | ResultadoCrudo): string | null => (typeof v === "string" && v.trim() !== "" ? v : typeof v === "number" ? String(v) : null);
const campo = (f: FilaMetaCruda, k: string): ValorCrudo => {
  const v = f[k];
  return typeof v === "object" && v !== null ? null : v;
};

export function mapearFilaMeta(f: FilaMetaCruda, ctx: ContextoFila): InsightRow {
  const resultado = resultadoMeta(f.results as ResultadoCrudo | ValorCrudo);
  const valorResultado = resultadoMeta(f.result_values as ResultadoCrudo | ValorCrudo).valor;
  const reproducciones = entero(campo(f, "video_play_actions"));
  const promedioSeg = numeroMeta(campo(f, "video_avg_time_watched_actions"));
  const padreId = ctx.nivel === "anuncio" ? texto(f.adset_id) : ctx.nivel === "conjunto" ? texto(f.campaign_id) : null;
  return {
    fuente: "meta",
    fecha: String(campo(f, "date_start") ?? ""),
    nivel: ctx.nivel,
    id: String(campo(f, "id") ?? ""),
    nombre: texto(f.name) ?? String(campo(f, "id") ?? ""),
    padreId,
    cuentaId: ctx.cuentaId,
    objetivo: texto(f.objective),
    estado: estadoMeta(campo(f, "status"), campo(f, "effective_status")),
    gasto: pesosMeta(campo(f, "amount_spent")),
    impresiones: entero(campo(f, "impressions")) ?? 0,
    alcance: entero(campo(f, "reach")),
    frecuencia: numeroMeta(campo(f, "frequency")),
    subastasGanadas: null,
    pujaPromedio: null,
    clics: entero(campo(f, "clicks")) ?? 0,
    clicsEnlace: entero(campo(f, "link_click")) ?? 0,
    clicsUnicos: entero(campo(f, "unique_link_click")),
    interacciones: entero(campo(f, "post_engagement")),
    reacciones: entero(campo(f, "post_reaction")),
    comentarios: entero(campo(f, "comment")),
    compartidos: entero(campo(f, "post_shares")),
    guardados: entero(campo(f, "post_save")),
    visitasPerfil: null,
    seguidoresNuevos: entero(campo(f, "instagram_profile_follow_v2")),
    vistasLandingPage: entero(campo(f, "omni_landing_page_view")),
    reproducciones,
    reproducciones2s: entero(campo(f, "video_continuous_2_sec_watched_actions")),
    reproducciones3s: entero(campo(f, "3_second_video_plays")),
    reproducciones6s: null,
    reproduccionesThru: entero(campo(f, "video_thruplay_watched_actions")),
    p25: entero(campo(f, "video_p25_watched_actions")),
    p50: entero(campo(f, "video_p50_watched_actions")),
    p75: entero(campo(f, "video_p75_watched_actions")),
    p95: entero(campo(f, "video_p95_watched_actions")),
    p100: entero(campo(f, "video_p100_watched_actions")),
    tiempoReproduccionTotal: reproducciones !== null && promedioSeg !== null ? Math.round(reproducciones * promedioSeg) : null,
    duracionCreativoSeg: null,
    conversacionesIniciadas: resultado.tipo === "conversacion" ? resultado.valor : null,
    conversacionesRespondidas: null,
    resultados: resultado.valor ?? 0,
    tipoResultado: resultado.tipo,
    valorConversion: valorResultado,
    ventanaAtribucion: VENTANA_POR_DEFECTO,
  };
}

export interface ContextoDesglose {
  cuentaId: string;
  dimension: Dimension;
  valorDe: (f: FilaMetaCruda) => string;
  /** «cuenta» (por defecto): una fila por segmento de toda la cuenta. «campana»: una fila por segmento y campaña (id = campaña). */
  nivel?: "cuenta" | "campana";
}

/**
 * Desglose: mismos campos + dimensión, valor y nRegistros (alcance; si no, impresiones/frecuencia).
 * A nivel campaña Meta sí entrega resultados por segmento (a nivel cuenta no, porque mezcla tipos).
 */
export function mapearDesgloseMeta(f: FilaMetaCruda, ctx: ContextoDesglose): BreakdownRow {
  const base = mapearFilaMeta(f, { cuentaId: ctx.cuentaId, nivel: "campana" });
  const alcance = base.alcance;
  const nRegistros = alcance !== null ? alcance : base.frecuencia && base.frecuencia > 0 ? Math.round(base.impresiones / base.frecuencia) : Math.round(base.impresiones / 1.4);
  const porCampana = ctx.nivel === "campana";
  return {
    ...base,
    nivel: porCampana ? "campana" : "cuenta",
    id: porCampana ? base.id : ctx.cuentaId,
    nombre: porCampana ? base.nombre : "Cuenta",
    padreId: null,
    dimension: ctx.dimension,
    valor: ctx.valorDe(f),
    nRegistros,
  };
}

/** El archivo crudo del conector: {ad_entities: "<json>", pagination?} o directamente un arreglo. */
export function parsearRespuesta(texto: string): { filas: FilaMetaCruda[]; siguiente: string | null } {
  const crudo: unknown = JSON.parse(texto);
  if (Array.isArray(crudo)) return { filas: crudo as FilaMetaCruda[], siguiente: null };
  const obj = crudo as { ad_entities?: unknown; pagination?: { next_cursor?: string | null } | null; next_cursor?: string | null };
  const entidades = typeof obj.ad_entities === "string" ? (JSON.parse(obj.ad_entities) as unknown) : obj.ad_entities;
  const filas = Array.isArray(entidades) ? (entidades as FilaMetaCruda[]) : [];
  const siguiente = obj.pagination?.next_cursor ?? obj.next_cursor ?? null;
  return { filas, siguiente: siguiente || null };
}
