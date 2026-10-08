/**
 * Trae el mensaje predeterminado de WhatsApp de TODOS los anuncios de las cuentas de la clínica
 * (activos, pausados y archivados: miles) a `datos/mensajes.json`. Lo corre el servicio en vivo cada
 * hora; así un anuncio que lancen hoy queda buscable en la siguiente hora.
 *
 *   npm run mensajes:sincronizar             → actualiza el archivo
 *   npm run mensajes:sincronizar -- --avisar → además avisa por Telegram los anuncios nuevos y su mensaje
 *                                              (de 6 a. m. a 9 p. m.; si no, quedan para la próxima)
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { cargarEnv } from "@/lib/adapters/env";
import { cliente } from "@/config/cliente";
import { componerAvisoMensajes, esGenerico, fusionarMensajes, type AnuncioMensaje } from "@/lib/adapters/meta.mensajes";
import { ESTADOS_TODOS, traerAnuncios } from "@/lib/adapters/meta.mensajes.api";
import { enviarTelegram } from "@/lib/notificaciones/telegram";
import { hoyBogota } from "@/lib/format/fechas";

cargarEnv();
const token = process.env.META_ORGANICO_TOKEN;
if (!token) {
  console.error("✗ Falta META_ORGANICO_TOKEN en .env");
  process.exit(1);
}
const RUTA_MENSAJES = "datos/mensajes.json";
const RUTA_PENDIENTES = "datos/mensajes-por-avisar.json";
async function main() {
  const hoy = hoyBogota();
  const cuentas = cliente.cuentasPublicitarias.filter((x) => (x.plataforma ?? "meta") === "meta");
  const recientes = await traerAnuncios(token!, cuentas, ESTADOS_TODOS, (t) => console.log(t));
  const viejo = existsSync(RUTA_MENSAJES) ? (JSON.parse(readFileSync(RUTA_MENSAJES, "utf8")) as { anuncios: AnuncioMensaje[] }).anuncios : null;
  const { todos, nuevos } = fusionarMensajes(viejo, recientes, hoy);
  mkdirSync("datos", { recursive: true });
  writeFileSync(RUTA_MENSAJES, JSON.stringify({ capturadoEn: new Date().toISOString(), anuncios: todos }), "utf8");
  console.log(`✓ ${todos.length} anuncios en ${RUTA_MENSAJES} · ${todos.filter((a) => a.predeterminado).length} con mensaje · ${nuevos.length} nuevos desde la última vez`);

  if (!process.argv.includes("--avisar")) return;
  /* los nuevos se acumulan hasta que se puedan avisar (de noche no se manda nada) */
  const pendientes: AnuncioMensaje[] = existsSync(RUTA_PENDIENTES) ? (JSON.parse(readFileSync(RUTA_PENDIENTES, "utf8")) as AnuncioMensaje[]) : [];
  const porAvisar = [...pendientes, ...nuevos.filter((n) => !pendientes.some((p) => p.id === n.id))];
  const hora = Number(new Date().toLocaleString("en-US", { timeZone: "America/Bogota", hour: "numeric", hour12: false })) % 24;
  const bot = process.env.TELEGRAM_BOT_TOKEN;
  const chats = (process.env.TELEGRAM_CHAT_ID ?? "").split(",").map((x) => x.trim()).filter(Boolean);
  if (!porAvisar.length || !bot || !chats.length || hora < 6 || hora >= 21) {
    writeFileSync(RUTA_PENDIENTES, JSON.stringify(porAvisar), "utf8");
    return;
  }
  const veces = new Map<string, number>();
  for (const a of todos) if (a.predeterminado && a.estado === "ACTIVE") veces.set(a.predeterminado, (veces.get(a.predeterminado) ?? 0) + 1);
  const texto = componerAvisoMensajes(porAvisar.map((a) => ({ anuncio: a.anuncio, cuenta: a.cuenta, predeterminado: a.predeterminado, repetido: !!a.predeterminado && !esGenerico(a.predeterminado) && (veces.get(a.predeterminado) ?? 0) > 1 })));
  let enviados = 0;
  for (const c of chats) {
    try {
      await enviarTelegram(bot, c, texto);
      enviados++;
    } catch (e) {
      console.error(`✗ Telegram ${c}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  writeFileSync(RUTA_PENDIENTES, JSON.stringify(enviados ? [] : porAvisar), "utf8");
  if (enviados) console.log(`✓ Avisados por Telegram ${porAvisar.length} anuncios nuevos`);
}

main().catch((e) => {
  console.error(`✗ ${e instanceof Error ? e.message : String(e)}`);
  process.exit(1);
});
