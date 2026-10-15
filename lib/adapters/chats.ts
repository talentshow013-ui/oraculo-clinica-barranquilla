/**
 * El TEXTO de las conversaciones de WhatsApp (webhook de Kommo), para leerlas y analizarlas cuando se
 * pida («revisa las conversaciones de ayer», «las que vienen de este anuncio»). Autorizado por el
 * responsable del proyecto el 2026-10-15.
 *
 * Cómo se cuida (son datos de salud, Ley 1581):
 * - Solo en la VPS, en `datos/chats/AAAA-MM-DD.chat`, cada línea CIFRADA (AES-256-GCM, llave
 *   `CHATS_LLAVE` del `.env`), archivos modo 600. Se borran solos a los 30 días.
 * - Antes de guardar se quitan teléfonos, correos y números de documento del texto.
 * - Nunca se guarda el nombre ni el teléfono del contacto, ni el id de Kommo: la conversación va por
 *   su huella (la misma de `datos/conversaciones.json`, que dice de qué anuncio vino).
 */
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { appendFileSync, chmodSync, existsSync, mkdirSync, readFileSync, readdirSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { aFechaBogota, fechaCorta, sumarDias } from "@/lib/format/fechas";
import type { EstadoConversaciones, LeadEnEmbudo, NivelAtribucion } from "./kommo.conversaciones";
import { normalizarMensaje } from "./meta.mensajes";

/* ───────────── quitar teléfonos, correos y documentos ───────────── */

/**
 * Correos → [correo]. Números de 10 o más dígitos (celulares, cédulas) → [número]. De 7 a 9 dígitos
 * también, salvo que parezcan precio ($ delante o puntos de miles: 1.200.000). Lo corto (precios de
 * seis cifras, horas, fechas, cantidades) se queda: sirve para analizar.
 */
export function redactar(texto: string): string {
  return texto
    .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, "[correo]")
    .replace(/\+?\d[\d .-]*\d/g, (m, i: number, s: string) => {
      const digitos = m.replace(/\D/g, "").length;
      if (digitos < 7) return m;
      if (digitos >= 10) return "[número]";
      const antes = s.slice(Math.max(0, i - 2), i);
      const precio = /\$\s?$/.test(antes) || /^\d{1,3}(\.\d{3})+$/.test(m.trim());
      return precio ? m : "[número]";
    });
}

/* ───────────── cifrado por línea ───────────── */

const llaveBuf = (llave: string) => Buffer.from(llave, "hex");

export function cifrar(llave: string, obj: unknown): string {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", llaveBuf(llave), iv);
  const ct = Buffer.concat([c.update(JSON.stringify(obj), "utf8"), c.final()]);
  return Buffer.concat([iv, c.getAuthTag(), ct]).toString("base64");
}

export function descifrar<T = unknown>(llave: string, linea: string): T | null {
  try {
    const b = Buffer.from(linea.trim(), "base64");
    const d = createDecipheriv("aes-256-gcm", llaveBuf(llave), b.subarray(0, 12));
    d.setAuthTag(b.subarray(12, 28));
    return JSON.parse(Buffer.concat([d.update(b.subarray(28)), d.final()]).toString("utf8")) as T;
  } catch {
    return null;
  }
}

/* ───────────── archivos por día ───────────── */

export interface RegistroChat {
  /** Segundos Unix. */
  t: number;
  /** Huella de la conversación. */
  conv: string;
  dir: "entrante" | "saliente";
  /** Ya sin teléfonos ni correos. */
  texto: string;
  /** text, picture, voice, file… */
  tipo: string | null;
  asesoraId: string | null;
  /** Mensaje automático (Salesbot / bot de Kommo). */
  bot: boolean;
}

const ARCHIVO = /^(\d{4}-\d{2}-\d{2})\.chat$/;

export function guardarChats(dir: string, llave: string, registros: ReadonlyArray<RegistroChat>): void {
  if (!registros.length) return;
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  const porDia = new Map<string, string[]>();
  for (const r of registros) {
    const dia = aFechaBogota(new Date(r.t * 1000));
    porDia.set(dia, [...(porDia.get(dia) ?? []), cifrar(llave, r)]);
  }
  for (const [dia, lineas] of porDia) {
    const ruta = join(dir, `${dia}.chat`);
    appendFileSync(ruta, lineas.join("\n") + "\n", { encoding: "utf8", mode: 0o600 });
    try {
      chmodSync(ruta, 0o600);
    } catch {
      /* Windows */
    }
  }
}

export function leerChats(dir: string, llave: string, desde: string, hasta: string): RegistroChat[] {
  if (!existsSync(dir)) return [];
  const salida: RegistroChat[] = [];
  for (const f of readdirSync(dir).sort()) {
    const m = ARCHIVO.exec(f);
    if (!m || m[1]! < desde || m[1]! > hasta) continue;
    for (const linea of readFileSync(join(dir, f), "utf8").split("\n")) {
      if (!linea.trim()) continue;
      const r = descifrar<RegistroChat>(llave, linea);
      if (r) salida.push(r);
    }
  }
  return salida.sort((a, b) => a.t - b.t);
}

/** Borra los días con más de `dias` días. */
export function purgarChats(dir: string, hoy: string, dias = 30): void {
  if (!existsSync(dir)) return;
  const limite = sumarDias(hoy, -dias);
  for (const f of readdirSync(dir)) {
    const m = ARCHIVO.exec(f);
    if (m && m[1]! < limite) unlinkSync(join(dir, f));
  }
}

/* ───────────── conversaciones legibles ───────────── */

export interface ConversacionLegible {
  huella: string;
  inicio: number;
  dia: string;
  cuenta: string | null;
  campana: string | null;
  anuncio: string | null;
  anuncioId: string | null;
  certeza: NivelAtribucion | null;
  asesora: string | null;
  /** cita agendada, asistió, venta, perdido, sin cita aún; null = aún sin cruzar con Kommo. */
  resultado: string | null;
  primeraRespuestaSeg: number | null;
  mensajes: { t: number; quien: string; texto: string }[];
}

const RESULTADO: Record<string, string> = { lead_calificado: "sin cita aún", cita_agendada: "cita agendada", cita_asistida: "asistió", venta: "venta" };
const SIN_TEXTO: Record<string, string> = { picture: "[foto]", voice: "[nota de voz]", audio: "[audio]", video: "[video]", file: "[archivo]", sticker: "[sticker]", location: "[ubicación]" };

export function unirConversaciones(registros: ReadonlyArray<RegistroChat>, estado: EstadoConversaciones, embudo: Record<string, LeadEnEmbudo>, asesoras: Record<string, string>): ConversacionLegible[] {
  const porConv = new Map<string, RegistroChat[]>();
  for (const r of registros) porConv.set(r.conv, [...(porConv.get(r.conv) ?? []), r]);
  const nombre = (id: string | null) => (id ? (asesoras[id] ?? `Asesora ${id}`) : null);
  return [...porConv.entries()]
    .map(([huella, rs]) => {
      const c = estado.conversaciones[huella];
      const l = c?.lead ? embudo[c.lead] : undefined;
      const inicio = c?.inicio ?? rs[0]!.t;
      return {
        huella,
        inicio,
        dia: c?.dia ?? aFechaBogota(new Date(inicio * 1000)),
        cuenta: c?.atribucion.cuenta ?? null,
        campana: c?.atribucion.campana ?? null,
        anuncio: c?.atribucion.anuncio ?? null,
        anuncioId: c?.atribucion.anuncioId ?? null,
        certeza: c?.atribucion.nivel ?? null,
        asesora: nombre(c?.asesoraId ?? rs.find((r) => r.asesoraId)?.asesoraId ?? null),
        resultado: l ? (l.perdido ? "perdido" : (RESULTADO[l.paso] ?? null)) : null,
        primeraRespuestaSeg: c?.respuesta ?? null,
        mensajes: rs.map((r) => ({ t: r.t, quien: r.dir === "entrante" ? "Paciente" : r.asesoraId ? nombre(r.asesoraId)! : "Bot", texto: r.texto.trim() || SIN_TEXTO[r.tipo ?? ""] || "[sin texto]" })),
      };
    })
    .sort((a, b) => a.inicio - b.inicio);
}

export interface FiltroChats {
  /** Parte del nombre del anuncio, la campaña o la cuenta. */
  anuncio?: string;
  /** Ids de anuncios (p. ej. los que tienen un mensaje predeterminado que alguien pegó). */
  anuncioIds?: ReadonlySet<string>;
  asesora?: string;
  /** cita (agendó o más), venta, sin-cita. */
  resultado?: "cita" | "venta" | "sin-cita";
  /** Ninguna persona de la clínica respondió. */
  sinRespuesta?: boolean;
}

export function filtrarConversaciones(lista: ReadonlyArray<ConversacionLegible>, f: FiltroChats): ConversacionLegible[] {
  const n = (t: string | null | undefined) => normalizarMensaje(t ?? "");
  const conCita = (r: string | null) => r === "cita agendada" || r === "asistió" || r === "venta";
  return lista.filter((c) => {
    if (f.anuncio || f.anuncioIds) {
      const porNombre = !!f.anuncio && [c.anuncio, c.campana, c.cuenta].some((x) => n(x).includes(n(f.anuncio)));
      const porId = !!f.anuncioIds && !!c.anuncioId && f.anuncioIds.has(c.anuncioId);
      if (!porNombre && !porId) return false;
    }
    if (f.asesora && !n(c.asesora).includes(n(f.asesora))) return false;
    if (f.resultado === "cita" && !conCita(c.resultado)) return false;
    if (f.resultado === "venta" && c.resultado !== "venta") return false;
    if (f.resultado === "sin-cita" && conCita(c.resultado)) return false;
    if (f.sinRespuesta && c.mensajes.some((m) => m.quien !== "Paciente" && m.quien !== "Bot")) return false;
    return true;
  });
}

const hora = (t: number) => new Date(t * 1000).toLocaleTimeString("es-CO", { timeZone: "America/Bogota", hour: "2-digit", minute: "2-digit", hour12: false });
const dur = (s: number | null) => (s == null ? "sin respuesta de una persona" : s < 60 ? `${s} s` : s < 3600 ? `${Math.round(s / 60)} min` : `${Math.floor(s / 3600)} h ${Math.round((s % 3600) / 60)} min`);

/** Texto para leer y analizar: un bloque por conversación. */
export function formatearConversaciones(lista: ReadonlyArray<ConversacionLegible>): string {
  return lista
    .map((c, i) => {
      const origen = c.anuncio || c.campana ? `${c.cuenta} · ${c.campana}${c.anuncio ? ` · ${c.anuncio}` : ""}${c.certeza && c.certeza !== "exacto" ? ` (${c.certeza})` : ""}` : "sin anuncio identificado";
      return [
        `━━ ${i + 1}/${lista.length} · ${fechaCorta(c.dia)} ${hora(c.inicio)} · ${origen}`,
        `   Atendió: ${c.asesora ?? "nadie todavía"} · primera respuesta: ${dur(c.primeraRespuestaSeg)} · en Kommo: ${c.resultado ?? "aún sin cruzar"}`,
        ...c.mensajes.map((m) => `   ${hora(m.t)} ${m.quien}: ${m.texto.replace(/\s*\n\s*/g, " / ")}`),
      ].join("\n");
    })
    .join("\n\n");
}
