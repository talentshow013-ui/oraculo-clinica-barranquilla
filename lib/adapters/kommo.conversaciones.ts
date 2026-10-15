/**
 * Conversaciones de Kommo por webhook: de qué ANUNCIO vino cada conversación de WhatsApp y cuánto
 * tardó la asesora en la primera respuesta. Kommo avisa a nuestra dirección cada vez que entra o sale
 * un mensaje; el aviso trae el texto. Aquí el texto se LEE EN MEMORIA solo para dos cosas (de qué
 * anuncio viene —por su mensaje predeterminado y sus emojis— y la hora) y NO se guarda: ni el texto,
 * ni nombres, ni teléfonos, ni el id crudo de la conversación (se guarda una huella HMAC).
 * Ley 1581 de 2012: es dato de salud; por eso el diseño es «leer y olvidar».
 */
import { createHmac } from "node:crypto";
import type { Paso } from "@/lib/adapters/types";
import { aFechaBogota } from "@/lib/format/fechas";
import { clasificarEtapa, type EtapaKommo } from "./kommo";
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
  /** text, picture, voice… */
  tipo?: string | null;
  /** Saliente automático (Salesbot / bot de Kommo: llega sin usuario o con usuario 0). */
  bot?: boolean;
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
        /* el bot de Kommo escribe como usuario 0: no es una asesora */
        const usuario = texto1(nodo.author?.user_id);
        const asesoraId = saliente && usuario && usuario !== "0" ? usuario : null;
        salida.push({
          direccion: saliente ? "saliente" : "entrante",
          conversacion: conv,
          lead: String(nodo.entity_type ?? "") === "lead" ? texto1(nodo.entity_id) : null,
          texto: typeof nodo.text === "string" ? nodo.text : "",
          creadoEn: Number.isFinite(t) && t > 0 ? t : Math.floor(Date.now() / 1000),
          asesoraId,
          origen: texto1(nodo.origin),
          tipo: texto1(nodo.message_type),
          bot: saliente && !asesoraId,
        });
      }
      return;
    }
    for (const [k, v] of Object.entries(nodo)) visitar(v, [...ruta, k], profundidad + 1);
  };
  visitar(raiz, [], 0);
  return salida;
}

/** Aviso de una conversación (talk) de Kommo: sirve para saber si la asesora la cerró. */
export interface TalkKommo {
  conversacion: string;
  /** false = cerrada en Kommo. */
  enTrabajo: boolean | null;
}

const bool = (v: unknown): boolean | null => (v === true || v === "1" || v === 1 || v === "true" ? true : v === false || v === "0" || v === 0 || v === "false" ? false : null);

export function extraerTalks(raiz: unknown): TalkKommo[] {
  const salida: TalkKommo[] = [];
  const t = (raiz as Json)?.talk;
  if (!t || typeof t !== "object") return salida;
  for (const accion of Object.values(t)) {
    for (const x of Array.isArray(accion) ? accion : Object.values(accion ?? {})) {
      const conv = texto1((x as Json)?.talk_id);
      if (conv) salida.push({ conversacion: conv, enTrabajo: bool((x as Json)?.is_in_work) });
    }
  }
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
  /** Id del anuncio en Meta: cruza con su gasto. */
  anuncioId?: string | null;
}

const SIN: Omit<Atribucion, "nivel"> = { cuenta: null, campana: null, anuncio: null, anuncioId: null };

/**
 * El primer mensaje de la persona contra el mensaje predeterminado de cada anuncio. Solo se atribuye
 * lo que es seguro: un anuncio exacto, o el único ACTIVO entre varios con el mismo mensaje, o el único
 * parecido. Si dos campañas tienen el mismo mensaje se dice «ambiguo»; no se inventa.
 */
export function atribuir(texto: string, anuncios: ReadonlyArray<AnuncioMensaje>): Atribucion {
  if (!texto.trim()) return { nivel: "ninguno", ...SIN };
  if (esGenerico(texto)) return { nivel: "generico", ...SIN };
  const conMensaje = anuncios.filter((a) => a.predeterminado);
  const tomar = (a: AnuncioMensaje, nivel: NivelAtribucion): Atribucion => ({ nivel, cuenta: a.cuenta, campana: a.campana, anuncio: a.anuncio, anuncioId: a.id });
  const { exactos, parecidos } = buscarMensajeExacto(conMensaje, texto);
  if (exactos.length === 1) return tomar(exactos[0]!, "exacto");
  if (exactos.length > 1) {
    const activos = exactos.filter((a) => a.estado === "ACTIVE");
    if (activos.length === 1) return tomar(activos[0]!, "activo");
    const campanas = new Set(exactos.map((a) => `${a.cuentaId}|${a.campana}`));
    if (campanas.size === 1) return { nivel: "ambiguo", cuenta: exactos[0]!.cuenta, campana: exactos[0]!.campana, anuncio: null, anuncioId: null };
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
  /** La asesora la cerró en Kommo (sin respuesta: no hacía falta, p. ej. un «gracias»). */
  cerrada?: boolean;
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

/** Kommo avisa que una conversación se cerró (o se reabrió). Solo afecta conversaciones que ya vimos. */
export function aplicarTalk(estado: EstadoConversaciones, t: TalkKommo, secreto: string): EstadoConversaciones {
  const clave = huella(secreto, t.conversacion);
  const c = estado.conversaciones[clave];
  if (!c || t.enTrabajo == null) return estado;
  const cerrada = t.enTrabajo === false;
  if (!!c.cerrada === cerrada) return estado;
  return { ...estado, conversaciones: { ...estado.conversaciones, [clave]: { ...c, cerrada } } };
}

/** Hora (0–23) en Bogotá de un instante en segundos. */
const horaBogota = (seg: number) => Number(new Date(seg * 1000).toLocaleString("en-US", { timeZone: "America/Bogota", hour: "numeric", hour12: false })) % 24;

export interface Pendiente {
  huella: string;
  esperaSeg: number;
  atribucion: Atribucion;
}

/**
 * Conversaciones que llevan más de `minutos` sin respuesta de una persona. Solo las que empezaron en
 * horario de atención (lo de la noche sale en el resumen de la mañana), que no se cerraron en Kommo y
 * que no son tan viejas como para avisar a destiempo.
 */
export function pendientesDeRespuesta(estado: EstadoConversaciones, ahora: number, o: { minutos?: number; horaDesde?: number; horaHasta?: number; maxHoras?: number } = {}): Pendiente[] {
  const { minutos = 60, horaDesde = 7, horaHasta = 19, maxHoras = 12 } = o;
  return Object.entries(estado.conversaciones)
    .filter(([, c]) => c.respuesta == null && !c.cerrada)
    .map(([h, c]) => ({ huella: h, esperaSeg: ahora - c.inicio, atribucion: c.atribucion, hora: horaBogota(c.inicio) }))
    .filter((p) => p.esperaSeg >= minutos * 60 && p.esperaSeg <= maxHoras * 3600 && p.hora >= horaDesde && p.hora < horaHasta)
    .sort((a, b) => b.esperaSeg - a.esperaSeg)
    .map(({ huella: h, esperaSeg, atribucion }) => ({ huella: h, esperaSeg, atribucion }));
}

/* ───────────── 3b. Cruce con el embudo de Kommo ───────────── */

/** Dónde va hoy el lead de una conversación (por su etapa en Kommo). Sin id: va por su huella. */
export interface LeadEnEmbudo {
  paso: Paso;
  perdido: boolean;
  valor: number | null;
}

export interface EmbudoConversaciones {
  version: 1;
  actualizadoEn: string;
  /** huella del lead → su etapa. */
  leads: Record<string, LeadEnEmbudo>;
  /** id de usuario de Kommo → cómo se llama la asesora (personal de la clínica, no pacientes). */
  asesoras: Record<string, string>;
}

/** Los leads de Kommo cuyas huellas aparecen en las conversaciones, con su paso del embudo. */
export function cruzarLeads(huellas: ReadonlySet<string>, leads: ReadonlyArray<{ id: number | string; etapaId: number; precio: number }>, etapas: ReadonlyArray<EtapaKommo>, manual: Record<string, Paso>, secreto: string): Record<string, LeadEnEmbudo> {
  const porEtapa = new Map(etapas.map((e) => [e.id, e]));
  const salida: Record<string, LeadEnEmbudo> = {};
  for (const l of leads) {
    const h = huella(secreto, `lead:${l.id}`);
    if (!huellas.has(h)) continue;
    const etapa = porEtapa.get(Number(l.etapaId));
    const paso = etapa ? clasificarEtapa(etapa, manual) : "lead_calificado";
    salida[h] = { paso: paso ?? "lead_calificado", perdido: paso == null, valor: paso === "venta" && l.precio > 0 ? l.precio : null };
  }
  return salida;
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
const division = (a: number | null | undefined, b: number) => (a == null || !b ? null : Math.round(a / b));

/** Lead → cita → asistió → venta de un grupo de conversaciones (según la etapa de su lead en Kommo). */
export interface EmbudoGrupo {
  conversaciones: number;
  /** Conversaciones cuyo lead de Kommo ya se pudo cruzar. */
  conLead: number;
  citas: number;
  asistieron: number;
  ventas: number;
  valor: number;
}

export interface FilaAnuncio extends EmbudoGrupo {
  cuenta: string;
  campana: string;
  anuncio: string | null;
  anuncioId: string | null;
  atendidas: number;
  medianaSeg: number | null;
  certeza: NivelAtribucion;
  /** Gasto del anuncio en el periodo (Meta). null si no se sabe. */
  gasto: number | null;
  costoConversacion: number | null;
  costoCita: number | null;
  costoVenta: number | null;
}

export interface ResumenConversaciones {
  desde: string;
  hasta: string;
  nuevas: number;
  identificadas: number;
  porAnuncio: FilaAnuncio[];
  sinIdentificar: { total: number; genericas: number; ambiguas: number; ninguno: number };
  /** Todas las conversaciones del periodo (identificadas o no) por el embudo de Kommo. */
  embudo: EmbudoGrupo;
  atencion: {
    atendidas: number;
    /** Sin respuesta de una persona, sin cerrar y con más de una hora de espera. */
    sinRespuesta: number;
    /** Cerradas en Kommo sin que una persona respondiera (p. ej. un «gracias» al final). */
    cerradasSinRespuesta: number;
    hasta5min: number;
    hasta15min: number;
    hasta60min: number;
    medianaSeg: number | null;
    porAsesora: { asesoraId: string; asesora: string | null; atendidas: number; medianaSeg: number | null; hasta15min: number }[];
  };
}

export interface OpcionesResumen {
  desde: string;
  hasta: string;
  ahora?: number;
  embudo?: Record<string, LeadEnEmbudo>;
  /** id del anuncio en Meta → gasto en el periodo. */
  gastoPorAnuncio?: Record<string, number>;
  asesoras?: Record<string, string>;
}

const ORDEN_PASOS: Paso[] = ["lead_calificado", "cita_agendada", "cita_asistida", "venta"];
const llego = (l: LeadEnEmbudo | undefined, p: Paso) => !!l && ORDEN_PASOS.indexOf(l.paso) >= ORDEN_PASOS.indexOf(p);

function sumarEmbudo(lista: ReadonlyArray<ConversacionGuardada>, embudo: Record<string, LeadEnEmbudo>): EmbudoGrupo {
  const g: EmbudoGrupo = { conversaciones: lista.length, conLead: 0, citas: 0, asistieron: 0, ventas: 0, valor: 0 };
  /* un mismo lead puede tener dos conversaciones: su cita o venta cuenta una vez en el grupo */
  const vistos = new Set<string>();
  for (const c of lista) {
    const l = c.lead ? embudo[c.lead] : undefined;
    if (!l || vistos.has(c.lead!)) continue;
    vistos.add(c.lead!);
    g.conLead++;
    if (llego(l, "cita_agendada")) g.citas++;
    if (llego(l, "cita_asistida")) g.asistieron++;
    if (llego(l, "venta")) {
      g.ventas++;
      g.valor += l.valor ?? 0;
    }
  }
  return g;
}

export function resumir(estado: EstadoConversaciones, o: OpcionesResumen): ResumenConversaciones {
  const ahora = o.ahora ?? Math.floor(Date.now() / 1000);
  const embudo = o.embudo ?? {};
  const lista = Object.values(estado.conversaciones).filter((c) => c.dia >= o.desde && c.dia <= o.hasta);
  const grupos = new Map<string, { a: Atribucion; lista: ConversacionGuardada[] }>();
  const sin = { total: 0, genericas: 0, ambiguas: 0, ninguno: 0 };
  let identificadas = 0;
  for (const c of lista) {
    const a = c.atribucion;
    if (a.campana && a.cuenta) {
      identificadas++;
      const k = a.anuncioId ? `id:${a.anuncioId}` : `${a.cuenta}|${a.campana}|${a.anuncio ?? ""}`;
      const g = grupos.get(k) ?? { a, lista: [] };
      g.lista.push(c);
      grupos.set(k, g);
    } else {
      sin.total++;
      if (a.nivel === "generico") sin.genericas++;
      else if (a.nivel === "ambiguo") sin.ambiguas++;
      else sin.ninguno++;
    }
  }
  const porAnuncio: FilaAnuncio[] = [...grupos.values()].map(({ a, lista: l }) => {
    const e = sumarEmbudo(l, embudo);
    const tiempos = l.filter((c) => c.respuesta != null).map((c) => c.respuesta!);
    const gasto = a.anuncioId && o.gastoPorAnuncio && a.anuncioId in o.gastoPorAnuncio ? o.gastoPorAnuncio[a.anuncioId]! : null;
    return {
      ...e,
      cuenta: a.cuenta!,
      campana: a.campana!,
      anuncio: a.anuncio,
      anuncioId: a.anuncioId ?? null,
      atendidas: tiempos.length,
      medianaSeg: mediana(tiempos),
      certeza: a.nivel,
      gasto,
      costoConversacion: division(gasto, e.conversaciones),
      costoCita: division(gasto, e.citas),
      costoVenta: division(gasto, e.ventas),
    };
  });
  porAnuncio.sort((x, y) => y.ventas - x.ventas || y.citas - x.citas || y.conversaciones - x.conversaciones);

  const atendidas = lista.filter((c) => c.respuesta != null);
  const tiempos = atendidas.map((c) => c.respuesta!);
  const porAse = new Map<string, number[]>();
  for (const c of atendidas) porAse.set(c.asesoraId ?? "?", [...(porAse.get(c.asesoraId ?? "?") ?? []), c.respuesta!]);
  return {
    desde: o.desde,
    hasta: o.hasta,
    nuevas: lista.length,
    identificadas,
    porAnuncio,
    sinIdentificar: sin,
    embudo: sumarEmbudo(lista, embudo),
    atencion: {
      atendidas: atendidas.length,
      sinRespuesta: lista.filter((c) => c.respuesta == null && !c.cerrada && ahora - c.inicio > 3600).length,
      cerradasSinRespuesta: lista.filter((c) => c.respuesta == null && c.cerrada).length,
      hasta5min: tiempos.filter((t) => t <= 300).length,
      hasta15min: tiempos.filter((t) => t <= 900).length,
      hasta60min: tiempos.filter((t) => t <= 3600).length,
      medianaSeg: mediana(tiempos),
      porAsesora: [...porAse.entries()]
        .map(([asesoraId, ts]) => ({ asesoraId, asesora: o.asesoras?.[asesoraId] ?? null, atendidas: ts.length, medianaSeg: mediana(ts), hasta15min: ts.filter((t) => t <= 900).length }))
        .sort((a, b) => b.atendidas - a.atendidas),
    },
  };
}
