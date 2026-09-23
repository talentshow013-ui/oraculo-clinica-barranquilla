/**
 * Pauta de Meta **directo a la Marketing API** con el token de `.env` (`META_ORGANICO_TOKEN`, que
 * ya trae `ads_read`). Sin conector, sin Claude de por medio: por eso funciona igual en el PC de la
 * clínica, en la VPS y en el reloj de las 6, 12 y 18.
 *
 * El número que manda es el de la columna **Resultados** del administrador: cada campaña según su
 * objetivo (mensajes → conversaciones iniciadas, formularios → leads, ventas → compras). Nunca se
 * suman acciones a mano ni se usa un campo que solo cuente formularios.
 */
import type { Estado, InsightRow } from "./types";
import { esFruto, resultadoMeta } from "./meta.mcp";

export const VENTANA_POR_DEFECTO = "7d_click_1d_view";
export const API = "https://graph.facebook.com/v25.0";

export const CAMPOS_INSIGHTS = [
  "date_start",
  "campaign_id",
  "campaign_name",
  "adset_id",
  "adset_name",
  "ad_id",
  "ad_name",
  "objective",
  "results",
  "spend",
  "impressions",
  "reach",
  "frequency",
  "clicks",
  "actions",
  "action_values",
  "video_play_actions",
  "video_thruplay_watched_actions",
  "video_p25_watched_actions",
  "video_p50_watched_actions",
  "video_p75_watched_actions",
  "video_p95_watched_actions",
  "video_p100_watched_actions",
  "video_avg_time_watched_actions",
] as const;

export interface AccionMeta {
  action_type: string;
  value: string | number;
}
export interface FilaInsight {
  date_start?: string;
  campaign_id?: string;
  campaign_name?: string;
  adset_id?: string;
  adset_name?: string;
  ad_id?: string;
  ad_name?: string;
  objective?: string;
  /** La columna «Resultados» del administrador: [{ indicator, values: [{ value }] }]; null si no hubo. */
  results?: { indicator?: string; value?: string | number; values?: { value?: string | number }[] }[] | null;
  spend?: string | number;
  impressions?: string | number;
  reach?: string | number;
  frequency?: string | number;
  clicks?: string | number;
  actions?: AccionMeta[];
  action_values?: AccionMeta[];
  video_play_actions?: AccionMeta[];
  video_thruplay_watched_actions?: AccionMeta[];
  video_p25_watched_actions?: AccionMeta[];
  video_p50_watched_actions?: AccionMeta[];
  video_p75_watched_actions?: AccionMeta[];
  video_p95_watched_actions?: AccionMeta[];
  video_p100_watched_actions?: AccionMeta[];
  video_avg_time_watched_actions?: AccionMeta[];
}

const num = (v: unknown): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};
const ent = (v: unknown): number | null => {
  const n = num(v);
  return n === null ? null : Math.round(n);
};

/** Valor de una acción por tipo; sin tipo, la primera (los campos de video traen una sola). */
export function accion(lista: ReadonlyArray<AccionMeta> | undefined, tipo?: string): number | null {
  if (!lista?.length) return null;
  const x = tipo ? lista.find((a) => a.action_type === tipo) : lista[0];
  return x ? ent(x.value) : null;
}

/** Igual que `accion`, pero sin redondear: los segundos promedio vienen con decimales. */
export function accionDecimal(lista: ReadonlyArray<AccionMeta> | undefined, tipo?: string): number | null {
  if (!lista?.length) return null;
  const x = tipo ? lista.find((a) => a.action_type === tipo) : lista[0];
  return x ? num(x.value) : null;
}
const primeraDe = (lista: ReadonlyArray<AccionMeta> | undefined, tipos: string[]): { valor: number; tipo: string } | null => {
  for (const t of tipos) {
    const v = accion(lista, t);
    if (v !== null) return { valor: v, tipo: t };
  }
  return null;
};

const CONVERSACION = ["onsite_conversion.messaging_conversation_started_7d", "onsite_conversion.total_messaging_connection", "onsite_conversion.messaging_first_reply"];
const LEAD = ["lead", "leadgen.other", "onsite_conversion.lead_grouped", "offsite_conversion.fb_pixel_lead"];
const COMPRA = ["purchase", "offsite_conversion.fb_pixel_purchase", "omni_purchase"];

/**
 * El resultado de la campaña según su objetivo, como la columna «Resultados»: si el objetivo busca
 * conversaciones, son las conversaciones (cero si hoy no hubo, no «sin dato»); si busca clientes
 * potenciales, el que aparezca (conversación o formulario); si busca ventas, las compras. Tráfico,
 * alcance e interacción no son frutos: `null` para que el motor no los mezcle.
 */
export function resultadoDeObjetivo(objetivo: string | null | undefined, acciones: ReadonlyArray<AccionMeta> | undefined): { valor: number | null; tipo: string | null } {
  const o = String(objetivo ?? "").toUpperCase();
  const conv = primeraDe(acciones, CONVERSACION);
  const lead = primeraDe(acciones, LEAD);
  const compra = primeraDe(acciones, COMPRA);
  if (/MESSAGES|MESSAGING/.test(o)) return { valor: conv?.valor ?? 0, tipo: "conversacion" };
  if (/SALES|CONVERSIONS|CATALOG/.test(o)) {
    if (compra) return { valor: compra.valor, tipo: "compra" };
    if (lead) return { valor: lead.valor, tipo: "lead" };
    return { valor: conv?.valor ?? 0, tipo: conv ? "conversacion" : "compra" };
  }
  if (/LEADS|LEAD_GENERATION/.test(o)) {
    if (conv) return { valor: conv.valor, tipo: "conversacion" };
    if (lead) return { valor: lead.valor, tipo: "lead" };
    return { valor: 0, tipo: "conversacion" };
  }
  /* objetivos que no dan frutos (tráfico, alcance, interacción, vídeo): si aun así hay conversaciones
     o leads, se cuentan; si no, no hay resultado que mostrar */
  const otro = conv ?? lead ?? compra;
  if (!otro) return { valor: null, tipo: null };
  return { valor: otro.valor, tipo: CONVERSACION.includes(otro.tipo) ? "conversacion" : LEAD.includes(otro.tipo) ? "lead" : "compra" };
}

export interface ContextoInsight {
  cuentaId: string;
  nivel: "campana" | "conjunto" | "anuncio";
  estado: Estado;
}

/** Una fila de la API al contrato de Oráculo. */
export function mapearInsightMeta(f: FilaInsight, ctx: ContextoInsight): InsightRow {
  const id = ctx.nivel === "anuncio" ? f.ad_id : ctx.nivel === "conjunto" ? f.adset_id : f.campaign_id;
  const nombre = ctx.nivel === "anuncio" ? f.ad_name : ctx.nivel === "conjunto" ? f.adset_name : f.campaign_name;
  const padreId = ctx.nivel === "anuncio" ? (f.adset_id ?? null) : ctx.nivel === "conjunto" ? (f.campaign_id ?? null) : null;
  /* manda la columna «Resultados» de Meta; si no viene (sin resultados en el día), se deduce del objetivo */
  const oficial = Array.isArray(f.results) && f.results[0] ? resultadoMeta(f.results[0] as Parameters<typeof resultadoMeta>[0]) : null;
  const res = oficial?.tipo ? { valor: esFruto(oficial.tipo) ? (oficial.valor ?? 0) : 0, tipo: oficial.tipo } : resultadoDeObjetivo(f.objective, f.actions);
  const reproducciones = accion(f.video_play_actions);
  const promedio = accionDecimal(f.video_avg_time_watched_actions);
  return {
    fuente: "meta",
    fecha: f.date_start ?? "",
    nivel: ctx.nivel,
    id: String(id ?? ""),
    nombre: nombre ?? String(id ?? ""),
    padreId,
    cuentaId: ctx.cuentaId,
    objetivo: f.objective ?? null,
    estado: ctx.estado,
    gasto: num(f.spend) ?? 0,
    impresiones: ent(f.impressions) ?? 0,
    alcance: ent(f.reach),
    frecuencia: num(f.frequency),
    subastasGanadas: null,
    pujaPromedio: null,
    clics: ent(f.clicks) ?? 0,
    clicsEnlace: accion(f.actions, "link_click") ?? 0,
    clicsUnicos: null,
    interacciones: accion(f.actions, "post_engagement"),
    reacciones: accion(f.actions, "post_reaction"),
    comentarios: accion(f.actions, "comment"),
    compartidos: accion(f.actions, "post"),
    guardados: accion(f.actions, "onsite_conversion.post_save"),
    visitasPerfil: accion(f.actions, "onsite_conversion.view_content"),
    seguidoresNuevos: null,
    vistasLandingPage: accion(f.actions, "omni_landing_page_view") ?? accion(f.actions, "landing_page_view"),
    reproducciones,
    reproducciones2s: null,
    reproducciones3s: accion(f.actions, "video_view"), // en Meta «video_view» son las reproducciones de 3 s
    reproducciones6s: null,
    reproduccionesThru: accion(f.video_thruplay_watched_actions),
    p25: accion(f.video_p25_watched_actions),
    p50: accion(f.video_p50_watched_actions),
    p75: accion(f.video_p75_watched_actions),
    p95: accion(f.video_p95_watched_actions),
    p100: accion(f.video_p100_watched_actions),
    tiempoReproduccionTotal: reproducciones !== null && promedio !== null ? Math.round(reproducciones * promedio) : null,
    duracionCreativoSeg: null,
    conversacionesIniciadas: res.tipo === "conversacion" ? res.valor : null,
    conversacionesRespondidas: null,
    resultados: res.valor ?? 0,
    tipoResultado: res.tipo,
    valorConversion: accion(f.action_values, "purchase") ?? accion(f.action_values, "offsite_conversion.fb_pixel_purchase"),
    ventanaAtribucion: VENTANA_POR_DEFECTO,
  };
}

/** Petición de insights día a día para una cuenta. `nivel` es el de Meta: campaign | adset | ad. */
export function urlInsights(cuentaId: string, nivel: "campaign" | "adset" | "ad", rango: { desde: string; hasta: string }, token: string, despues?: string): string {
  const p = new URLSearchParams({
    level: nivel,
    time_increment: "1",
    time_range: JSON.stringify({ since: rango.desde, until: rango.hasta }),
    fields: CAMPOS_INSIGHTS.join(","),
    action_attribution_windows: JSON.stringify(["7d_click", "1d_view"]),
    filtering: JSON.stringify([{ field: "spend", operator: "GREATER_THAN", value: 0 }]),
    limit: "500",
    access_token: token,
  });
  if (despues) p.set("after", despues);
  return `${API}/${cuentaId}/insights?${p.toString()}`;
}

/** Petición del estado (activo, pausado, rechazado…) de las entidades de un nivel. */
export function urlEntidades(cuentaId: string, nivel: "campaigns" | "adsets" | "ads", token: string, despues?: string): string {
  const p = new URLSearchParams({ fields: "id,name,status,effective_status", limit: "500", access_token: token });
  if (despues) p.set("after", despues);
  return `${API}/${cuentaId}/${nivel}?${p.toString()}`;
}

/** Estado del contrato a partir de `status` y `effective_status` de la API. */
export function estadoDeEntidad(status: string | undefined, efectivo: string | undefined): Estado {
  const e = String(efectivo ?? "").toUpperCase();
  if (e === "PENDING_REVIEW" || e === "PREAPPROVED") return "en_revision";
  if (e === "DISAPPROVED" || e === "ADSET_PAUSED_DISAPPROVED") return "rechazado";
  const s = String(status ?? "").toUpperCase();
  if (s === "PAUSED") return "pausado";
  if (s === "ARCHIVED" || s === "DELETED") return "archivado";
  return "activo";
}
