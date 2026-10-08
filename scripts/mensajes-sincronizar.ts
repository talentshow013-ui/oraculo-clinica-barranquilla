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
import { componerAvisoMensajes, esGenerico, fusionarMensajes, mensajeDeCreativo, type AnuncioMensaje } from "@/lib/adapters/meta.mensajes";
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
const ESTADOS = ["ACTIVE", "PAUSED", "CAMPAIGN_PAUSED", "ADSET_PAUSED", "ARCHIVED", "DISAPPROVED", "WITH_ISSUES", "IN_PROCESS", "PENDING_REVIEW", "PREAPPROVED"];

interface AnuncioApi {
  id: string;
  name: string;
  effective_status: string;
  created_time?: string;
  campaign?: { name?: string };
  creative?: Parameters<typeof mensajeDeCreativo>[0] & { effective_object_story_id?: string };
}

async function deCuenta(cuentaId: string, cuenta: string): Promise<AnuncioMensaje[]> {
  const salida: AnuncioMensaje[] = [];
  const p = new URLSearchParams({ fields: "name,effective_status,created_time,campaign{name},creative{object_story_id,effective_object_story_id,object_story_spec}", effective_status: JSON.stringify(ESTADOS), limit: "100", access_token: token! });
  let url: string | undefined = `https://graph.facebook.com/v25.0/${cuentaId}/ads?${p}`;
  for (let i = 0; url && i < 200; i++) {
    let j: { data?: AnuncioApi[]; paging?: { next?: string }; error?: { message: string } } = {};
    for (let intento = 1; intento <= 3; intento++) {
      j = (await (await fetch(url)).json()) as typeof j;
      if (!j.error) break;
      await new Promise((r) => setTimeout(r, 3000 * intento));
    }
    if (j.error) throw new Error(`${cuenta}: ${j.error.message}`);
    for (const a of j.data ?? []) {
      const m = mensajeDeCreativo(a.creative);
      salida.push({ id: a.id, cuenta, cuentaId, campana: a.campaign?.name ?? "", anuncio: a.name, estado: a.effective_status, creado: (a.created_time ?? "").slice(0, 10), predeterminado: m?.predeterminado ?? null, bienvenida: m?.bienvenida ?? null, desdePublicacion: !m && !!(a.creative?.object_story_id || a.creative?.effective_object_story_id), vistoPrimeraVez: "" });
    }
    url = j.paging?.next;
  }
  return salida;
}

async function main() {
  const hoy = hoyBogota();
  const recientes: AnuncioMensaje[] = [];
  for (const c of cliente.cuentasPublicitarias.filter((x) => (x.plataforma ?? "meta") === "meta")) {
    const de = await deCuenta(c.id, c.nombre);
    console.log(`  ${c.nombre}: ${de.length} anuncios · ${de.filter((a) => a.predeterminado).length} con mensaje`);
    recientes.push(...de);
  }
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
