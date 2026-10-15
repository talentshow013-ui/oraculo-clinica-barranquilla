/**
 * Conversaciones de Kommo por webhook: de qué ANUNCIO vino cada conversación de WhatsApp y cuánto
 * tardó la asesora en la primera respuesta. Kommo avisa a nuestra dirección cada vez que entra o sale
 * un mensaje; el aviso trae el texto. Aquí el texto se LEE EN MEMORIA solo para dos cosas (de qué
 * anuncio viene —por su mensaje predeterminado y sus emojis— y la hora) y NO se guarda: ni el texto,
 * ni nombres, ni teléfonos, ni el id crudo de la conversación (se guarda una huella HMAC).
 * Ley 1581 de 2012: es dato de salud; por eso el diseño es «leer y olvidar».
 */
import { createHmac } from "node:crypto";
import { aFechaBogota } from "@/lib/format/fechas";
import { buscarMensajeExacto, emojisDe, esGenerico, type AnuncioMensaje } from "./meta.mensajes";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Json = any;

/* ───────────── 1. Leer el cuerpo del aviso ───────────── */

/** `a[b][0][c]=1` → `{ a: { b: [ { c: "1" } ] } }`. */
function anidar(pares: Iterable<[string, string]>): Json {
  const raiz: Json = {};
  for (const [clave, valor] of pares) {
    const partes = [...clave.matchAll(/([^[\]]+)/g)].map((m) => m[1]!);
    if (!partes.length) continue;
    let nodo = raiz;
    partes.forEach((p, i) => {
      if (["__proto__", "constructor", "prototype"].includes(p)) return;
      if (i === partes.length - 1) nodo[p] = valor;
      else {
        if (typeof nodo[p] !== "object" || nodo[p] === null) nodo[p] = /^\d+$/.test(partes[i + 1]!) ? [] : {};
        nodo = nodo[p];
      }
    });
  }
  return raiz;
}

/** El cuerpo del aviso (formulario con corchetes o JSON) como objeto. Lo ilegible da `{}`. */
export function aObjeto(contentType: string | null | undefined, cuerpo: string): unknown {
  const t = (contentType ?? "").toLowerCase();
  const texto = cuerpo.trim();
  if (!texto) return {};
  if (t.includes("json") || texto.startsWith("{") || texto.startsWith("[")) {
    try {
      return JSON.parse(texto);
    } catch {
      return {};
    }
  }
  try {
    return anidar(new URLSearchParams(texto).entries());
  } catch {
    return {};
  }
}

/** Un mensaje del aviso. `texto` vive solo en memoria: nunca se guarda. */
export interface MensajeKommo {
  direccion: "entrante" | "saliente";
  /** talk_id (o chat_id) de Kommo: se convierte en huella antes de guardar. */
  conversacion: string;
  lead: string | null;
  texto: string;
  /** Segundos Unix. */
  creadoEn: number;
  /** Id de la asesora que escribió (solo mensajes salientes de una persona). */
  asesoraId: string | null;
  origen: string | null;
}

const texto1 = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : typeof v === "number" ? String(v) : null);

/** Recorre el aviso y devuelve cada mensaje de chat (con `text` y una conversación). */
export function extraerMensajes(raiz: unknown): MensajeKommo[] {
  const salida: MensajeKommo[] = [];
  const visitar = (nodo: Json, ruta: string[], profundidad: number) => {
    if (!nodo || typeof nodo !== "object" || profundidad > 8) return;
    if (Array.isArray(nodo)) {
      for (const x of nodo) visitar(x, ruta, profundidad + 1);
      return;
    }
    // Un mensaje trae texto o, si es foto/audio, su tipo o adjunto (a veces sin el campo `text`). Un aviso de
    // «conversación» (talk) no trae ninguno de los tres.
    const traeContenido = typeof nodo.text === "string" || nodo.message_type != null || nodo.attachment != null;
    const esMensaje = traeContenido && (nodo.talk_id != null || nodo.chat_id != null) && !ruta.some((r) => /^talk/.test(r));
    if (esMensaje) {
      const tipoAutor = String(nodo.author?.type ?? "").toLowerCase();
      const tipo = String(nodo.type ?? "").toLowerCase();
      const porClave = ruta.some((r) => /outgoing/.test(r));
      const saliente = tipo === "outgoing" || porClave || (tipo !== "incoming" && tipoAutor === "internal");
      const conv = texto1(nodo.talk_id) ?? texto1(nodo.chat_id);
      if (conv) {
        const t = Number(nodo.created_at);
        salida.push({
          direccion: saliente ? "saliente" : "entrante",
          conversacion: conv,
          lead: String(nodo.entity_type ?? "") === "lead" ? texto1(nodo.entity_id) : null,
          texto: typeof nodo.text === "string" ? nodo.text : "",
          creadoEn: Number.isFinite(t) && t > 0 ? t : Math.floor(Date.now() / 1000),
          asesoraId: saliente ? texto1(nodo.author?.user_id) : null,
          origen: texto1(nodo.origin),
        });
      }
      return;
    }
    for (const [k, v] of Object.entries(nodo)) visitar(v, [...ruta, k], profundidad + 1);
  };
  visitar(raiz, [], 0);
  return salida;
}

/** El subdominio de la cuenta que manda el aviso (para ignorar avisos de otra cuenta). */
export function cuentaDelAviso(raiz: unknown): string | null {
  return texto1((raiz as Json)?.account?.subdomain);
}

/* ───────────── 2. De qué anuncio vino ───────────── */

export type NivelAtribucion = "exacto" | "activo" | "parecido" | "ambiguo" | "generico" | "ninguno";
export interface Atribucion {
  nivel: NivelAtribucion;
  cuenta: string | null;
  campana: string | null;
  anuncio: string | null;
}

const SIN: Omit<Atribucion, "nivel"> = { cuenta: null, campana: null, anuncio: null };

/**
 * El primer mensaje de la persona contra el mensaje predeterminado de cada anuncio. Solo se atribuye
 * lo que es seguro: un anuncio exacto, o el único ACTIVO entre varios con el mismo mensaje, o el único
 * parecido. Si dos campañas tienen el mismo mensaje se dice «ambiguo»; no se inventa.
 */
export function atribuir(texto: string, anuncios: ReadonlyArray<AnuncioMensaje>): Atribucion {
  if (!texto.trim()) return { nivel: "ninguno", ...SIN };
  if (esGenerico(texto)) return { nivel: "generico", ...SIN };
  const conMensaje = anuncios.filter((a) => a.predeterminado);
  const tomar = (a: AnuncioMensaje, nivel: NivelAtribucion): Atribucion => ({ nivel, cuenta: a.cuenta, campana: a.campana, anuncio: a.anuncio });
  const { exactos, parecidos } = buscarMensajeExacto(conMensaje, texto);
  if (exactos.length === 1) return tomar(exactos[0]!, "exacto");
  if (exactos.length > 1) {
    const activos = exactos.filter((a) => a.estado === "ACTIVE");
    if (activos.length === 1) return tomar(activos[0]!, "activo");
    const campanas = new Set(exactos.map((a) => `${a.cuentaId}|${a.campana}`));
    if (campanas.size === 1) return { nivel: "ambiguo", cuenta: exactos[0]!.cuenta, campana: exactos[0]!.campana, anuncio: null };
    return { nivel: "ambiguo", ...SIN };
  }
  // El emoji es la marca de cada anuncio: si la persona trae uno y el del anuncio es otro, es OTRO anuncio.
  const suyos = emojisDe(texto);
  const utiles = parecidos.filter((a) => {
    const del = emojisDe(a.predeterminado ?? "");
    return a.predeterminado && !esGenerico(a.predeterminado) && (!suyos || !del || suyos === del);
  });
  if (utiles.length === 1) return tomar(utiles[0]!, "parecido");
  if (utiles.length > 1) return { nivel: "ambiguo", ...SIN };
  return { nivel: "ninguno", ...SIN };
}

/* ───────────── 3. Estado: conversaciones sin texto ───────────── */

export interface ConversacionGuardada {
  /** Segundos Unix del primer mensaje que vimos. */
  inicio: number;
  /** Día (Bogotá) en que empezó. */
  dia: string;
  origen: string | null;
  atribucion: Atribucion;
  /** Huella del lead de Kommo, para cruzar después con el embudo sin guardar el id. */
  lead: string | null;
  /** Segundos hasta la primera respuesta de una persona. */
  respuesta: number | null;
  asesoraId: string | null;
  mensajes: number;
}

export interface EstadoConversaciones {
  version: 1;
  actualizadoEn: string;
  conversaciones: Record<string, ConversacionGuardada>;
}

/** Huella HMAC: sirve para reconocer la misma conversación sin guardar su id de Kommo. */
export function huella(secreto: string, id: string): string {
  return createHmac("sha256", secreto).update(String(id)).digest("hex").slice(0, 20);
}

export type Efecto = "nueva" | "respuesta" | "seguimiento" | "ignorado";

export function aplicarMensaje(estado: EstadoConversaciones, m: MensajeKommo, ctx: { secreto: string; anuncios: ReadonlyArray<AnuncioMensaje> }): { estado: EstadoConversaciones; efecto: Efecto } {
  const clave = huella(ctx.secreto, m.conversacion);
  const previa = estado.conversaciones[clave];
  const con = (c: ConversacionGuardada): EstadoConversaciones => ({ ...estado, conversaciones: { ...estado.conversaciones, [clave]: c } });

  if (m.direccion === "entrante") {
    if (previa) return { estado: con({ ...previa, mensajes: previa.mensajes + 1 }), efecto: "seguimiento" };
    return {
      estado: con({ inicio: m.creadoEn, dia: aFechaBogota(new Date(m.creadoEn * 1000)), origen: m.origen, atribucion: atribuir(m.texto, ctx.anuncios), lead: m.lead ? huella(ctx.secreto, `lead:${m.lead}`) : null, respuesta: null, asesoraId: null, mensajes: 1 }),
      efecto: "nueva",
    };
  }
  // saliente: solo cuenta la primera respuesta de una PERSONA a una conversación que vimos empezar
  if (!previa || !m.asesoraId) return { estado, efecto: "ignorado" };
  if (previa.respuesta != null) return { estado: con({ ...previa, mensajes: previa.mensajes + 1 }), efecto: "seguimiento" };
  return { estado: con({ ...previa, respuesta: Math.max(0, m.creadoEn - previa.inicio), asesoraId: m.asesoraId, mensajes: previa.mensajes + 1 }), efecto: "respuesta" };
}

/** Quita lo más viejo que `dias` días. */
export function purgar(estado: EstadoConversaciones, ahora: number, dias = 90): EstadoConversaciones {
  const limite = ahora - dias * 86_400;
  return { ...estado, conversaciones: Object.fromEntries(Object.entries(estado.conversaciones).filter(([, c]) => c.inicio >= limite)) };
}

/* ───────────── 4. Resumen ───────────── */

const mediana = (xs: number[]): number | null => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m]! : Math.round((s[m - 1]! + s[m]!) / 2);
};

export interface ResumenConversaciones {
  desde: string;
  hasta: string;
  nuevas: number;
  identificadas: number;
  porAnuncio: { cuenta: string; campana: string; anuncio: string | null; conversaciones: number; atendidas: number; medianaSeg: number | null; certeza: NivelAtribucion }[];
  sinIdentificar: { total: number; genericas: number; ambiguas: number; ninguno: number };
  atencion: {
    atendidas: number;
    /** Sin respuesta de una persona y con más de una hora de espera. */
    sinRespuesta: number;
    hasta5min: number;
    hasta15min: number;
    hasta60min: number;
    medianaSeg: number | null;
    porAsesora: { asesoraId: string; atendidas: number; medianaSeg: number | null; hasta15min: number }[];
  };
}

export function resumir(estado: EstadoConversaciones, o: { desde: string; hasta: string; ahora?: number }): ResumenConversaciones {
  const ahora = o.ahora ?? Math.floor(Date.now() / 1000);
  const lista = Object.values(estado.conversaciones).filter((c) => c.dia >= o.desde && c.dia <= o.hasta);
  const grupos = new Map<string, { cuenta: string; campana: string; anuncio: string | null; certeza: NivelAtribucion; n: number; tiempos: number[] }>();
  const sin = { total: 0, genericas: 0, ambiguas: 0, ninguno: 0 };
  let identificadas = 0;
  for (const c of lista) {
    const a = c.atribucion;
    if (a.campana && a.cuenta) {
      identificadas++;
      const k = `${a.cuenta}|${a.campana}|${a.anuncio ?? ""}`;
      const g = grupos.get(k) ?? { cuenta: a.cuenta, campana: a.campana, anuncio: a.anuncio, certeza: a.nivel, n: 0, tiempos: [] };
      g.n++;
      if (c.respuesta != null) g.tiempos.push(c.respuesta);
      grupos.set(k, g);
    } else {
      sin.total++;
      if (a.nivel === "generico") sin.genericas++;
      else if (a.nivel === "ambiguo") sin.ambiguas++;
      else sin.ninguno++;
    }
  }
  const atendidas = lista.filter((c) => c.respuesta != null);
  const tiempos = atendidas.map((c) => c.respuesta!);
  const porAse = new Map<string, number[]>();
  for (const c of atendidas) porAse.set(c.asesoraId ?? "?", [...(porAse.get(c.asesoraId ?? "?") ?? []), c.respuesta!]);
  return {
    desde: o.desde,
    hasta: o.hasta,
    nuevas: lista.length,
    identificadas,
    porAnuncio: [...grupos.values()].sort((x, y) => y.n - x.n).map((g) => ({ cuenta: g.cuenta, campana: g.campana, anuncio: g.anuncio, conversaciones: g.n, atendidas: g.tiempos.length, medianaSeg: mediana(g.tiempos), certeza: g.certeza })),
    sinIdentificar: sin,
    atencion: {
      atendidas: atendidas.length,
      sinRespuesta: lista.filter((c) => c.respuesta == null && ahora - c.inicio > 3600).length,
      hasta5min: tiempos.filter((t) => t <= 300).length,
      hasta15min: tiempos.filter((t) => t <= 900).length,
      hasta60min: tiempos.filter((t) => t <= 3600).length,
      medianaSeg: mediana(tiempos),
      porAsesora: [...porAse.entries()].map(([asesoraId, ts]) => ({ asesoraId, atendidas: ts.length, medianaSeg: mediana(ts), hasta15min: ts.filter((t) => t <= 900).length })).sort((a, b) => b.atendidas - a.atendidas),
    },
  };
}
