/**
 * Pauta de TikTok (TikTok Marketing API v1.3), SOLO LECTURA: informes diarios por campaña,
 * conjunto (ad group) y anuncio, estados y textos de los anuncios. Se mapea AL contrato
 * (`InsightRow` con `fuente: "tiktok"`, `Creativo`) y se guarda en `datos/tiktok.json`; la fuente de
 * archivo lo fusiona con el lote de Meta al leerlo, así todas las pantallas lo ven como una cuenta
 * más (`tt_<advertiser_id>`). El token vive solo en `.env` (`TIKTOK_ACCESS_TOKEN`).
 *
 * Nunca se llama a un endpoint que cambie algo (status/update, create…): solo `report/…/get`,
 * `campaign/get`, `adgroup/get`, `ad/get`.
 */
import type { Creativo, Estado, InsightRow, Nivel } from "@/lib/adapters/types";
import { clasificarAngulo, nivelConscienciaTexto } from "@/lib/competitive/angles";
import { detectarServicio } from "./radar.apify";

export const URL_TIKTOK = "https://business-api.tiktok.com/open_api/v1.3/";
const PAGINA = 1000;
const VENTANA = "TikTok · 7 d clic · 1 d vista";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Json = any;
/** GET a la API de TikTok con el token en la cabecera; devuelve el JSON completo (con `code`). */
export type PeticionTikTok = (ruta: string, params: Record<string, string | number>) => Promise<Json>;

export function crearPeticionTikTok(token: string, fetchFn: typeof fetch = fetch): PeticionTikTok {
  return async (ruta, params) => {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) q.set(k, String(v));
    const r = await fetchFn(`${URL_TIKTOK}${ruta}?${q.toString()}`, { headers: { "Access-Token": token } });
    return (await r.json()) as Json;
  };
}

const NIVEL_TIKTOK: Record<Nivel, string> = { cuenta: "AUCTION_ADVERTISER", campana: "AUCTION_CAMPAIGN", conjunto: "AUCTION_ADGROUP", anuncio: "AUCTION_AD" };
const DIMENSION: Record<Nivel, string> = { cuenta: "advertiser_id", campana: "campaign_id", conjunto: "adgroup_id", anuncio: "ad_id" };
const METRICAS = ["spend", "impressions", "reach", "frequency", "clicks", "conversion", "result", "video_play_actions", "video_watched_2s", "video_watched_6s", "video_views_p25", "video_views_p50", "video_views_p75", "video_views_p100", "likes", "comments", "shares", "profile_visits", "follows", "campaign_id", "campaign_name", "adgroup_id", "adgroup_name", "ad_name", "objective_type"];

const num = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : 0;
};
const numOpc = (v: unknown): number | null => (v === undefined || v === null || v === "" || v === "-" ? null : Number.isFinite(Number(v)) ? Math.max(0, Number(v)) : null);

export function estadoTikTok(operationStatus: string | undefined, secondary?: string): Estado {
  if ((secondary && /DELETE/i.test(secondary)) || operationStatus === "DELETE") return "archivado";
  if (operationStatus === "DISABLE") return "pausado";
  return "activo";
}

function tipoResultado(objetivo: string | undefined): string {
  const o = (objetivo ?? "").toUpperCase();
  if (/LEAD/.test(o)) return "lead";
  if (/MESSAG|CONVERSATION/.test(o)) return "conversacion";
  if (/TRAFFIC/.test(o)) return "clic";
  if (/REACH|VIDEO_VIEW|ENGAGEMENT/.test(o)) return "interaccion";
  return "conversion";
}

/** Una fila de `report/integrated/get` → InsightRow. `estados` = operation_status por id (de campaign/adgroup/ad get). */
export function mapearFilaTikTok(fila: Json, nivel: Nivel, advertiserId: string, estados: Record<string, string>): InsightRow {
  const d = fila.dimensions ?? {};
  const m = fila.metrics ?? {};
  const id = String(d[DIMENSION[nivel]] ?? "");
  const nombre = nivel === "campana" ? m.campaign_name : nivel === "conjunto" ? m.adgroup_name : nivel === "anuncio" ? m.ad_name : `TikTok ${advertiserId}`;
  const padreId = nivel === "conjunto" ? (m.campaign_id ?? null) : nivel === "anuncio" ? (m.adgroup_id ?? null) : null;
  const tipo = tipoResultado(m.objective_type);
  const resultados = num(m.conversion ?? m.result);
  const reacciones = numOpc(m.likes);
  const comentarios = numOpc(m.comments);
  const compartidos = numOpc(m.shares);
  const partes = [reacciones, comentarios, compartidos].filter((x): x is number => x != null);
  return {
    fuente: "tiktok",
    fecha: String(d.stat_time_day ?? "").slice(0, 10),
    nivel,
    id,
    nombre: String(nombre ?? id),
    padreId: padreId == null ? null : String(padreId),
    cuentaId: `tt_${advertiserId}`,
    objetivo: m.objective_type ?? null,
    estado: estadoTikTok(estados[id]),
    gasto: num(m.spend),
    impresiones: num(m.impressions),
    alcance: numOpc(m.reach),
    frecuencia: numOpc(m.frequency),
    subastasGanadas: null,
    pujaPromedio: null,
    clics: num(m.clicks),
    clicsEnlace: num(m.clicks),
    clicsUnicos: null,
    interacciones: partes.length ? partes.reduce((a, b) => a + b, 0) : null,
    reacciones,
    comentarios,
    compartidos,
    guardados: null,
    visitasPerfil: numOpc(m.profile_visits),
    seguidoresNuevos: numOpc(m.follows),
    vistasLandingPage: null,
    reproducciones: numOpc(m.video_play_actions),
    reproducciones2s: numOpc(m.video_watched_2s),
    reproducciones3s: null,
    reproducciones6s: numOpc(m.video_watched_6s),
    reproduccionesThru: null,
    p25: numOpc(m.video_views_p25),
    p50: numOpc(m.video_views_p50),
    p75: numOpc(m.video_views_p75),
    p95: null,
    p100: numOpc(m.video_views_p100),
    tiempoReproduccionTotal: null,
    duracionCreativoSeg: null,
    conversacionesIniciadas: tipo === "conversacion" ? resultados : null,
    conversacionesRespondidas: null,
    resultados: tipo === "clic" || tipo === "interaccion" ? 0 : resultados,
    tipoResultado: tipo,
    valorConversion: null,
    ventanaAtribucion: VENTANA,
  };
}

export interface AnuncioTikTok {
  ad_id: string;
  ad_name?: string | null;
  ad_text?: string | null;
  call_to_action?: string | null;
  landing_page_url?: string | null;
  video_id?: string | null;
  image_ids?: string[] | null;
  operation_status?: string;
}

export function mapearCreativosTikTok(anuncios: ReadonlyArray<AnuncioTikTok>, insights: ReadonlyArray<InsightRow>): Creativo[] {
  const salida: Creativo[] = [];
  for (const a of anuncios) {
    const filas = insights.filter((i) => i.nivel === "anuncio" && i.id === String(a.ad_id));
    if (!filas.length) continue;
    const copy = (a.ad_text ?? "").trim() || (a.ad_name ?? "").trim();
    const angulo = clasificarAngulo(copy);
    const conGasto = filas.filter((f) => f.gasto > 0).map((f) => f.fecha).sort();
    salida.push({
      id: String(a.ad_id),
      anuncioId: String(a.ad_id),
      formato: a.video_id ? "video" : "imagen",
      urlMiniatura: null,
      copyPrincipal: copy,
      titular: null,
      descripcion: null,
      cta: a.call_to_action ?? null,
      urlDestino: a.landing_page_url ?? null,
      fechaPrimerGasto: conGasto[0] ?? (filas.map((f) => f.fecha).sort()[0] ?? "2000-01-01"),
      diasActivo: new Set(conGasto).size,
      servicio: detectarServicio(copy),
      anguloDetectado: angulo.angulo,
      nivelConsciencia: nivelConscienciaTexto(copy),
      confianzaClasificacion: angulo.confianza,
      senalesDeteccion: angulo.senales,
    });
  }
  return salida;
}

export interface LoteTikTok {
  insights: InsightRow[];
  creativos: Creativo[];
  meta: { cuentaId: string; capturadoEn: string; desde: string; hasta: string; origen: "tiktok"; avisos: string[] };
}

export interface OpcionesTikTok {
  pedir: PeticionTikTok;
  advertiserId: string;
  desde: string;
  hasta: string;
  ahora?: string;
}

async function paginar(pedir: PeticionTikTok, ruta: string, params: Record<string, string | number>): Promise<Json[]> {
  const filas: Json[] = [];
  for (let page = 1; page <= 50; page++) {
    const json = await pedir(ruta, { ...params, page, page_size: PAGINA });
    if (json?.code !== 0) throw new Error(`TikTok respondió: ${json?.message ?? "error"} (código ${json?.code ?? "?"})`);
    filas.push(...(json.data?.list ?? []));
    if (page >= Number(json.data?.page_info?.total_page ?? 1)) break;
  }
  return filas;
}

export async function sincronizarTikTok(o: OpcionesTikTok): Promise<LoteTikTok> {
  const base = { advertiser_id: o.advertiserId };
  const estados: Record<string, string> = {};
  const anuncios: AnuncioTikTok[] = [];
  for (const [ruta, clave] of [["campaign/get/", "campaign_id"], ["adgroup/get/", "adgroup_id"], ["ad/get/", "ad_id"]] as const) {
    const campos = ruta === "ad/get/" ? ["ad_id", "ad_name", "ad_text", "call_to_action", "landing_page_url", "video_id", "image_ids", "operation_status", "secondary_status"] : [clave, "operation_status", "secondary_status"];
    for (const e of await paginar(o.pedir, ruta, { ...base, fields: JSON.stringify(campos) })) {
      estados[String(e[clave])] = e.secondary_status && /DELETE/i.test(String(e.secondary_status)) ? "DELETE" : String(e.operation_status ?? "");
      if (ruta === "ad/get/") anuncios.push(e as AnuncioTikTok);
    }
  }
  const insights: InsightRow[] = [];
  for (const nivel of ["campana", "conjunto", "anuncio"] as const) {
    const filas = await paginar(o.pedir, "report/integrated/get/", { ...base, report_type: "BASIC", data_level: NIVEL_TIKTOK[nivel], dimensions: JSON.stringify([DIMENSION[nivel], "stat_time_day"]), metrics: JSON.stringify(METRICAS), start_date: o.desde, end_date: o.hasta });
    for (const f of filas) {
      const r = mapearFilaTikTok(f, nivel, o.advertiserId, estados);
      if (r.estado === "archivado" && r.gasto === 0) continue;
      insights.push(r);
    }
  }
  return { insights, creativos: mapearCreativosTikTok(anuncios, insights), meta: { cuentaId: `tt_${o.advertiserId}`, capturadoEn: o.ahora ?? new Date().toISOString(), desde: o.desde, hasta: o.hasta, origen: "tiktok", avisos: [] } };
}

/** Une una captura nueva con la anterior: los días de la nueva reemplazan; los creativos, los más recientes. */
export function fusionarTikTok(viejo: LoteTikTok | null, nuevo: LoteTikTok): LoteTikTok {
  if (!viejo) return nuevo;
  const fuera = (i: InsightRow) => i.fecha < nuevo.meta.desde || i.fecha > nuevo.meta.hasta;
  const insights = [...viejo.insights.filter(fuera), ...nuevo.insights].sort((a, b) => a.fecha.localeCompare(b.fecha) || a.nivel.localeCompare(b.nivel) || a.id.localeCompare(b.id));
  const creativos = new Map(viejo.creativos.map((c) => [c.id, c]));
  for (const c of nuevo.creativos) creativos.set(c.id, c);
  return { insights, creativos: [...creativos.values()], meta: { ...nuevo.meta, desde: viejo.meta.desde < nuevo.meta.desde ? viejo.meta.desde : nuevo.meta.desde, hasta: viejo.meta.hasta > nuevo.meta.hasta ? viejo.meta.hasta : nuevo.meta.hasta } };
}
