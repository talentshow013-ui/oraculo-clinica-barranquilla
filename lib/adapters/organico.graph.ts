/**
 * Orgánico desde la Graph API de Meta (Instagram y Facebook sin pauta).
 *
 * Aquí se habla con `graph.facebook.com` directamente (el conector de anuncios no expone métricas
 * orgánicas). Todo se mapea AL contrato (`LoteOrganicoSchema`); si Meta retira una métrica, se
 * descarta con aviso en lenguaje de cliente y el resto sigue. El token vive solo en `.env`.
 *
 * Métricas por formato (Graph API v25, 2026): las «impresiones» están retiradas; lo que existe es
 * alcance (`reach` / `post_total_media_view_unique`) y vistas (`views` / `post_media_view`).
 */
import { aFechaBogota, sumarDias } from "@/lib/format/fechas";
import type { DiaOrganico, FormatoOrganico, LoteOrganico, PublicacionOrganica, RedOrganico } from "@/lib/adapters/types";

export const VERSION_GRAPH = "v25.0";
const ZONA = "America/Bogota";
const LARGO_TEXTO = 280;

/** Una petición GET a la Graph API: ruta relativa (`IG1/media`) y parámetros; devuelve el JSON. */
export type Peticion = (ruta: string, params: Record<string, string | number>) => Promise<GraphJson>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type GraphJson = any;

/** Fabrica la petición real con `fetch`. Los errores de Meta llegan con su mensaje (código incluido). */
export function crearPeticion(token: string, version = VERSION_GRAPH, fetchFn: typeof fetch = fetch): Peticion {
  return async (ruta, params) => {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) q.set(k, String(v));
    q.set("access_token", token);
    const r = await fetchFn(`https://graph.facebook.com/${version}/${ruta}?${q.toString()}`);
    const json = (await r.json()) as GraphJson;
    if (!r.ok || json?.error) {
      const e = json?.error ?? {};
      throw new Error(`(#${e.code ?? r.status}) ${e.message ?? r.statusText}`);
    }
    return json;
  };
}

// ---------------------------------------------------------------------------
// Formato
// ---------------------------------------------------------------------------

export function formatoIG(mediaType: string | null | undefined, productType: string | null | undefined): FormatoOrganico {
  if (productType === "REELS") return "reel";
  if (productType === "STORY") return "historia";
  if (mediaType === "CAROUSEL_ALBUM") return "carrusel";
  if (mediaType === "VIDEO") return "video";
  return "imagen";
}

export function formatoFB(statusType: string | null | undefined, adjunto: string | null | undefined): FormatoOrganico {
  const a = (adjunto ?? "").toLowerCase();
  if (a.includes("video") || statusType === "added_video") return "video";
  if (a === "album" || a.includes("multi")) return "carrusel";
  if (a === "photo" || statusType === "added_photos") return "imagen";
  if (a === "share" || statusType === "shared_story") return "enlace";
  return "texto";
}

// ---------------------------------------------------------------------------
// Métricas que Meta soporta por formato (sin impresiones: retiradas)
// ---------------------------------------------------------------------------

const IG_FEED = ["reach", "views", "total_interactions", "saved", "shares", "profile_visits", "follows"] as const;
const IG_REEL = ["reach", "views", "total_interactions", "saved", "shares", "ig_reels_avg_watch_time"] as const;
const IG_HISTORIA = ["reach", "views", "replies", "shares", "total_interactions", "profile_visits", "follows"] as const;
export const METRICAS_FB_POST = ["post_media_view", "post_total_media_view_unique", "post_clicks"] as const;

export function metricasIG(formato: FormatoOrganico): readonly string[] {
  if (formato === "reel") return IG_REEL;
  if (formato === "historia") return IG_HISTORIA;
  return IG_FEED;
}

/** Nombre de cada métrica en lenguaje de cliente (para los avisos de «Meta no entregó…»). */
export const NOMBRE_METRICA: Record<string, string> = {
  reach: "alcance",
  views: "vistas",
  total_interactions: "interacciones",
  saved: "guardados",
  shares: "compartidos",
  profile_visits: "visitas al perfil",
  follows: "seguidores ganados",
  replies: "respuestas",
  ig_reels_avg_watch_time: "segundos promedio de reproducción",
  post_media_view: "vistas",
  post_total_media_view_unique: "alcance",
  post_clicks: "clics",
  follower_count: "seguidores nuevos por día",
  page_follows: "seguidores por día",
  page_post_engagements: "interacciones por día",
  page_media_view: "vistas por día",
};

// ---------------------------------------------------------------------------
// Mapeo → contrato
// ---------------------------------------------------------------------------

function horaBogota(iso: string): string {
  const d = new Date(iso.replace(/([+-]\d{2})(\d{2})$/, "$1:$2"));
  const p = new Intl.DateTimeFormat("en-CA", { timeZone: ZONA, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(d);
  const v = (t: string) => p.find((x) => x.type === t)?.value ?? "00";
  return `${v("year")}-${v("month")}-${v("day")}T${v("hour") === "24" ? "00" : v("hour")}:${v("minute")}`;
}

function limpiarTexto(t: unknown): string {
  const s = String(t ?? "").replace(/\s+/g, " ").trim();
  const c = Array.from(s);
  return c.length > LARGO_TEXTO ? c.slice(0, LARGO_TEXTO).join("") + "…" : s;
}

const n = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : typeof v === "string" && v !== "" && Number.isFinite(Number(v)) ? Math.max(0, Number(v)) : null);

type Valores = Record<string, number>;

export function mapearMediaIG(m: GraphJson, ins: Valores): PublicacionOrganica {
  const formato = formatoIG(m.media_type, m.media_product_type);
  const v = (k: string) => (k in ins ? n(ins[k]) : null);
  return {
    id: String(m.id),
    red: "instagram",
    formato,
    publicadoEn: horaBogota(String(m.timestamp)),
    texto: limpiarTexto(m.caption),
    enlace: String(m.permalink ?? ""),
    urlMiniatura: m.thumbnail_url ?? (m.media_type === "IMAGE" || m.media_type === "CAROUSEL_ALBUM" ? (m.media_url ?? null) : null),
    alcance: v("reach"),
    vistas: v("views"),
    meGusta: n(m.like_count),
    comentarios: n(m.comments_count),
    compartidos: v("shares"),
    guardados: v("saved"),
    interacciones: v("total_interactions"),
    visitasPerfil: v("profile_visits"),
    seguidoresGanados: v("follows"),
    clics: null,
    segundosPromedio: ins.ig_reels_avg_watch_time != null ? Math.round((ins.ig_reels_avg_watch_time / 1000) * 10) / 10 : null,
    respuestas: v("replies"),
  };
}

export function mapearPostFB(p: GraphJson, ins: Valores): PublicacionOrganica {
  const adj = p.attachments?.data?.[0];
  const reacciones = n(p.reactions?.summary?.total_count);
  const meGusta = reacciones ?? n(p.likes?.summary?.total_count);
  const comentarios = n(p.comments?.summary?.total_count);
  const compartidos = n(p.shares?.count) ?? (p.shares ? 0 : null);
  const partes = [meGusta, comentarios, compartidos].filter((x): x is number => x != null);
  const v = (k: string) => (k in ins ? n(ins[k]) : null);
  return {
    id: String(p.id),
    red: "facebook",
    formato: formatoFB(p.status_type, adj?.media_type ?? adj?.type),
    publicadoEn: horaBogota(String(p.created_time)),
    texto: limpiarTexto(p.message ?? p.story),
    enlace: String(p.permalink_url ?? ""),
    urlMiniatura: p.full_picture ?? null,
    alcance: v("post_total_media_view_unique"),
    vistas: v("post_media_view"),
    meGusta,
    comentarios,
    compartidos,
    guardados: null,
    interacciones: partes.length ? partes.reduce((a, b) => a + b, 0) : null,
    visitasPerfil: null,
    seguidoresGanados: null,
    clics: v("post_clicks"),
    segundosPromedio: null,
    respuestas: null,
  };
}

// ---------------------------------------------------------------------------
// Pedir métricas sin que una retirada tumbe todo
// ---------------------------------------------------------------------------

function valorDe(entrada: GraphJson): number | null {
  if (entrada?.total_value?.value != null) return n(entrada.total_value.value);
  const vals = entrada?.values;
  if (Array.isArray(vals) && vals.length) {
    const ult = vals[vals.length - 1]?.value;
    if (typeof ult === "object" && ult !== null) return Object.values(ult as Record<string, unknown>).reduce<number>((a, b) => a + (n(b) ?? 0), 0);
    return n(ult);
  }
  return null;
}

/** Pide todas las métricas; si Meta rechaza el lote, las pide una por una y anota cuáles no existen. */
export async function pedirInsights(pedir: Peticion, objetoId: string, metricas: readonly string[], extra: Record<string, string | number> = {}): Promise<{ valores: Valores; retiradas: string[] }> {
  const valores: Valores = {};
  const retiradas: string[] = [];
  const leer = (json: GraphJson) => {
    for (const e of json?.data ?? []) {
      const v = valorDe(e);
      if (v != null) valores[String(e.name)] = v;
    }
  };
  try {
    leer(await pedir(`${objetoId}/insights`, { metric: metricas.join(","), ...extra }));
    return { valores, retiradas };
  } catch {
    /* una métrica del lote no existe (o el objeto tiene muy pocas vistas): se prueba de a una */
  }
  for (const m of metricas) {
    try {
      leer(await pedir(`${objetoId}/insights`, { metric: m, ...extra }));
    } catch {
      retiradas.push(m);
    }
  }
  return { valores, retiradas };
}

// ---------------------------------------------------------------------------
// Sincronización completa
// ---------------------------------------------------------------------------

export interface OpcionesSincronizacion {
  pedir: Peticion;
  instagramId: string | null;
  paginaId: string | null;
  desde: string;
  hasta: string;
  /** Instante de la captura (ISO); por defecto ahora. */
  ahora?: string;
}

const CAMPOS_IG_MEDIA = "id,caption,media_type,media_product_type,timestamp,permalink,thumbnail_url,media_url,like_count,comments_count";
const CAMPOS_FB_POST = "id,created_time,message,story,permalink_url,status_type,full_picture,attachments{media_type,type},likes.summary(true).limit(0),comments.summary(true).limit(0),shares,reactions.summary(true).limit(0)";
const VENTANA_IG_DIAS = 30;
const VENTANA_FB_DIAS = 90;

async function paginar(pedir: Peticion, ruta: string, params: Record<string, string | number>, seguir: (fila: GraphJson) => boolean): Promise<GraphJson[]> {
  const filas: GraphJson[] = [];
  let after: string | undefined;
  for (let vuelta = 0; vuelta < 40; vuelta++) {
    const json = await pedir(ruta, after ? { ...params, after } : params);
    const data: GraphJson[] = json?.data ?? [];
    let parar = false;
    for (const f of data) {
      if (!seguir(f)) {
        parar = true;
        break;
      }
      filas.push(f);
    }
    after = json?.paging?.cursors?.after;
    if (parar || !after || !data.length) break;
  }
  return filas;
}

const epoch = (fecha: string, finDia = false) => Math.floor(Date.UTC(Number(fecha.slice(0, 4)), Number(fecha.slice(5, 7)) - 1, Number(fecha.slice(8, 10)), finDia ? 23 + 5 : 5, finDia ? 59 : 0) / 1000);

/** Fecha (Bogotá) de un valor diario de Meta: `end_time` es el día siguiente a las 07:00 UTC. */
function fechaDeValor(v: GraphJson, porDefecto: string): string {
  return typeof v?.end_time === "string" ? sumarDias(aFechaBogota(new Date(v.end_time)), -1) : porDefecto;
}

async function serieDiaria(pedir: Peticion, objetoId: string, metricas: readonly string[], red: RedOrganico, desde: string, hasta: string, ventana: number, retiradas: Set<string>): Promise<DiaOrganico[]> {
  const porFecha = new Map<string, DiaOrganico>();
  const dia = (f: string): DiaOrganico => porFecha.get(f) ?? { red, fecha: f, seguidoresNuevos: null, seguidoresTotal: null, alcance: null, vistas: null, interacciones: null };
  for (let ini = desde; ini <= hasta; ini = sumarDias(ini, ventana)) {
    const fin = sumarDias(ini, ventana - 1) < hasta ? sumarDias(ini, ventana - 1) : hasta;
    for (const m of metricas) {
      let json: GraphJson;
      try {
        json = await pedir(`${objetoId}/insights`, { metric: m, period: "day", since: epoch(ini), until: epoch(fin, true) });
      } catch {
        retiradas.add(m);
        continue;
      }
      for (const e of json?.data ?? []) {
        for (const v of e?.values ?? []) {
          const f = fechaDeValor(v, fin);
          if (f < desde || f > hasta) continue;
          const d = dia(f);
          const val = n(v?.value);
          if (m === "follower_count") d.seguidoresNuevos = val;
          else if (m === "page_follows") d.seguidoresTotal = val;
          else if (m === "reach") d.alcance = val;
          else if (m === "page_media_view") d.vistas = val;
          else if (m === "page_post_engagements") d.interacciones = val;
          porFecha.set(f, d);
        }
      }
    }
  }
  return [...porFecha.values()].sort((a, b) => a.fecha.localeCompare(b.fecha));
}

export async function sincronizarOrganico(o: OpcionesSincronizacion): Promise<LoteOrganico> {
  const lote: LoteOrganico = { cuentas: [], publicaciones: [], dias: [], meta: { capturadoEn: o.ahora ?? new Date().toISOString(), desde: o.desde, hasta: o.hasta, origen: "graph", avisos: [] } };
  const retiradas: Record<RedOrganico, Set<string>> = { instagram: new Set(), facebook: new Set() };
  const desdeIso = `${o.desde}T00:00`;

  if (o.instagramId) {
    const c = await o.pedir(o.instagramId, { fields: "id,username,followers_count,media_count" });
    lote.cuentas.push({ red: "instagram", id: String(c.id), alias: String(c.username ?? ""), seguidores: n(c.followers_count), publicaciones: n(c.media_count) });
    const media = await paginar(o.pedir, `${o.instagramId}/media`, { fields: CAMPOS_IG_MEDIA, limit: 50 }, (m) => horaBogota(String(m.timestamp)) >= desdeIso);
    let historias: GraphJson[] = [];
    try {
      historias = (await o.pedir(`${o.instagramId}/stories`, { fields: CAMPOS_IG_MEDIA, limit: 50 }))?.data ?? [];
    } catch {
      /* sin permiso de historias: se sigue sin ellas */
    }
    for (const m of [...media, ...historias]) {
      const formato = formatoIG(m.media_type, m.media_product_type);
      const r = await pedirInsights(o.pedir, String(m.id), metricasIG(formato));
      r.retiradas.forEach((x) => retiradas.instagram.add(x));
      lote.publicaciones.push(mapearMediaIG(m, r.valores));
    }
    lote.dias.push(...(await serieDiaria(o.pedir, o.instagramId, ["reach", "follower_count"], "instagram", o.desde, o.hasta, VENTANA_IG_DIAS, retiradas.instagram)));
  }

  if (o.paginaId) {
    const c = await o.pedir(o.paginaId, { fields: "id,name,followers_count,fan_count" });
    lote.cuentas.push({ red: "facebook", id: String(c.id), alias: String(c.name ?? ""), seguidores: n(c.followers_count) ?? n(c.fan_count), publicaciones: null });
    const posts = await paginar(o.pedir, `${o.paginaId}/posts`, { fields: CAMPOS_FB_POST, limit: 50, since: epoch(o.desde), until: epoch(o.hasta, true) }, () => true);
    for (const p of posts) {
      const r = await pedirInsights(o.pedir, String(p.id), METRICAS_FB_POST);
      r.retiradas.forEach((x) => retiradas.facebook.add(x));
      lote.publicaciones.push(mapearPostFB(p, r.valores));
    }
    lote.dias.push(...(await serieDiaria(o.pedir, o.paginaId, ["page_follows", "page_post_engagements", "page_media_view"], "facebook", o.desde, o.hasta, VENTANA_FB_DIAS, retiradas.facebook)));
  }

  lote.publicaciones.sort((a, b) => b.publicadoEn.localeCompare(a.publicadoEn));
  for (const red of ["instagram", "facebook"] as const) {
    const lista = [...retiradas[red]].map((m) => NOMBRE_METRICA[m] ?? m);
    if (lista.length) lote.meta.avisos.push(`Meta no entregó ${lista.map((x) => `«${x}»`).join(", ")} en ${red === "instagram" ? "Instagram" : "Facebook"}; se muestra como «—».`);
  }
  return lote;
}

/** Une una captura nueva (últimos días) con la anterior: lo nuevo manda, lo viejo se conserva. */
export function fusionarLotes(viejo: LoteOrganico | null, nuevo: LoteOrganico): LoteOrganico {
  if (!viejo) return nuevo;
  const pubs = new Map(viejo.publicaciones.map((p) => [p.id, p]));
  for (const p of nuevo.publicaciones) pubs.set(p.id, p);
  const dias = new Map(viejo.dias.map((d) => [`${d.red}|${d.fecha}`, d]));
  for (const d of nuevo.dias) dias.set(`${d.red}|${d.fecha}`, d);
  return {
    cuentas: nuevo.cuentas.length ? nuevo.cuentas : viejo.cuentas,
    publicaciones: [...pubs.values()].sort((a, b) => b.publicadoEn.localeCompare(a.publicadoEn)),
    dias: [...dias.values()].sort((a, b) => a.red.localeCompare(b.red) || a.fecha.localeCompare(b.fecha)),
    meta: { ...nuevo.meta, desde: viejo.meta.desde < nuevo.meta.desde ? viejo.meta.desde : nuevo.meta.desde, hasta: viejo.meta.hasta > nuevo.meta.hasta ? viejo.meta.hasta : nuevo.meta.hasta },
  };
}
