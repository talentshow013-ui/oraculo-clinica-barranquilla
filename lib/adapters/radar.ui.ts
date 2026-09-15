/**
 * Mapeo de la interfaz pública de la Biblioteca de anuncios de Meta → contrato.
 *
 * El capturador (scripts/radar-capturar.ts, Playwright) entrega por tarjeta el texto
 * visible, las imágenes, los enlaces y la página. Aquí se parsea de forma pura y
 * testeable. Español e inglés. Lo que no se encuentra es null; nunca se estima.
 */
import type { AnuncioCompetidor, Competidor } from "@/lib/adapters/types";
import { clasificarAngulo, nivelConscienciaTexto } from "@/lib/competitive/angles";
import { diasEntre } from "@/lib/format/fechas";
import { detectarServicio } from "@/lib/adapters/radar.apify";

const MESES: Record<string, number> = {
  ene: 1, enero: 1, jan: 1, january: 1,
  feb: 2, febrero: 2, february: 2,
  mar: 3, marzo: 3, march: 3,
  abr: 4, abril: 4, apr: 4, april: 4,
  may: 5, mayo: 5,
  jun: 6, junio: 6, june: 6,
  jul: 7, julio: 7, july: 7,
  ago: 8, agosto: 8, aug: 8, august: 8,
  sep: 9, sept: 9, septiembre: 9, september: 9, set: 9,
  oct: 10, octubre: 10, october: 10,
  nov: 11, noviembre: 11, november: 11,
  dic: 12, diciembre: 12, dec: 12, december: 12,
};

const dd = (n: number) => String(n).padStart(2, "0");

/** "14 jun 2026" · "14 de junio de 2026" · "Jun 14, 2026" · "September 1, 2026" → YYYY-MM-DD */
export function parsearFechaLibreria(texto: string): string | null {
  const t = texto.trim().toLowerCase().replace(/\./g, "");
  let m = t.match(/(\d{1,2})\s+(?:de\s+)?([a-zñ]+)\s+(?:de\s+)?(\d{4})/);
  if (m) {
    const mes = MESES[m[2]!];
    if (mes) return `${m[3]}-${dd(mes)}-${dd(Number(m[1]))}`;
  }
  m = t.match(/([a-z]+)\s+(\d{1,2}),?\s+(\d{4})/);
  if (m) {
    const mes = MESES[m[1]!];
    if (mes) return `${m[3]}-${dd(mes)}-${dd(Number(m[2]))}`;
  }
  return null;
}

export interface TarjetaParseada {
  adArchiveID: string | null;
  activo: boolean;
  inicio: string | null;
  fin: string | null;
  variantes: number;
  anunciante: string | null;
  copy: string;
  cta: string | null;
}

const CTAS = [
  "enviar mensaje de whatsapp", "enviar mensaje", "más información", "mas información", "más info", "reservar", "registrarte", "comprar", "descargar", "obtener oferta",
  "cotizar", "contactarnos", "solicitar", "suscribirte", "ver más", "agenda", "agendar", "escríbenos", "llamar",
  "learn more", "send message", "send whatsapp message", "book now", "sign up", "shop now", "get offer", "contact us", "apply now", "download", "get quote",
];

const RUIDO =
  /^(activo|inactivo|active|inactive|plataformas|platforms|publicidad|sponsored|ver detalles del anuncio|see ad details|ver resumen|see summary|abrir menú desplegable|open dropdown|este anuncio tiene varias versiones|this ad has multiple versions|\d{1,2}:\d{2}\s*\/\s*\d{1,2}:\d{2})$/i;

export function parsearTarjeta(texto: string): TarjetaParseada {
  const lineas = texto.split(/\r?\n/).map((l) => l.replace(/​/g, "").trim()).filter(Boolean);
  const todo = lineas.join("\n");

  const id = todo.match(/(?:identificador de la biblioteca|library id)\s*:?\s*(\d{6,})/i)?.[1] ?? null;
  const activo = !/^\s*(inactivo|inactive)\b/im.test(todo) && /^\s*(activo|active)\b/im.test(todo);

  let inicio: string | null = null;
  let fin: string | null = null;
  const mInicio = todo.match(/(?:se empez[oó] a publicar el|en circulaci[oó]n desde el|started running on)\s+([^\n·]+)/i);
  if (mInicio) inicio = parsearFechaLibreria(mInicio[1]!);
  const mRango = todo.match(/(?:se public[oó] del|ran from)\s+([^\n]+?)\s+(?:al|to)\s+([^\n·]+)/i);
  if (mRango) {
    inicio = parsearFechaLibreria(mRango[1]!) ?? inicio;
    fin = parsearFechaLibreria(mRango[2]!);
  }

  const mVar = todo.match(/(\d+)\s+(?:anuncios usan este (?:creativo|contenido)|ads use this creative)/i);
  const variasVersiones = /varias versiones|multiple versions/i.test(todo);
  const variantes = mVar ? Math.max(1, Number(mVar[1])) : variasVersiones ? 2 : 1;

  // Anunciante: la línea justo antes de "Publicidad"/"Sponsored".
  let anunciante: string | null = null;
  const idxPub = lineas.findIndex((l) => /^(publicidad|sponsored)$/i.test(l));
  if (idxPub > 0) anunciante = lineas[idxPub - 1] ?? null;

  // Copy: desde después de "Publicidad" hasta el CTA (o el final), sin líneas de ruido/dominio.
  const cuerpo = idxPub >= 0 ? lineas.slice(idxPub + 1) : lineas.filter((l) => !/identificador|library id|publicar|running|plataformas|platforms|creativo|creative/i.test(l));
  let cta: string | null = null;
  const copyLineas: string[] = [];
  for (const l of cuerpo) {
    const lower = l.toLowerCase();
    if (CTAS.includes(lower)) {
      cta = l;
      break;
    }
    if (RUIDO.test(l)) continue;
    if (anunciante && l === anunciante && copyLineas.length > 0) continue; // pie de tarjeta
    if (/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(l)) continue; // línea de dominio (wa.me)
    copyLineas.push(l);
  }
  if (!cta) {
    const ultima = cuerpo.at(-1)?.toLowerCase() ?? "";
    if (CTAS.includes(ultima)) cta = cuerpo.at(-1) ?? null;
  }

  return { adArchiveID: id, activo, inicio, fin, variantes, anunciante, copy: copyLineas.join("\n").trim(), cta };
}

export interface TarjetaCruda {
  texto: string;
  imagenes: string[];
  videosPoster: string[];
  enlaces: string[];
  paginaHref: string | null;
  plataformas: string[];
  /** Ruta pública del creativo descargado (p. ej. /radar/123.jpg), si se descargó. */
  urlMediaLocal?: string | null;
}

/** Deshace l.facebook.com/l.php?u=... y devuelve el destino real. */
export function destinoReal(enlaces: ReadonlyArray<string>): string | null {
  for (const e of enlaces) {
    try {
      const u = new URL(e);
      if (/l\.facebook\.com|lm\.facebook\.com/.test(u.hostname)) {
        const dest = u.searchParams.get("u");
        if (dest) return decodeURIComponent(dest);
      }
      if (!/facebook\.com|instagram\.com|fb\.com/.test(u.hostname)) return e;
    } catch {
      /* siguiente */
    }
  }
  return null;
}

function slug(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/** Id de competidor: vanity/id de la página si hay href; si no, nombre normalizado. */
export function idPagina(paginaHref: string | null, anunciante: string | null): string {
  if (paginaHref) {
    try {
      const u = new URL(paginaHref);
      const partes = u.pathname.split("/").filter(Boolean);
      const idParam = u.searchParams.get("id");
      if (idParam) return idParam;
      if (partes[0] === "profile.php") return u.searchParams.get("id") ?? slug(anunciante ?? "pagina");
      if (partes[0]) return partes[0];
    } catch {
      /* cae al nombre */
    }
  }
  return slug(anunciante ?? "pagina");
}

export function mapearTarjetaUI(c: TarjetaCruda, hoy: string): AnuncioCompetidor {
  const p = parsearTarjeta(c.texto);
  const inicio = p.inicio ?? hoy;
  const ultimaVez = p.activo ? hoy : (p.fin ?? inicio);
  const texto = `${p.copy}`.trim();
  const clasificacion = clasificarAngulo(texto);
  const urlDestino = destinoReal(c.enlaces);
  const poster = c.videosPoster[0] ?? null;
  const imagen = c.imagenes[0] ?? null;
  const tipoMedia: AnuncioCompetidor["tipoMedia"] = poster ? "video" : c.imagenes.length >= 2 ? "carrusel" : imagen ? "imagen" : "desconocido";
  let dominio: string | null = null;
  try {
    dominio = urlDestino ? new URL(urlDestino).hostname.replace(/^www\./, "") : null;
  } catch {
    dominio = null;
  }

  return {
    competidorId: idPagina(c.paginaHref, p.anunciante),
    nombreAnunciante: p.anunciante ?? "",
    anuncioId: p.adArchiveID ?? "",
    primeraVez: inicio,
    ultimaVez,
    diasCorriendo: Math.max(0, diasEntre(inicio, ultimaVez) - 1),
    activo: p.activo,
    plataformas: c.plataformas.map((x) => x.toLowerCase()),
    copy: p.copy,
    titular: null,
    cta: p.cta,
    urlMedia: c.urlMediaLocal ?? poster ?? imagen,
    tipoMedia,
    urlDestino,
    dominioDestino: dominio,
    alcanceRango: null,
    variantesDelConcepto: p.variantes,
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

export interface RadarUIMapeado {
  competidores: Competidor[];
  anunciosCompetencia: AnuncioCompetidor[];
  descartados: number;
  /** Tarjetas de la propia clínica o de rubros ajenos, dejadas fuera a propósito. */
  excluidos: number;
}

export interface FiltroRadar {
  /** Ids/vanities de las páginas de la propia clínica: nunca son competencia. */
  paginasPropias?: ReadonlyArray<string>;
  /** Palabras (sin acentos, minúsculas) que delatan un rubro ajeno en el nombre o el id de la página. */
  excluirNombres?: ReadonlyArray<string>;
}

function normalizar(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

/** ¿Esta página es la clínica misma o un rubro ajeno (odontología, cursos, prensa…)? */
function excluida(a: AnuncioCompetidor, filtro: FiltroRadar): boolean {
  const id = normalizar(a.competidorId);
  if (filtro.paginasPropias?.some((p) => normalizar(p) === id)) return true;
  const texto = `${id} ${normalizar(a.nombreAnunciante)}`;
  return filtro.excluirNombres?.some((palabra) => texto.includes(normalizar(palabra))) ?? false;
}

/** Agrupa las tarjetas por página → competidores; descarta las que no traen identificador y excluye la clínica y rubros ajenos. */
export function mapearRadarUI(tarjetas: ReadonlyArray<TarjetaCruda>, hoy: string, ciudadPorPagina: Record<string, string> = {}, ciudadDefecto = "Barranquilla", filtro: FiltroRadar = {}): RadarUIMapeado {
  const anuncios: AnuncioCompetidor[] = [];
  const paginas = new Map<string, { nombre: string; url: string | null; servicios: Set<string> }>();
  let descartados = 0;
  let excluidos = 0;
  for (const t of tarjetas) {
    const a = mapearTarjetaUI(t, hoy);
    if (!a.anuncioId) {
      descartados++;
      continue;
    }
    if (excluida(a, filtro)) {
      excluidos++;
      continue;
    }
    anuncios.push(a);
    const p = paginas.get(a.competidorId) ?? { nombre: a.nombreAnunciante || a.competidorId, url: t.paginaHref, servicios: new Set<string>() };
    if (a.servicioDetectado) p.servicios.add(a.servicioDetectado);
    if (!p.url && t.paginaHref) p.url = t.paginaHref;
    paginas.set(a.competidorId, p);
  }
  const competidores: Competidor[] = [...paginas.entries()].map(([id, p]) => ({
    id,
    nombre: p.nombre,
    ciudad: ciudadPorPagina[id] ?? ciudadDefecto,
    serviciosConocidos: [...p.servicios],
    urlPagina: p.url,
    seguidoresPagina: null,
  }));
  return { competidores, anunciosCompetencia: anuncios, descartados, excluidos };
}
