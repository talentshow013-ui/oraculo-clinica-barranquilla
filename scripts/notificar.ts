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
      texto = componerResumenConciso(r, { momento, etiquetaDia: manana ? "Ayer (día completo)" : `Hoy hasta las ${reloj}`, urlPanel: process.env.ORACULO_URL_PANEL });
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
  } else if (arg("--archivo")) texto = recortar(readFileSync(arg("--archivo")!, "utf8").replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" })[c]!));
  else {
    const { motor } = await import("@/lib/datos");
    const base = await motor();
    const cuentas: ResumenCuenta[] = [];
    for (const c of base.cuentas) cuentas.push({ nombre: c.nombre, r: c.id === base.cuenta.id ? base : await motor(c.id) });
    texto = componerResumenDiario(cuentas, { hoy: base.hoy, urlPanel: process.env.ORACULO_URL_PANEL, estado: arg("--estado") });
  }
  /* varias personas: TELEGRAM_CHAT_ID=111,222 (cada una habló con el bot al menos una vez) */
  for (const c of chat.split(",").map((x) => x.trim()).filter(Boolean)) {
    const id = await enviarTelegram(token, c, texto);
    console.log(`✓ Enviado a Telegram (chat ${c}, mensaje ${id}).`);
  }
  despuesDeEnviar?.();
}

main().catch((e) => {
  console.error(`✗ ${e instanceof Error ? e.message : String(e)}`);
  process.exit(1);
});
