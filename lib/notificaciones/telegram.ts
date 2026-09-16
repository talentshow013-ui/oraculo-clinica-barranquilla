/**
 * Avisos por Telegram: el reloj diario de la VPS manda un resumen cada mañana (y el informe los
 * lunes) al chat de la clínica. Un bot de Telegram (BotFather) y dos claves en `.env`:
 * `TELEGRAM_BOT_TOKEN` y `TELEGRAM_CHAT_ID`. Nada de esto va al repositorio.
 *
 * El texto lo compone el motor (cifras reales); aquí solo se arma y se envía. Sin jerga.
 */
import type { ResultadoMotor } from "@/lib/datos";
import { cop, num, pct } from "@/lib/format";
import { fechaCorta } from "@/lib/format/fechas";
import { delta } from "@/lib/metrics/core";

export const LARGO_MAXIMO = 4000; // Telegram corta en 4096

const esc = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const signo = (v: number | null) => (v == null ? "" : ` (${v >= 0 ? "+" : ""}${pct(v, 0)} vs 14 d antes)`);

export interface ResumenCuenta {
  nombre: string;
  r: Pick<ResultadoMotor, "reciente" | "previa" | "hallazgos" | "plataEnRiesgoTotal" | "organico" | "hoy" | "lote">;
}

/** Resumen de la mañana: una línea por cuenta con pauta, la plata en riesgo, los 3 hallazgos que más pesan y el orgánico. */
export function componerResumenDiario(cuentas: ReadonlyArray<ResumenCuenta>, opciones: { urlPanel?: string; estado?: string; hoy: string }): string {
  const lineas: string[] = [`🔮 <b>Oráculo · ${esc(fechaCorta(opciones.hoy))}</b>`];
  if (opciones.estado) lineas.push(esc(opciones.estado));
  const conPauta = cuentas.filter((c) => (c.r.reciente.gasto ?? 0) > 0);
  if (conPauta.length) {
    lineas.push("", "<b>Pauta · últimos 14 días</b>");
    for (const c of conPauta) {
      const a = c.r.reciente;
      const d = delta(a.conversacionesIniciadas ?? null, c.r.previa.conversacionesIniciadas ?? null);
      lineas.push(`• ${esc(c.nombre)}: ${cop(a.gasto)} · ${num(a.conversacionesIniciadas)} conversaciones${signo(d)} · ${cop(a.costoConversacion)} por conversación`);
    }
  } else {
    lineas.push("", "Sin pauta activa en los últimos 14 días.");
  }
  const riesgo = cuentas.reduce<number | null>((acc, c) => (c.r.plataEnRiesgoTotal == null ? acc : (acc ?? 0) + c.r.plataEnRiesgoTotal), null);
  if (riesgo != null && riesgo > 0) lineas.push("", `⚠️ <b>Plata en riesgo: ${cop(riesgo)}</b>`);
  const hallazgos = cuentas
    .flatMap((c) => c.r.hallazgos.filter((h) => h.severidad === "alta").map((h) => ({ cuenta: c.nombre, h })))
    .sort((x, y) => (y.h.plataEnRiesgo ?? 0) - (x.h.plataEnRiesgo ?? 0))
    .slice(0, 3);
  if (hallazgos.length) {
    lineas.push("", "<b>Lo que más pesa hoy</b>");
    hallazgos.forEach(({ cuenta, h }, i) => lineas.push(`${i + 1}. ${esc(h.titulo)}${h.plataEnRiesgo ? ` · ${cop(h.plataEnRiesgo)}` : ""} <i>(${esc(cuenta)})</i>`));
  }
  const o = cuentas[0]?.r.organico;
  if (o && !o.sinDatos) {
    const ig = o.redes.find((x) => x.red === "instagram");
    const partes: string[] = [];
    if (ig?.seguidoresGanados != null) partes.push(`${ig.seguidoresGanados >= 0 ? "+" : ""}${num(ig.seguidoresGanados)} seguidores en Instagram`);
    if (ig?.tasaInteraccion != null) partes.push(`interacción ${pct(ig.tasaInteraccion)}`);
    if (o.paraPauta.length) partes.push(`${o.paraPauta.length === 1 ? "1 publicación merece" : `${o.paraPauta.length} publicaciones merecen`} pauta`);
    if (partes.length) lineas.push("", `<b>Orgánico</b> · ${esc(partes.join(" · "))}`);
  }
  if (opciones.urlPanel) lineas.push("", `Panel: ${esc(opciones.urlPanel)}`);
  return recortar(lineas.join("\n"));
}

export function recortar(texto: string, maximo = LARGO_MAXIMO): string {
  const c = Array.from(texto);
  return c.length > maximo ? c.slice(0, maximo - 1).join("") + "…" : texto;
}

/** Envía un mensaje (HTML de Telegram). Devuelve el id del mensaje. */
export async function enviarTelegram(token: string, chatId: string, texto: string, fetchFn: typeof fetch = fetch): Promise<number> {
  const r = await fetchFn(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text: recortar(texto), parse_mode: "HTML", disable_web_page_preview: true }),
  });
  const json = (await r.json()) as { ok: boolean; description?: string; result?: { message_id: number } };
  if (!json.ok) throw new Error(`Telegram respondió: ${json.description ?? "error"}`);
  return json.result?.message_id ?? 0;
}

/** Chats que le han escrito al bot (para descubrir el TELEGRAM_CHAT_ID). */
export async function chatsRecientes(token: string, fetchFn: typeof fetch = fetch): Promise<{ id: string; nombre: string; tipo: string }[]> {
  const r = await fetchFn(`https://api.telegram.org/bot${token}/getUpdates`);
  const json = (await r.json()) as { ok: boolean; description?: string; result?: Array<{ message?: { chat?: { id: number; type: string; title?: string; first_name?: string; username?: string } }; my_chat_member?: { chat?: { id: number; type: string; title?: string; first_name?: string; username?: string } } }> };
  if (!json.ok) throw new Error(`Telegram respondió: ${json.description ?? "error"}`);
  const vistos = new Map<string, { id: string; nombre: string; tipo: string }>();
  for (const u of json.result ?? []) {
    const chat = u.message?.chat ?? u.my_chat_member?.chat;
    if (chat) vistos.set(String(chat.id), { id: String(chat.id), nombre: chat.title ?? chat.first_name ?? chat.username ?? "(sin nombre)", tipo: chat.type });
  }
  return [...vistos.values()];
}
