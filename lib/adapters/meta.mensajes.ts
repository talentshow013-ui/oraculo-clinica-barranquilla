/**
 * El MENSAJE PREDETERMINADO de los anuncios de WhatsApp: el texto que la persona envía con un toque
 * al abrir el chat («¡Hola! Vivante 💎 Quiero mi evaluación para Lipoz 360»). Es lo primero que ve la
 * asesora en Kommo, así que dice de qué anuncio vino el lead. Vive en el creativo, dentro de
 * `page_welcome_message` (un JSON en texto). Los anuncios hechos desde una publicación existente no
 * tienen mensaje predeterminado propio (Meta no guarda ninguno en su creativo).
 */
export interface MensajeAnuncio {
  /** Lo que la persona envía con un toque. */
  predeterminado: string;
  /** Lo que el anuncio le dice antes de escribir. */
  bienvenida: string | null;
  respuestasRapidas: string[];
}

interface CreativoCrudo {
  object_story_id?: string;
  object_story_spec?: { link_data?: { page_welcome_message?: string }; video_data?: { page_welcome_message?: string } };
}

export function mensajeDeCreativo(c: CreativoCrudo | null | undefined): MensajeAnuncio | null {
  const crudo = c?.object_story_spec?.link_data?.page_welcome_message ?? c?.object_story_spec?.video_data?.page_welcome_message;
  if (!crudo) return null;
  try {
    const j = JSON.parse(crudo) as {
      text_format?: { message?: { autofill_message?: { content?: string }; text?: string } };
      image_format?: { message?: { quick_replies?: { title?: string }[] } };
    };
    const predeterminado = j.text_format?.message?.autofill_message?.content?.trim();
    if (!predeterminado) return null;
    return {
      predeterminado,
      bienvenida: j.text_format?.message?.text?.trim() || null,
      respuestasRapidas: (j.image_format?.message?.quick_replies ?? []).map((q) => q.title?.trim() ?? "").filter(Boolean),
    };
  } catch {
    return null;
  }
}

/** Sin emojis, acentos, signos ni mayúsculas: para comparar lo que llegó a Kommo con el anuncio. */
export function normalizarMensaje(t: string): string {
  return t
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[\p{Extended_Pictographic}‍️]/gu, " ")
    .toLowerCase()
    .replace(/[^a-z0-9ñ ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Un mensaje que no nombra servicio ni oferta no sirve para saber de qué anuncio vino. */
export function esGenerico(t: string): boolean {
  const n = normalizarMensaje(t);
  const util = n.replace(/\b(hola|buenas|buenos dias|buenas tardes|quiero|quisiera|deseo|mas|informacion|info|me|gustaria|obtener|por favor|gracias|vivante|sobre|el|la|los|de|un|una)\b/g, "").trim();
  return util.length < 4;
}

/** Anuncios cuyo mensaje predeterminado contiene (o es contenido por) el texto buscado. */
export function buscarMensaje<T extends { predeterminado: string | null }>(anuncios: ReadonlyArray<T>, texto: string): T[] {
  const q = normalizarMensaje(texto);
  if (!q) return [];
  return anuncios.filter((a) => {
    if (!a.predeterminado) return false;
    const m = normalizarMensaje(a.predeterminado);
    return m.includes(q) || q.includes(m);
  });
}

/** Un anuncio en `datos/mensajes.json` (todos, de cualquier estado). */
export interface AnuncioMensaje {
  id: string;
  cuenta: string;
  cuentaId: string;
  campana: string;
  anuncio: string;
  estado: string;
  /** Fecha de creación del anuncio en Meta. */
  creado: string;
  predeterminado: string | null;
  bienvenida: string | null;
  /** Hecho desde una publicación: el mensaje no viene por la API. */
  desdePublicacion: boolean;
  /** Primer día en que Oráculo lo vio. */
  vistoPrimeraVez: string;
}

/**
 * Junta lo guardado con lo recién traído: lo nuevo manda en estado y mensaje, se conserva cuándo se
 * vio por primera vez, y los anuncios que ya no aparecen (borrados) se quedan para poder buscar sus
 * mensajes en leads viejos. Sin archivo previo no hay «nuevos»: no se avisa de miles de anuncios viejos.
 */
export function fusionarMensajes(viejos: ReadonlyArray<AnuncioMensaje> | null, recientes: ReadonlyArray<AnuncioMensaje>, hoy: string): { todos: AnuncioMensaje[]; nuevos: AnuncioMensaje[] } {
  const previo = new Map((viejos ?? []).map((a) => [a.id, a]));
  const nuevos: AnuncioMensaje[] = [];
  const m = new Map(previo);
  for (const a of recientes) {
    const antes = previo.get(a.id);
    const fila = { ...a, vistoPrimeraVez: antes?.vistoPrimeraVez || hoy };
    if (!antes && viejos) nuevos.push(fila);
    m.set(a.id, fila);
  }
  return { todos: [...m.values()].sort((x, y) => x.id.localeCompare(y.id)), nuevos };
}

/** Telegram: los anuncios nuevos con su mensaje, para que el equipo lo reconozca en Kommo. Texto HTML. */
export function componerAvisoMensajes(nuevos: ReadonlyArray<{ anuncio: string; cuenta: string; predeterminado: string | null; repetido: boolean }>): string {
  const esc = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const L = [`🆕 <b>${nuevos.length === 1 ? "Anuncio nuevo" : `${nuevos.length} anuncios nuevos`}</b> · su mensaje de WhatsApp (así llegará a Kommo)`, ""];
  for (const n of nuevos.slice(0, 15)) {
    const nota = !n.predeterminado ? " · sin mensaje predeterminado (hecho desde una publicación): en Kommo no se sabrá de qué anuncio vino" : esGenerico(n.predeterminado) ? " · ⚠️ genérico: en Kommo no se sabrá de qué anuncio vino" : n.repetido ? " · ⚠️ igual al de otro anuncio" : "";
    L.push(`• <b>${esc(n.anuncio)}</b> (${esc(n.cuenta)})${n.predeterminado ? `\n  «${esc(n.predeterminado)}»` : ""}${nota}`);
  }
  if (nuevos.length > 15) L.push(`… y ${nuevos.length - 15} más (npm run mensajes).`);
  return L.join("\n");
}

/** Los emojis del mensaje, en orden (sin modificadores invisibles): la marca que distingue un anuncio de otro. */
export function emojisDe(t: string): string {
  return (t.match(/\p{Extended_Pictographic}/gu) ?? []).join("");
}

/**
 * Busca primero el mensaje EXACTO (mismo texto y mismos emojis; espacios, tildes y mayúsculas no
 * importan): los anuncios de la clínica se distinguen por el emoji. Si no hay exacto, los parecidos.
 */
export function buscarMensajeExacto<T extends { predeterminado: string | null }>(anuncios: ReadonlyArray<T>, texto: string): { exactos: T[]; parecidos: T[] } {
  const firma = (t: string) => `${normalizarMensaje(t)}|${emojisDe(t)}`;
  const buscada = firma(texto);
  const exactos = anuncios.filter((a) => a.predeterminado && firma(a.predeterminado) === buscada);
  return { exactos, parecidos: exactos.length ? [] : buscarMensaje(anuncios, texto) };
}
