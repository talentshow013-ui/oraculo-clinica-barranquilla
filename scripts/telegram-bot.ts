/**
 * Oráculo que responde por Telegram. Escucha el bot (texto, notas de voz y fotos), arma el contexto
 * con el motor y contesta con Gemini. Corre todo el tiempo en la VPS (servicio `oraculo-telegram`).
 *
 *   npm run telegram:bot
 *
 * Necesita en .env: TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID (uno o varios, coma) y GEMINI_API_KEY.
 * Solo contesta a los chats de la lista; a los demás, silencio. Nunca cambia nada en las plataformas.
 * El contexto se recalcula como mucho cada 2 minutos (el motor tarda segundos).
 */
import { cargarEnv } from "@/lib/adapters/env";
import { MODELOS_GEMINI, INSTRUCCION_SISTEMA, armarPeticionGemini, chatPermitido, componerContexto, extraerTextoGemini, limpiarParaTelegram, tipoDeMensaje, type CuentaParaBot } from "@/lib/notificaciones/bot";
import { enviarTelegram, recortar } from "@/lib/notificaciones/telegram";

cargarEnv();
const token = process.env.TELEGRAM_BOT_TOKEN;
const chats = process.env.TELEGRAM_CHAT_ID;
const gemini = process.env.GEMINI_API_KEY;
if (!token || !chats || !gemini) {
  console.error("✗ Faltan en .env: TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID y GEMINI_API_KEY.");
  process.exit(1);
}
const API = `https://api.telegram.org/bot${token}`;
const log = (t: string) => console.log(`${new Date().toISOString()} ${t}`);

/* ---- contexto del motor, con caché corta ---- */
let cache: { hasta: number; texto: string } | null = null;
async function contexto(): Promise<string> {
  if (cache && Date.now() < cache.hasta) return cache.texto;
  const { motor } = await import("@/lib/datos");
  const base = await motor();
  const cuentas: CuentaParaBot[] = [];
  for (const c of base.cuentas) cuentas.push({ nombre: c.nombre, r: c.id === base.cuenta.id ? base : await motor(c.id) });
  const texto = componerContexto(cuentas, base.hoy);
  cache = { hasta: Date.now() + 2 * 60_000, texto };
  return texto;
}

/* ---- Telegram ---- */
async function descargar(fileId: string): Promise<string> {
  const r = await fetch(`${API}/getFile?file_id=${encodeURIComponent(fileId)}`);
  const j = (await r.json()) as { ok: boolean; result?: { file_path?: string; file_size?: number } };
  if (!j.ok || !j.result?.file_path) throw new Error("Telegram no entregó el archivo");
  if ((j.result.file_size ?? 0) > 15 * 1024 * 1024) throw new Error("archivo mayor de 15 MB");
  const bytes = await (await fetch(`https://api.telegram.org/file/bot${token}/${j.result.file_path}`)).arrayBuffer();
  return Buffer.from(bytes).toString("base64");
}
async function escribiendo(chatId: string) {
  await fetch(`${API}/sendChatAction`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ chat_id: chatId, action: "typing" }) }).catch(() => undefined);
}
async function responder(chatId: string, texto: string) {
  /* texto plano: sin parse_mode, así ningún carácter rompe el envío */
  const r = await fetch(`${API}/sendMessage`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ chat_id: chatId, text: recortar(texto), disable_web_page_preview: true }) });
  const j = (await r.json()) as { ok: boolean; description?: string };
  if (!j.ok) throw new Error(`Telegram respondió: ${j.description ?? "error"}`);
}

/* ---- Gemini ---- */
async function preguntarGemini(ctx: string, texto: string, adjunto: { mime: string; base64: string } | null): Promise<string> {
  const cuerpo = JSON.stringify(armarPeticionGemini({ sistema: INSTRUCCION_SISTEMA, contexto: ctx, texto, adjunto }));
  let ultimo = "";
  /* si un modelo está saturado (503) o retirado (404), se pasa al siguiente de la lista */
  for (const modelo of MODELOS_GEMINI) {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent?key=${gemini}`, { method: "POST", headers: { "content-type": "application/json" }, body: cuerpo });
    const j: unknown = await r.json();
    const t = extraerTextoGemini(j);
    if (t) return limpiarParaTelegram(t);
    ultimo = `${modelo}: ${JSON.stringify(j).slice(0, 160)}`;
    log(`gemini ${ultimo}`);
  }
  throw new Error(`Gemini sin respuesta (${ultimo})`);
}

/* ---- ciclo ---- */
interface Update { update_id: number; message?: { message_id: number; chat: { id: number }; text?: string; caption?: string; voice?: { file_id: string; mime_type?: string }; audio?: { file_id: string; mime_type?: string }; photo?: { file_id: string; width?: number }[]; document?: { file_id: string; mime_type?: string } } }

async function atender(m: NonNullable<Update["message"]>) {
  const chatId = String(m.chat.id);
  if (!chatPermitido(chatId, chats)) { log(`ignorado chat ${chatId}`); return; }
  const e = tipoDeMensaje(m);
  if (e.tipo === "otro") { await responder(chatId, "Mándame texto, una nota de voz o una foto y te respondo."); return; }
  await escribiendo(chatId);
  try {
    const adjunto = e.tipo === "texto" ? null : { mime: e.mime, base64: await descargar(e.fileId) };
    const t = await preguntarGemini(await contexto(), e.texto, adjunto);
    await responder(chatId, t);
    log(`respondí a ${chatId} (${e.tipo})`);
  } catch (err) {
    log(`error con ${chatId}: ${err instanceof Error ? err.message : String(err)}`);
    await responder(chatId, "No pude responder ahora mismo. Inténtalo en un minuto.").catch(() => undefined);
  }
}

async function main() {
  log(`Oráculo escuchando en Telegram (${MODELOS_GEMINI.join(" → ")}); chats: ${chats}`);
  let offset = 0;
  /* lo que llegó mientras el bot estaba apagado no se contesta: nadie quiere respuestas de ayer */
  const viejo = (await (await fetch(`${API}/getUpdates?offset=-1`)).json()) as { result?: Update[] };
  if (viejo.result?.length) offset = viejo.result[viejo.result.length - 1]!.update_id + 1;
  for (;;) {
    try {
      const r = await fetch(`${API}/getUpdates?timeout=50&offset=${offset}&allowed_updates=%5B%22message%22%5D`);
      const j = (await r.json()) as { ok: boolean; result?: Update[] };
      for (const u of j.result ?? []) {
        offset = u.update_id + 1;
        if (u.message) await atender(u.message);
      }
    } catch (err) {
      log(`ciclo: ${err instanceof Error ? err.message : String(err)}`);
      await new Promise((res) => setTimeout(res, 5000));
    }
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
