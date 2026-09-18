/**
 * Dice qué tiene y qué le falta a ESTE equipo para correr Oráculo completo.
 * No arregla nada: informa en lenguaje claro y con el comando para resolverlo.
 *
 *   npm run doctor
 */
import { existsSync, readFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { resolve } from "node:path";

type Estado = "ok" | "falta" | "opcional";
const filas: { estado: Estado; que: string; como: string }[] = [];
const ok = (que: string, como = "") => filas.push({ estado: "ok", que, como });
const falta = (que: string, como: string) => filas.push({ estado: "falta", que, como });
const opcional = (que: string, como: string) => filas.push({ estado: "opcional", que, como });
const raiz = process.cwd();
const hay = (p: string) => existsSync(resolve(raiz, p));

// Node
const mayor = Number(process.versions.node.split(".")[0]);
if (mayor >= 20) ok(`Node.js ${process.versions.node}`);
else falta(`Node.js ${process.versions.node} es muy antiguo`, "Instala la versión LTS desde https://nodejs.org");

// Dependencias
if (hay("node_modules/next")) ok("Dependencias instaladas");
else falta("Dependencias no instaladas", "npm install");

// Configuración
if (hay(".env")) ok(".env presente");
else falta("Falta .env", "copia .env.example a .env (o corre instalar.ps1)");
const fuente = hay(".env") ? /ORACULO_FUENTE=(\w+)/.exec(readFileSync(resolve(raiz, ".env"), "utf8"))?.[1] ?? "seed" : "seed";

// Datos
if (fuente === "archivo") {
  if (hay("datos/lote.json")) ok("Datos reales: datos/lote.json");
  else falta("ORACULO_FUENTE=archivo pero no existe datos/lote.json", "corre /oraculo-sincronizar en Claude Code, o pon ORACULO_FUENTE=seed para la demostración");
} else {
  if (hay("datos/seed.json")) ok("Datos de demostración: datos/seed.json");
  else falta("Faltan los datos de demostración", "npm run seed");
}
if (hay("datos/experimentos.json")) ok("Memoria de experimentos: datos/experimentos.json");
else opcional("Sin datos/experimentos.json", 'crea el archivo con "[]" (instalar.ps1 lo hace)');

// Orgánico (Instagram y Facebook sin pauta)
const envTexto = hay(".env") ? readFileSync(resolve(raiz, ".env"), "utf8") : "";
if (/^META_ORGANICO_TOKEN=.+$/m.test(envTexto)) {
  if (hay("datos/organico.json")) ok("Orgánico conectado y con datos: datos/organico.json");
  else opcional("Orgánico conectado pero sin datos todavía", "npm run organico:sincronizar -- --dias 90");
} else {
  opcional("Orgánico (Instagram y Facebook) sin conectar", "npm run organico:conectar -- <token>  (docs/CONEXION_ORGANICO.md)");
}

// Pauta de TikTok
if (/^TIKTOK_ACCESS_TOKEN=.+$/m.test(envTexto) && /^TIKTOK_ADVERTISER_ID=.+$/m.test(envTexto)) {
  if (hay("datos/tiktok.json")) ok("Pauta de TikTok conectada y con datos: datos/tiktok.json");
  else opcional("Pauta de TikTok conectada pero sin datos todavía", "npm run tiktok:sincronizar -- --dias 90");
} else {
  opcional("Pauta de TikTok sin conectar", "TIKTOK_ACCESS_TOKEN y TIKTOK_ADVERTISER_ID en .env (docs/CONEXION_TIKTOK.md)");
}

// Pauta de Google Ads
if (/^GOOGLE_ADS_REFRESH_TOKEN=.+$/m.test(envTexto) && /^GOOGLE_ADS_CUSTOMER_ID=.+$/m.test(envTexto)) {
  if (hay("datos/googleads.json")) ok("Pauta de Google Ads conectada y con datos: datos/googleads.json");
  else opcional("Pauta de Google Ads conectada pero sin datos todavía", "npm run googleads:sincronizar -- --dias 90");
} else {
  opcional("Pauta de Google Ads sin conectar", "npm run googleads:conectar (docs/CONEXION_GOOGLE_ADS.md)");
}

// Sitio web (Google Analytics 4)
if (/^GA4_PROPIEDAD_ID=.+$/m.test(envTexto) && hay("datos/ga4-credenciales.json")) {
  if (hay("datos/web.json")) ok("Sitio web conectado y con datos: datos/web.json");
  else opcional("Sitio web conectado pero sin datos todavía", "npm run web:sincronizar -- --dias 90");
} else {
  opcional("Sitio web (Google Analytics) sin conectar", "GA4_PROPIEDAD_ID en .env + llave en datos/ga4-credenciales.json (docs/CONEXION_GA4.md)");
}

// Telegram
if (/^TELEGRAM_BOT_TOKEN=.+$/m.test(envTexto) && /^TELEGRAM_CHAT_ID=.+$/m.test(envTexto)) ok("Avisos por Telegram configurados");
else opcional("Avisos por Telegram sin configurar", "bot con @BotFather → TELEGRAM_BOT_TOKEN en .env → npm run notificar -- --chats → TELEGRAM_CHAT_ID");

// Radar
let chromium = false;
try {
  const cfg = JSON.parse(readFileSync(resolve(raiz, "node_modules/playwright-core/browsers.json"), "utf8")) as { browsers: { name: string; revision: string }[] };
  const rev = cfg.browsers.find((b) => b.name === "chromium")?.revision;
  const base = process.env.PLAYWRIGHT_BROWSERS_PATH ?? resolve(process.env.LOCALAPPDATA ?? "", "ms-playwright");
  chromium = !!rev && existsSync(resolve(base, `chromium-${rev}`));
} catch {
  chromium = false;
}
if (chromium) ok("Navegador para el radar de competencia (Chromium)");
else opcional("Sin navegador para el radar de competencia", "npx playwright install chromium  (si falla la descarga, usar el camino Apify: docs/CONEXION_MCP.md)");
if (hay("config/competidores.json")) ok("Lista de competidores: config/competidores.json");
else opcional("Sin lista de competidores", "copia config/competidores.example.json a config/competidores.json y pon 6-10 páginas del radio");
if (hay("datos/radar-ui.json") || hay("datos/radar-apify.json")) ok("Hay una captura del radar");
else opcional("Aún no se ha capturado el radar", 'npm run radar:capturar -- --q "clínica estética barranquilla"');

// Conectores en Claude Code
let mcp = "";
try {
  mcp = execSync("claude mcp list", { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], timeout: 20000 });
} catch {
  mcp = "";
}
if (mcp) {
  if (/mcp\.facebook\.com\/ads/.test(mcp)) ok("Conector de Campañas y audiencias (Meta) configurado en Claude Code");
  else falta("Conector de Campañas y audiencias (Meta) no configurado", "claude mcp add --transport http --client-id <META_APP_ID> meta-ads https://mcp.facebook.com/ads  (ver docs/CONEXION_MCP.md)");
  if (/mcp\.apify\.com/.test(mcp)) ok("Conector del radar (Apify) disponible en Claude Code");
  else opcional("Conector del radar (Apify) no aparece", "abre este repositorio en Claude Code y acepta el .mcp.json del proyecto (o usa la captura propia)");
} else {
  opcional("No se pudo consultar Claude Code (claude mcp list)", "abre el repositorio en Claude Code; el .mcp.json declara el conector del radar");
}

// Calibración
try {
  const cliente = readFileSync(resolve(raiz, "config/cliente.ts"), "utf8");
  const calibrado = /ticketCOP:\s*[1-9]\d*/.test(cliente);
  if (calibrado) ok("Tickets calibrados en config/cliente.ts");
  else falta("Tickets y costos en cero: el retorno sobre margen se mostrará como «—»", "calibra config/cliente.ts con la clínica (reunión 1)");
} catch {
  /* sin config */
}

const icono: Record<Estado, string> = { ok: "  OK   ", falta: " FALTA ", opcional: " OPC.  " };
console.log("ORÁCULO · doctor · qué tiene este equipo\n");
for (const f of filas) console.log(`${icono[f.estado]} ${f.que}${f.como ? `\n         → ${f.como}` : ""}`);
const faltan = filas.filter((f) => f.estado === "falta").length;
console.log(`\n${faltan === 0 ? "Todo lo necesario está. Lo opcional mejora el radar y el margen." : `${faltan} cosa(s) necesaria(s) por resolver.`}`);
process.exitCode = faltan === 0 ? 0 : 1;
