/**
 * Mapeo Apify (`apify/facebook-ads-scraper`, Biblioteca de anuncios de Meta) → contrato.
 *
 * Por qué Apify y no la API oficial: la API de la Biblioteca solo devuelve anuncios
 * comerciales para la UE/UK; para Colombia solo políticos. El actor raspa la
 * interfaz pública, que sí muestra los comerciales. Forma del registro verificada
 * el 2026-09-13 (ver docs/CONEXION_MCP.md).
 *
 * Regla: se mapea la fuente AL contrato. `reachEstimate`/`spend` vienen null para
 * comerciales fuera de la UE → `alcanceRango: null`. Jamás se estima.
 */
import type { AnuncioCompetidor, Competidor } from "@/lib/adapters/types";
import { clasificarAngulo, nivelConscienciaTexto } from "@/lib/competitive/angles";
import { aFechaBogota, diasEntre } from "@/lib/format/fechas";

export interface ItemApify {
  inputUrl?: string;
  pageID?: string | number;
  pageId?: string | number;
  adArchiveID?: string;
  startDateFormatted?: string | null;
  endDateFormatted?: string | null;
  startDate?: number | null;
  endDate?: number | null;
  collationCount?: number | null;
  isActive?: boolean;
  pageName?: string;
  pageIsDeleted?: boolean;
  publisherPlatform?: string[];
  reachEstimate?: { lower_bound?: number; upper_bound?: number } | number | null;
  spend?: unknown;
  currency?: string;
  impressionsWithIndex?: { impressionsText?: string | null; impressionsIndex?: number };
  categories?: string[];
  pageLikeCount?: number | null;
  snapshot?: {
    title?: string | null;
    body?: { text?: string | null } | null;
    ctaText?: string | null;
    linkUrl?: string | null;
    images?: Array<{ original_image_url?: string; resized_image_url?: string }>;
    videos?: Array<{ video_hd_url?: string; video_sd_url?: string; video_preview_image_url?: string }>;
    cards?: Array<{ title?: string; body?: string; link_url?: string }>;
    pageLikeCount?: number;
  } | null;
}

/** Palabras clave → id de servicio de la configuración. Determinista y auditable. */
const SERVICIOS: ReadonlyArray<[string, RegExp]> = [
  ["toxina", /toxina|botox|bot[oó]x|botul/i],
  ["acido", /[aá]cido hialur|hialur[oó]nico|labios|rinomodelaci/i],
  ["limpieza", /limpieza facial/i],
  ["peeling", /peeling/i],
  ["laser_facial", /l[aá]ser facial|rejuvenec.*l[aá]ser|manchas/i],
  ["depilacion", /depilaci[oó]n/i],
  ["criolipolisis", /criolip|grasa localizada/i],
  ["radiofrecuencia", /radiofrecuencia|flacidez corporal/i],
  ["prp", /plasma rico|prp\b|plaquetas/i],
];

function fecha(iso: string | null | undefined, epoch: number | null | undefined): string | null {
  if (iso) return aFechaBogota(new Date(iso));
  if (typeof epoch === "number" && Number.isFinite(epoch)) return aFechaBogota(new Date(epoch * 1000));
  return null;
}

function dominio(url: string | null): string | null {
  if (!url) return null;
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

export function detectarServicio(texto: string): string | null {
  for (const [id, re] of SERVICIOS) if (re.test(texto)) return id;
  return null;
}

export function mapearAnuncioApify(item: ItemApify, hoy: string): AnuncioCompetidor {
  const s = item.snapshot ?? {};
  const copy = (s.body?.text ?? "").trim();
  const titular = s.title?.trim() || null;
  const texto = `${titular ?? ""} ${copy}`.trim();
  const activo = item.isActive === true;
  const primeraVez = fecha(item.startDateFormatted, item.startDate) ?? hoy;
  const fin = fecha(item.endDateFormatted, item.endDate);
  const ultimaVez = activo ? hoy : (fin ?? primeraVez);
  const diasCorriendo = Math.max(0, diasEntre(primeraVez, ultimaVez) - 1);

  const imagen = s.images?.[0]?.original_image_url ?? s.images?.[0]?.resized_image_url ?? null;
  const video = s.videos?.[0]?.video_hd_url ?? s.videos?.[0]?.video_sd_url ?? null;
  const tipoMedia: AnuncioCompetidor["tipoMedia"] = (s.cards?.length ?? 0) >= 2 ? "carrusel" : video ? "video" : imagen ? "imagen" : "desconocido";

  let alcanceRango: AnuncioCompetidor["alcanceRango"] = null;
  const re = item.reachEstimate;
  if (re && typeof re === "object" && typeof re.lower_bound === "number" && typeof re.upper_bound === "number") {
    alcanceRango = { min: re.lower_bound, max: re.upper_bound };
  }

  const clasificacion = clasificarAngulo(texto);
  const urlDestino = s.linkUrl?.trim() || null;

  return {
    competidorId: String(item.pageID ?? item.pageId ?? ""),
    nombreAnunciante: item.pageName ?? "",
    anuncioId: String(item.adArchiveID ?? ""),
    primeraVez,
    ultimaVez,
    diasCorriendo,
    activo,
    plataformas: (item.publisherPlatform ?? []).map((p) => p.toLowerCase()),
    copy,
    titular,
    cta: s.ctaText?.trim() || null,
    urlMedia: video ?? imagen,
    tipoMedia,
    urlDestino,
    dominioDestino: dominio(urlDestino),
    alcanceRango,
    variantesDelConcepto: Math.max(1, item.collationCount ?? 1),
    servicioDetectado: detectarServicio(texto),
    anguloDetectado: clasificacion.angulo,
    nivelConsciencia: nivelConscienciaTexto(texto),
    usaPrecio: /\$\s?\d|\d{2,3}\.\d{3}|precio|desde \$/i.test(texto),
    usaUrgencia: /cupos|solo hoy|[uú]ltim[oa]s|hasta el|esta semana|agenda ya/i.test(texto),
    usaProfesional: /m[eé]dic[oa]|doctor|dra?\.|especialista|dermat[oó]log|cirujan/i.test(texto),
    usaTestimonio: /testimonio|nos cuenta|su experiencia|"|“|recomiendo/i.test(texto),
    usaGarantia: /garant/i.test(texto),
    puntuacionLongevidad: 0,
  };
}

export interface RadarMapeado {
  competidores: Competidor[];
  anunciosCompetencia: AnuncioCompetidor[];
  descartados: number;
}

/** Ciudad por defecto para competidores del radio; se puede sobreescribir por página. */
export function mapearRadarApify(items: ReadonlyArray<ItemApify>, hoy: string, ciudadPorPagina: Record<string, string> = {}, ciudadDefecto = "Barranquilla"): RadarMapeado {
  const anuncios: AnuncioCompetidor[] = [];
  let descartados = 0;
  for (const item of items) {
    if (item.pageIsDeleted || !item.adArchiveID || !(item.pageID ?? item.pageId)) {
      descartados++;
      continue;
    }
    anuncios.push(mapearAnuncioApify(item, hoy));
  }

  const porPagina = new Map<string, { nombre: string; servicios: Set<string>; seguidores: number | null; url: string | null }>();
  for (const item of items) {
    const id = String(item.pageID ?? item.pageId ?? "");
    if (!id || item.pageIsDeleted) continue;
    const c = porPagina.get(id) ?? { nombre: item.pageName ?? id, servicios: new Set<string>(), seguidores: null, url: null };
    if (typeof item.pageLikeCount === "number") c.seguidores = item.pageLikeCount;
    if (!c.url && item.inputUrl?.includes("view_all_page_id")) c.url = `https://www.facebook.com/${id}`;
    porPagina.set(id, c);
  }
  for (const a of anuncios) if (a.servicioDetectado) porPagina.get(a.competidorId)?.servicios.add(a.servicioDetectado);

  const competidores: Competidor[] = [...porPagina.entries()].map(([id, c]) => ({
    id,
    nombre: c.nombre,
    ciudad: ciudadPorPagina[id] ?? ciudadDefecto,
    serviciosConocidos: [...c.servicios],
    urlPagina: c.url,
    seguidoresPagina: c.seguidores,
  }));

  return { competidores, anunciosCompetencia: anuncios, descartados };
}
