/**
 * Avisos por Telegram. Lo corre el reloj diario de la VPS al final; también sirve a mano.
 *
 *   npm run notificar -- --chats              → lista los chats que le han escrito al bot (para TELEGRAM_CHAT_ID)
 *   npm run notificar -- --prueba             → manda «Oráculo conectado»
 *   npm run notificar                         → resumen de la mañana (todas las cuentas, cifras del motor)
 *   npm run notificar -- --estado "texto"     → el resumen, con una línea de estado arriba
 *   npm run notificar -- --archivo ruta.md    → manda el contenido de un archivo (informe del lunes)
 *   npm run notificar -- --texto "mensaje"    → manda ese texto tal cual
 *   npm run notificar -- --alertas [momento]  → resumen corto: gasto, leads, costo por lead, 3 oportunidades y 3 riesgos (Meta y Google)
 *   npm run notificar -- --alertas --detalle  → la lista completa de alertas y de todo lo activo
 *   npm run notificar -- --nuevas             → al momento, solo lo urgente nuevo (anuncio rechazado, medición rota); de 9 p. m. a 6 a. m. calla
 *   … --simular                               → muestra el mensaje en pantalla y NO lo envía
 *   npm run notificar -- --sin-respuesta      → conversaciones de WhatsApp con más de 1 h sin respuesta (webhook de Kommo); un mensaje agrupado, máximo uno por hora
 *
 * Necesita en .env: TELEGRAM_BOT_TOKEN (de @BotFather) y TELEGRAM_CHAT_ID (uno o varios, separados por coma). Opcional: ORACULO_URL_PANEL.
 */
import { readFileSync } from "node:fs";
import { cargarEnv } from "@/lib/adapters/env";
import { chatsRecientes, componerResumenDiario, enviarTelegram, recortar, type ResumenCuenta } from "@/lib/notificaciones/telegram";
import { UMBRALES_CLINICA, claveAlerta, componerAlertasNuevas, componerAvisoPauta, evaluarAlertas, type TipoAlerta } from "@/lib/notificaciones/alertas";
import { componerResumenConciso, resumenConciso } from "@/lib/notificaciones/resumen";
import { sumarDias } from "@/lib/format/fechas";
import type { InsightRow } from "@/lib/adapters/types";
import { existsSync, writeFileSync } from "node:fs";
import { cargarConversaciones } from "@/lib/adapters/conversaciones.archivo";
import { pendientesDeRespuesta } from "@/lib/adapters/kommo.conversaciones";
import { resumenWhatsapp } from "@/lib/conversaciones";
import { bloqueWhatsapp, componerAvisoSinRespuesta } from "@/lib/notificaciones/whatsapp";

cargarEnv();
const arg = (n: string) => {
  const i = process.argv.indexOf(n);
  return i >= 0 ? process.argv[i + 1] : undefined;
};
const tiene = (n: string) => process.argv.includes(n);
const token = process.env.TELEGRAM_BOT_TOKEN;
const chat = process.env.TELEGRAM_CHAT_ID;

/** Cada cuenta de pauta (Meta, TikTok y Google Ads) con sus filas, recién leídas de los archivos. */
async function cuentasDePauta(): Promise<{ hoy: string; cuentas: { nombre: string; insights: InsightRow[] }[] }> {
  const { correrMotor } = await import("@/lib/datos");
  const cuentas: { nombre: string; insights: InsightRow[] }[] = [];
  let hoy = "";
  for (const plataforma of ["pauta", "google"] as const) {
    const base = await correrMotor(undefined, { plataforma });
    hoy = base.hoy;
    for (const c of base.cuentas) {
      if (c.id === "sin_cuenta") continue;
      const r = c.id === base.cuenta.id ? base : await correrMotor(undefined, { plataforma, cuentaId: c.id });
      cuentas.push({ nombre: c.nombre, insights: r.loteCuenta.insights });
    }
  }
  return { hoy, cuentas };
}

const RUTA_AVISADAS = "datos/alertas-avisadas.json";
function marcarAvisadas(hoy: string, claves: string[]) {
  let previas: string[] = [];
  try {
    const x = JSON.parse(readFileSync(RUTA_AVISADAS, "utf8")) as { fecha: string; claves: string[] };
    if (x.fecha === hoy) previas = x.claves;
  } catch {}
  writeFileSync(RUTA_AVISADAS, JSON.stringify({ fecha: hoy, claves: [...new Set([...previas, ...claves])] }));
}
const horaBogota = () => Number(new Date().toLocaleString("en-US", { timeZone: "America/Bogota", hour: "numeric", hour12: false }));

async function main() {
  if (!token) {
    console.error("✗ Falta TELEGRAM_BOT_TOKEN en .env (lo da @BotFather con /newbot).");
    process.exit(1);
  }
  if (tiene("--chats")) {
    const chats = await chatsRecientes(token);
    if (!chats.length) console.log("Nadie le ha escrito al bot todavía. Ábrelo en Telegram, pulsa «Iniciar» (o agrégalo a un grupo y escribe algo) y vuelve a correr esto.");
    for (const c of chats) console.log(`${c.id}  ${c.nombre}  (${c.tipo})   → TELEGRAM_CHAT_ID=${c.id}`);
    return;
  }
  if (!chat) {
    console.error("✗ Falta TELEGRAM_CHAT_ID en .env. Descúbrelo con: npm run notificar -- --chats");
    process.exit(1);
  }
  let texto: string;
  let despuesDeEnviar: (() => void) | null = null;
  if (tiene("--prueba")) texto = "🔮 Oráculo conectado. Cada mañana llega aquí el resumen del día.";
  else if (arg("--texto")) texto = arg("--texto")!;
  else if (tiene("--alertas")) {
    const { hoy, cuentas } = await cuentasDePauta();
    const hora = horaBogota();
    const momento = arg("--alertas") && !arg("--alertas")!.startsWith("--") ? arg("--alertas")! : hora < 11 ? "6 a. m." : hora < 16 ? "12 m." : "6 p. m.";
    if (tiene("--detalle")) texto = componerAvisoPauta(cuentas, { hoy, momento, umbrales: UMBRALES_CLINICA, urlPanel: process.env.ORACULO_URL_PANEL });
    else {
      /* lo que pidió la clínica: gasto, leads, costo por lead, 3 oportunidades y 3 riesgos. A las 6 a. m. el día completo de ayer; después, hoy hasta ahora */
      const manana = hora < 11;
      const reloj = new Date().toLocaleTimeString("es-CO", { timeZone: "America/Bogota", hour: "numeric", minute: "2-digit" });
      const r = resumenConciso(cuentas, manana ? sumarDias(hoy, -1) : hoy, hoy, UMBRALES_CLINICA);
      /* WhatsApp (webhook de Kommo): solo en la VPS, donde viven las conversaciones */
      const dia = manana ? sumarDias(hoy, -1) : hoy;
      const wa = resumenWhatsapp({ desde: dia, hasta: dia });
      texto = componerResumenConciso(r, { momento, etiquetaDia: manana ? "Ayer (día completo)" : `Hoy hasta las ${reloj}`, urlPanel: process.env.ORACULO_URL_PANEL, whatsapp: wa ? bloqueWhatsapp(wa) : undefined });
    }
    despuesDeEnviar = () => marcarAvisadas(hoy, cuentas.flatMap((c) => evaluarAlertas(c.insights, hoy, UMBRALES_CLINICA).map((a) => claveAlerta(c.nombre, a))));
  } else if (tiene("--nuevas")) {
    const hora = horaBogota();
    if (hora < 6 || hora >= 21 || tiene("--solo-marcar")) {
      if (tiene("--solo-marcar")) {
        const { hoy, cuentas } = await cuentasDePauta();
        marcarAvisadas(hoy, cuentas.flatMap((c) => evaluarAlertas(c.insights, hoy, UMBRALES_CLINICA).map((a) => claveAlerta(c.nombre, a))));
        console.log("· alertas actuales marcadas como avisadas (sin enviar)");
        return;
      }
      console.log("· de noche no se avisa; lo nuevo sale en el resumen de las 6 a. m.");
      return;
    }
    const { hoy, cuentas } = await cuentasDePauta();
    let avisadas: { fecha: string; claves: string[] } = { fecha: hoy, claves: [] };
    try {
      if (existsSync(RUTA_AVISADAS)) avisadas = JSON.parse(readFileSync(RUTA_AVISADAS, "utf8"));
    } catch {}
    const ya = new Set(avisadas.fecha === hoy ? avisadas.claves : []);
    /* al momento solo lo urgente: anuncio rechazado o medición rota. Lo demás va en el resumen de 6, 12 y 18 */
    const URGENTES: TipoAlerta[] = ["rechazado", "sin_conversiones"];
    const nuevas = cuentas
      .flatMap((c) => evaluarAlertas(c.insights, hoy, UMBRALES_CLINICA).map((alerta) => ({ cuenta: c.nombre, alerta })))
      .filter((x) => URGENTES.includes(x.alerta.tipo) && !ya.has(claveAlerta(x.cuenta, x.alerta)));
    if (!nuevas.length) {
      console.log("· sin alertas nuevas");
      return;
    }
    const reloj = new Date().toLocaleTimeString("es-CO", { timeZone: "America/Bogota", hour: "2-digit", minute: "2-digit", hour12: false });
    texto = componerAlertasNuevas(nuevas, reloj, process.env.ORACULO_URL_PANEL);
    despuesDeEnviar = () => writeFileSync(RUTA_AVISADAS, JSON.stringify({ fecha: hoy, claves: [...ya, ...nuevas.map((x) => claveAlerta(x.cuenta, x.alerta))] }));
  } else if (tiene("--sin-respuesta")) {
    const hora = horaBogota();
    if (hora < 6 || hora >= 21) {
      console.log("· de noche no se avisa");
      return;
    }
    const ahora = Math.floor(Date.now() / 1000);
    const pendientes = pendientesDeRespuesta(cargarConversaciones(), ahora);
    const RUTA = "datos/sin-respuesta-avisadas.json";
    let previo: { ultimoEnvio: number; huellas: Record<string, number> } = { ultimoEnvio: 0, huellas: {} };
    try {
      if (existsSync(RUTA)) previo = JSON.parse(readFileSync(RUTA, "utf8"));
    } catch {}
    /* se olvidan las de más de 2 días; se avisa solo si hay alguna nueva y como mucho una vez por hora */
    const huellas = Object.fromEntries(Object.entries(previo.huellas).filter(([, t]) => ahora - t < 2 * 86_400));
    const nuevas = pendientes.filter((p) => !(p.huella in huellas));
    if (!nuevas.length || ahora - previo.ultimoEnvio < 3600) {
      console.log(`· ${pendientes.length} sin respuesta · ${nuevas.length} nuevas · ${nuevas.length ? "ya se avisó hace menos de 1 h" : "nada nuevo que avisar"}`);
      writeFileSync(RUTA, JSON.stringify({ ultimoEnvio: previo.ultimoEnvio, huellas }));
      return;
    }
    const reloj = new Date().toLocaleTimeString("es-CO", { timeZone: "America/Bogota", hour: "2-digit", minute: "2-digit", hour12: false });
    texto = componerAvisoSinRespuesta(pendientes, reloj, process.env.ORACULO_URL_PANEL);
    despuesDeEnviar = () => writeFileSync(RUTA, JSON.stringify({ ultimoEnvio: ahora, huellas: { ...huellas, ...Object.fromEntries(pendientes.map((p) => [p.huella, ahora])) } }));
  } else if (arg("--archivo")) texto = recortar(readFileSync(arg("--archivo")!, "utf8").replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" })[c]!));
  else {
    const { motor } = await import("@/lib/datos");
    const base = await motor();
    const cuentas: ResumenCuenta[] = [];
    for (const c of base.cuentas) cuentas.push({ nombre: c.nombre, r: c.id === base.cuenta.id ? base : await motor(c.id) });
    texto = componerResumenDiario(cuentas, { hoy: base.hoy, urlPanel: process.env.ORACULO_URL_PANEL, estado: arg("--estado") });
  }
  /* --simular: muestra el mensaje sin enviarlo ni marcar nada (para probar en la VPS sin molestar a nadie) */
  if (tiene("--simular")) {
    console.log(texto);
    return;
  }
  /* varias personas: TELEGRAM_CHAT_ID=111,222 (cada una habló con el bot al menos una vez) */
  /* si una persona no ha abierto el bot todavía, a las demás les llega igual */
  let enviados = 0;
  for (const c of chat.split(",").map((x) => x.trim()).filter(Boolean)) {
    try {
      const id = await enviarTelegram(token, c, texto);
      enviados++;
      console.log(`✓ Enviado a Telegram (chat ${c}, mensaje ${id}).`);
    } catch (e) {
      console.error(`✗ Chat ${c}: ${e instanceof Error ? e.message : String(e)} (¿ya abrió el bot y pulsó «Iniciar»?)`);
    }
  }
  if (!enviados) throw new Error("no se pudo enviar a ningún chat");
  despuesDeEnviar?.();
}

main().catch((e) => {
  console.error(`✗ ${e instanceof Error ? e.message : String(e)}`);
  process.exit(1);
});
