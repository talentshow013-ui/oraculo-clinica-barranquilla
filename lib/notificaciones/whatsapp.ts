/**
 * WhatsApp en Telegram: el bloque del resumen (6, 12 y 18) y el aviso de conversaciones sin
 * respuesta. Sale del webhook de Kommo (solo conteos y tiempos; nunca un paciente). Texto HTML.
 */
import type { Pendiente, ResumenConversaciones } from "@/lib/adapters/kommo.conversaciones";

const esc = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const plural = (n: number, uno: string, varios: string) => `${n.toLocaleString("es-CO")} ${n === 1 ? uno : varios}`;

export function duracion(s: number | null): string {
  if (s == null) return "—";
  if (s < 60) return `${s} s`;
  if (s < 3600) return `${Math.round(s / 60)} min`;
  const h = Math.floor(s / 3600);
  const m = Math.round((s % 3600) / 60);
  return m ? `${h} h ${m} min` : `${h} h`;
}

/** Líneas para el resumen: cuántas conversaciones, de qué anuncio, cómo se respondió y en qué terminaron. */
export function bloqueWhatsapp(r: ResumenConversaciones): string[] {
  const L = ["💬 <b>WhatsApp (Kommo)</b>"];
  if (!r.nuevas) return [...L, "Sin conversaciones nuevas."];
  L.push(`${plural(r.nuevas, "conversación nueva", "conversaciones nuevas")} · ${r.identificadas.toLocaleString("es-CO")} de anuncios identificados`);
  const a = r.atencion;
  L.push(`Respuesta: mitad en menos de ${duracion(a.medianaSeg)}${a.sinRespuesta ? ` · ⚠️ ${plural(a.sinRespuesta, "sin respuesta", "sin respuesta")} hace más de 1 h` : ""}`);
  if (r.embudo.citas || r.embudo.ventas) L.push(`De ahí: ${plural(r.embudo.citas, "cita", "citas")} · ${plural(r.embudo.ventas, "venta", "ventas")}`);
  const top = r.porAnuncio.slice(0, 2);
  if (top.length) L.push(`Más conversaciones: ${top.map((x) => `${esc(x.anuncio ?? x.campana)} (${x.conversaciones})`).join(" · ")}`);
  return L;
}

/** Un solo mensaje con todas las conversaciones que llevan más de 1 h sin respuesta de una persona. */
export function componerAvisoSinRespuesta(p: ReadonlyArray<Pendiente>, reloj: string, urlPanel?: string): string {
  const deAnuncio = new Map<string, number>();
  for (const x of p) if (x.atribucion.anuncio || x.atribucion.campana) deAnuncio.set(x.atribucion.anuncio ?? x.atribucion.campana!, (deAnuncio.get(x.atribucion.anuncio ?? x.atribucion.campana!) ?? 0) + 1);
  const L = [
    `⏰ <b>${p.length === 1 ? "1 conversación de WhatsApp lleva" : `${p.length} conversaciones de WhatsApp llevan`} más de 1 h sin respuesta</b> · ${esc(reloj)}`,
    `La que más espera: ${duracion(p[0]?.esperaSeg ?? null)}.`,
  ];
  if (deAnuncio.size) L.push(`Vienen de: ${[...deAnuncio.entries()].slice(0, 4).map(([n, c]) => `${esc(n)}${c > 1 ? ` (${c})` : ""}`).join(" · ")}`);
  L.push("Revisar en Kommo los chats sin responder.");
  if (urlPanel) L.push(`Panel: ${esc(urlPanel)}`);
  return L.join("\n");
}
