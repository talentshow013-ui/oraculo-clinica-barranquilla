/**
 * Avisos por Telegram. Lo corre el reloj diario de la VPS al final; también sirve a mano.
 *
 *   npm run notificar -- --chats              → lista los chats que le han escrito al bot (para TELEGRAM_CHAT_ID)
 *   npm run notificar -- --prueba             → manda «Oráculo conectado»
 *   npm run notificar                         → resumen de la mañana (todas las cuentas, cifras del motor)
 *   npm run notificar -- --estado "texto"     → el resumen, con una línea de estado arriba
 *   npm run notificar -- --archivo ruta.md    → manda el contenido de un archivo (informe del lunes)
 *   npm run notificar -- --texto "mensaje"    → manda ese texto tal cual
 *   npm run notificar -- --alertas [momento]  → alertas de la clínica (CPL > 4.000, rechazados, CTR bajo, bajo rendimiento) y estado de todo lo activo
 *
 * Necesita en .env: TELEGRAM_BOT_TOKEN (de @BotFather) y TELEGRAM_CHAT_ID (uno o varios, separados por coma). Opcional: ORACULO_URL_PANEL.
 */
import { readFileSync } from "node:fs";
import { cargarEnv } from "@/lib/adapters/env";
import { chatsRecientes, componerResumenDiario, enviarTelegram, recortar, type ResumenCuenta } from "@/lib/notificaciones/telegram";
import { UMBRALES_CLINICA, componerAvisoPauta } from "@/lib/notificaciones/alertas";

cargarEnv();
const arg = (n: string) => {
  const i = process.argv.indexOf(n);
  return i >= 0 ? process.argv[i + 1] : undefined;
};
const tiene = (n: string) => process.argv.includes(n);
const token = process.env.TELEGRAM_BOT_TOKEN;
const chat = process.env.TELEGRAM_CHAT_ID;

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
  if (tiene("--prueba")) texto = "🔮 Oráculo conectado. Cada mañana llega aquí el resumen del día.";
  else if (arg("--texto")) texto = arg("--texto")!;
  else if (tiene("--alertas")) {
    const { motor } = await import("@/lib/datos");
    const base = await motor();
    const cuentas: { nombre: string; insights: typeof base.loteCuenta.insights }[] = [];
    for (const c of base.cuentas) {
      const r = c.id === base.cuenta.id ? base : await motor(c.id);
      cuentas.push({ nombre: c.nombre, insights: r.loteCuenta.insights });
    }
    const hora = Number(new Date().toLocaleString("en-US", { timeZone: "America/Bogota", hour: "numeric", hour12: false }));
    const momento = arg("--alertas") && !arg("--alertas")!.startsWith("--") ? arg("--alertas")! : hora < 11 ? "6 a. m." : hora < 16 ? "12 m." : "6 p. m.";
    texto = componerAvisoPauta(cuentas, { hoy: base.hoy, momento, umbrales: UMBRALES_CLINICA, urlPanel: process.env.ORACULO_URL_PANEL });
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
}

main().catch((e) => {
  console.error(`✗ ${e instanceof Error ? e.message : String(e)}`);
  process.exit(1);
});
