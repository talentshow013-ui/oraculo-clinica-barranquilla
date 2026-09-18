/**
 * Pauta de Google Ads (Google Ads API, REST `googleAds:searchStream`), SOLO LECTURA: rendimiento
 * diario por campaña, grupo de anuncios y anuncio, con estados y textos de los anuncios de búsqueda.
 * Se mapea AL contrato (`InsightRow` con `fuente: "google"`, `Creativo`) y se guarda en
 * `datos/googleads.json`; la fuente de archivo lo fusiona con el lote como la cuenta
 * `ga_<customer_id>`. Credenciales solo en `.env` (token de desarrollador, cliente OAuth y token de
 * actualización). Nunca se llama a `mutate`: solo consultas GAQL.
 */
import type { Creativo, Estado, InsightRow, Nivel } from "@/lib/adapters/types";
import { clasificarAngulo, nivelConscienciaTexto } from "@/lib/competitive/angles";
import { detectarServicio } from "./radar.apify";

export const VERSION_GOOGLE_ADS = process.env.GOOGLE_ADS_API_VERSION || "v22";
const VENTANA = "Google Ads · atribución de la cuenta";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Json = any;
/** Ejecuta una consulta GAQL y devuelve todas las filas (`results` de todas las páginas del stream). */
export type ConsultaGoogle = (gaql: string) => Promise<Json[]>;

export interface CredencialesGoogleAds {
  developerToken: string;
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  /** Id del administrador (MCC) cuando se accede a través de uno; opcional. */
  loginCustomerId?: string;
}

export async function tokenDeAcceso(c: CredencialesGoogleAds, fetchFn: typeof fetch = fetch): Promise<string> {
  const r = await fetchFn("https://oauth2.googleapis.com/token", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ grant_type: "refresh_token", client_id: c.clientId, client_secret: c.clientSecret, refresh_token: c.refreshToken }).toString() });
  const json = (await r.json()) as { access_token?: string; error?: string; error_description?: string };
  if (!json.access_token) throw new Error(`Google no dio token de acceso: ${json.error_description ?? json.error ?? r.status}`);
  return json.access_token;
}

export function crearConsultaGoogle(c: CredencialesGoogleAds, customerId: string, accessToken: string, fetchFn: typeof fetch = fetch): ConsultaGoogle {
  return async (gaql) => {
    const cabeceras: Record<string, string> = { authorization: `Bearer ${accessToken}`, "developer-token": c.developerToken, "content-type": "application/json" };
    if (c.loginCustomerId) cabeceras["login-customer-id"] = c.loginCustomerId.replace(/-/g, "");
    const r = await fetchFn(`https://googleads.googleapis.com/${VERSION_GOOGLE_ADS}/customers/${customerId.replace(/-/g, "")}/googleAds:searchStream`, { method: "POST", headers: cabeceras, body: JSON.stringify({ query: gaql }) });
    const json = (await r.json()) as Json;
    if (!r.ok) {
      const e = Array.isArray(json) ? json[0]?.error : json?.error;
      const detalle = e?.details?.[0]?.errors?.[0]?.message ?? e?.message ?? r.statusText;
      throw new Error(`Google Ads respondió (${e?.status ?? r.status}): ${detalle}`);
    }
    return (Array.isArray(json) ? json : [json]).flatMap((trozo: Json) => trozo?.results ?? []);
  };
}

/** Cuentas a las que el usuario autorizado tiene acceso (ids sin guiones). */
export async function cuentasAccesibles(c: CredencialesGoogleAds, accessToken: string, fetchFn: typeof fetch = fetch): Promise<string[]> {
  const r = await fetchFn(`https://googleads.googleapis.com/${VERSION_GOOGLE_ADS}/customers:listAccessibleCustomers`, { headers: { authorization: `Bearer ${accessToken}`, "developer-token": c.developerToken } });
  const json = (await r.json()) as { resourceNames?: string[]; error?: { message?: string } };
  if (!r.ok) throw new Error(`Google Ads respondió: ${json.error?.message ?? r.status}`);
  return (json.resourceNames ?? []).map((n) => n.replace("customers/", ""));
}

// ---------------------------------------------------------------------------
// GAQL
// ---------------------------------------------------------------------------

const METRICAS = "metrics.cost_micros, metrics.impressions, metrics.clicks, metrics.conversions, metrics.all_conversions, metrics.interactions, metrics.video_views, metrics.engagements";

export function consultaGaql(nivel: Exclude<Nivel, "cuenta">, desde: string, hasta: string): string {
  const rango = `segments.date BETWEEN '${desde}' AND '${hasta}' AND metrics.cost_micros > 0`;
  if (nivel === "campana") return `SELECT campaign.id, campaign.name, campaign.status, campaign.advertising_channel_type, segments.date, ${METRICAS} FROM campaign WHERE ${rango}`;
  if (nivel === "conjunto") return `SELECT campaign.id, ad_group.id, ad_group.name, ad_group.status, segments.date, ${METRICAS} FROM ad_group WHERE ${rango}`;
  return `SELECT campaign.id, ad_group.id, ad_group_ad.status, ad_group_ad.ad.id, ad_group_ad.ad.name, ad_group_ad.ad.type, ad_group_ad.ad.final_urls, ad_group_ad.ad.responsive_search_ad.headlines, ad_group_ad.ad.responsive_search_ad.descriptions, ad_group_ad.ad.responsive_display_ad.headlines, ad_group_ad.ad.responsive_display_ad.descriptions, ad_group_ad.ad.video_responsive_ad.headlines, ad_group_ad.ad.video_responsive_ad.descriptions, segments.date, ${METRICAS} FROM ad_group_ad WHERE ${rango}`;
}

// ---------------------------------------------------------------------------
// Mapeo → contrato
// ---------------------------------------------------------------------------

const num = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : 0;
};
const numOpc = (v: unknown): number | null => (v === undefined || v === null ? null : Number.isFinite(Number(v)) ? Math.max(0, Number(v)) : null);

export function estadoGoogle(status: string | undefined): Estado {
  if (status === "PAUSED") return "pausado";
  if (status === "REMOVED") return "archivado";
  return "activo";
}

const textos = (lista: Json): string[] => (Array.isArray(lista) ? lista.map((x: Json) => String(x?.text ?? "")).filter(Boolean) : []);

function titularesDe(ad: Json): { titulares: string[]; descripciones: string[] } {
  const a = ad?.responsiveSearchAd ?? ad?.responsiveDisplayAd ?? ad?.videoResponsiveAd ?? {};
  return { titulares: textos(a.headlines), descripciones: textos(a.descriptions) };
}

export function mapearFilaGoogle(fila: Json, nivel: Exclude<Nivel, "cuenta">, customerId: string): InsightRow {
  const m = fila.metrics ?? {};
  const ad = fila.adGroupAd?.ad;
  const id = nivel === "campana" ? fila.campaign?.id : nivel === "conjunto" ? fila.adGroup?.id : ad?.id;
  const { titulares } = titularesDe(ad);
  const nombre = nivel === "campana" ? fila.campaign?.name : nivel === "conjunto" ? fila.adGroup?.name : (ad?.name || titulares[0] || `Anuncio ${id}`);
  const padreId = nivel === "campana" ? null : nivel === "conjunto" ? fila.campaign?.id : fila.adGroup?.id;
  const estado = estadoGoogle(nivel === "campana" ? fila.campaign?.status : nivel === "conjunto" ? fila.adGroup?.status : fila.adGroupAd?.status);
  const clics = num(m.clicks);
  return {
    fuente: "google",
    fecha: String(fila.segments?.date ?? ""),
    nivel,
    id: String(id ?? ""),
    nombre: String(nombre ?? id ?? ""),
    padreId: padreId == null ? null : String(padreId),
    cuentaId: `ga_${customerId.replace(/-/g, "")}`,
    objetivo: fila.campaign?.advertisingChannelType ?? null,
    estado,
    gasto: Math.round(num(m.costMicros) / 1e6),
    impresiones: num(m.impressions),
    alcance: null,
    frecuencia: null,
    subastasGanadas: null,
    pujaPromedio: null,
    clics,
    clicsEnlace: clics,
    clicsUnicos: null,
    interacciones: numOpc(m.interactions),
    reacciones: null,
    comentarios: null,
    compartidos: null,
    guardados: null,
    visitasPerfil: null,
    seguidoresNuevos: null,
    vistasLandingPage: null,
    reproducciones: numOpc(m.videoViews),
    reproducciones2s: null,
    reproducciones3s: null,
    reproducciones6s: null,
    reproduccionesThru: null,
    p25: null,
    p50: null,
    p75: null,
    p95: null,
    p100: null,
    tiempoReproduccionTotal: null,
    duracionCreativoSeg: null,
    conversacionesIniciadas: null,
    conversacionesRespondidas: null,
    resultados: Math.round(num(m.conversions)),
    tipoResultado: "conversion",
    valorConversion: null,
    ventanaAtribucion: VENTANA,
  };
}

export function mapearCreativosGoogle(anuncios: ReadonlyArray<Json>, insights: ReadonlyArray<InsightRow>): Creativo[] {
  const vistos = new Set<string>();
  const salida: Creativo[] = [];
  for (const aga of anuncios) {
    const ad = aga?.ad ?? aga;
    const id = String(ad?.id ?? "");
    if (!id || vistos.has(id)) continue;
    vistos.add(id);
    const filas = insights.filter((i) => i.nivel === "anuncio" && i.id === id);
    if (!filas.length) continue;
    const { titulares, descripciones } = titularesDe(ad);
    const titular = titulares.length ? titulares.slice(0, 3).join(" · ") : null;
    const copy = descripciones.join(" ") || (ad?.name ?? "") || titular || "";
    const total = `${titular ?? ""} ${copy}`.trim();
    const angulo = clasificarAngulo(total);
    const conGasto = filas.filter((f) => f.gasto > 0).map((f) => f.fecha).sort();
    salida.push({
      id,
      anuncioId: id,
      formato: /VIDEO/.test(String(ad?.type ?? "")) ? "video" : "imagen",
      urlMiniatura: null,
      copyPrincipal: copy,
      titular,
      descripcion: null,
      cta: null,
      urlDestino: Array.isArray(ad?.finalUrls) && ad.finalUrls[0] ? String(ad.finalUrls[0]) : null,
      fechaPrimerGasto: conGasto[0] ?? (filas.map((f) => f.fecha).sort()[0] ?? "2000-01-01"),
      diasActivo: new Set(conGasto).size,
      servicio: detectarServicio(total),
      anguloDetectado: angulo.angulo,
      nivelConsciencia: nivelConscienciaTexto(total),
      confianzaClasificacion: angulo.confianza,
      senalesDeteccion: angulo.senales,
    });
  }
  return salida;
}

export interface LoteGoogleAds {
  insights: InsightRow[];
  creativos: Creativo[];
  meta: { cuentaId: string; capturadoEn: string; desde: string; hasta: string; origen: "google"; avisos: string[] };
}

export interface OpcionesGoogleAds {
  consultar: ConsultaGoogle;
  customerId: string;
  desde: string;
  hasta: string;
  ahora?: string;
}

export async function sincronizarGoogleAds(o: OpcionesGoogleAds): Promise<LoteGoogleAds> {
  const insights: InsightRow[] = [];
  const anuncios: Json[] = [];
  for (const nivel of ["campana", "conjunto", "anuncio"] as const) {
    const filas = await o.consultar(consultaGaql(nivel, o.desde, o.hasta));
    for (const f of filas) {
      insights.push(mapearFilaGoogle(f, nivel, o.customerId));
      if (nivel === "anuncio" && f.adGroupAd) anuncios.push(f.adGroupAd);
    }
  }
  return { insights, creativos: mapearCreativosGoogle(anuncios, insights), meta: { cuentaId: `ga_${o.customerId.replace(/-/g, "")}`, capturadoEn: o.ahora ?? new Date().toISOString(), desde: o.desde, hasta: o.hasta, origen: "google", avisos: [] } };
}

export function fusionarGoogleAds(viejo: LoteGoogleAds | null, nuevo: LoteGoogleAds): LoteGoogleAds {
  if (!viejo) return nuevo;
  const fuera = (i: InsightRow) => i.fecha < nuevo.meta.desde || i.fecha > nuevo.meta.hasta;
  const insights = [...viejo.insights.filter(fuera), ...nuevo.insights].sort((a, b) => a.fecha.localeCompare(b.fecha) || a.nivel.localeCompare(b.nivel) || a.id.localeCompare(b.id));
  const creativos = new Map(viejo.creativos.map((c) => [c.id, c]));
  for (const c of nuevo.creativos) creativos.set(c.id, c);
  return { insights, creativos: [...creativos.values()], meta: { ...nuevo.meta, desde: viejo.meta.desde < nuevo.meta.desde ? viejo.meta.desde : nuevo.meta.desde, hasta: viejo.meta.hasta > nuevo.meta.hasta ? viejo.meta.hasta : nuevo.meta.hasta } };
}
