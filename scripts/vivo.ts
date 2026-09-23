/**
 * ORÁCULO EN VIVO: corre todo el día en la VPS (servicio `oraculo-vivo`, se reinicia solo).
 * Trae cada fuente sin parar y, cada vez que entra pauta nueva, revisa las alertas y avisa por
 * Telegram las que acaban de aparecer.
 *
 *   Meta y Google Ads ........ cada 10 minutos (ayer y hoy)
 *   Kommo, orgánico y web .... cada 30 minutos
 *
 * El panel y el bot de Telegram leen los archivos en cada consulta: quedan en vivo solos.
 * El estado de cada fuente queda en `datos/estado-vivo.json` (última vez bien, último error).
 * Si una fuente lleva más de 1 hora fallando, se avisa una vez por Telegram; y otra cuando vuelve.
 *
 *   npm run vivo            → el ciclo (lo corre el servicio)
 *   npm run vivo -- --una   → una sola pasada de todo (para probar)
 */
import { spawn } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { cargarEnv } from "@/lib/adapters/env";

cargarEnv();
const e = process.env;
const log = (t: string) => console.log(`${new Date().toLocaleString("sv-SE", { timeZone: "America/Bogota" })} ${t}`);
const RUTA_ESTADO = "datos/estado-vivo.json";

interface Tarea {
  nombre: string;
  script: string;
  args: string[];
  cadaMin: number;
  /** false si falta la llave en .env: no se intenta. */
  activa: boolean;
  /** Tras traerla, ¿hay que revisar alertas de pauta? */
  alertas: boolean;
}

const TAREAS: Tarea[] = [
  { nombre: "Meta", script: "meta:sincronizar", args: ["--dias", "2"], cadaMin: 10, activa: !!e.META_ORGANICO_TOKEN, alertas: true },
  { nombre: "Google Ads", script: "googleads:sincronizar", args: ["--dias", "2"], cadaMin: 10, activa: !!e.GOOGLE_ADS_REFRESH_TOKEN, alertas: true },
  { nombre: "Kommo", script: "kommo:sincronizar", args: ["--dias", "2"], cadaMin: 30, activa: !!e.KOMMO_TOKEN, alertas: false },
  { nombre: "Orgánico", script: "organico:sincronizar", args: ["--dias", "3"], cadaMin: 30, activa: !!e.META_ORGANICO_TOKEN, alertas: false },
  { nombre: "Sitio web", script: "web:sincronizar", args: ["--dias", "3"], cadaMin: 30, activa: !!e.GA4_PROPIEDAD_ID, alertas: false },
];

interface EstadoFuente {
  ultimaBien: string | null;
  ultimoIntento: string | null;
  ultimoError: string | null;
  fallandoDesde: string | null;
  avisadoCaida: boolean;
}
type Estado = Record<string, EstadoFuente>;

function leerEstado(): Estado {
  try {
    return existsSync(RUTA_ESTADO) ? (JSON.parse(readFileSync(RUTA_ESTADO, "utf8")) as Estado) : {};
  } catch {
    return {};
  }
}
const guardarEstado = (s: Estado) => writeFileSync(RUTA_ESTADO, JSON.stringify(s, null, 2));

/** Corre `npm run -s <script> -- <args>` con tiempo máximo; devuelve la salida o lanza con el error. */
function correr(script: string, args: string[], maxMin = 8): Promise<string> {
  return new Promise((resolver, rechazar) => {
    const p = spawn("npm", ["run", "-s", script, "--", ...args], { cwd: process.cwd(), env: process.env });
    let salida = "";
    p.stdout.on("data", (d) => (salida += d));
    p.stderr.on("data", (d) => (salida += d));
    const reloj = setTimeout(() => p.kill("SIGKILL"), maxMin * 60_000);
    p.on("close", (codigo) => {
      clearTimeout(reloj);
      if (codigo === 0) resolver(salida);
      else rechazar(new Error(salida.trim().split("\n").slice(-2).join(" ").slice(0, 300) || `salió con código ${codigo}`));
    });
  });
}

const telegramListo = () => !!e.TELEGRAM_BOT_TOKEN && !!e.TELEGRAM_CHAT_ID;
async function avisar(texto: string) {
  if (!telegramListo()) return;
  await correr("notificar", ["--texto", texto], 2).catch((err) => log(`telegram: ${(err as Error).message}`));
}

async function pasar(t: Tarea, estado: Estado): Promise<boolean> {
  const s: EstadoFuente = estado[t.nombre] ?? { ultimaBien: null, ultimoIntento: null, ultimoError: null, fallandoDesde: null, avisadoCaida: false };
  const ahora = new Date().toISOString();
  s.ultimoIntento = ahora;
  try {
    await correr(t.script, t.args);
    if (s.avisadoCaida) await avisar(`✅ ${t.nombre} volvió a traer datos.`);
    Object.assign(s, { ultimaBien: ahora, ultimoError: null, fallandoDesde: null, avisadoCaida: false });
    log(`${t.nombre}: al día`);
    return true;
  } catch (err) {
    s.ultimoError = (err as Error).message;
    s.fallandoDesde ??= ahora;
    log(`${t.nombre}: FALLÓ · ${s.ultimoError}`);
    const minutos = (Date.now() - Date.parse(s.fallandoDesde)) / 60_000;
    if (minutos >= 60 && !s.avisadoCaida) {
      s.avisadoCaida = true;
      await avisar(`⚠️ ${t.nombre} lleva ${Math.round(minutos)} minutos sin poder traer datos. Lo último que hay es de ${s.ultimaBien ? new Date(s.ultimaBien).toLocaleString("es-CO", { timeZone: "America/Bogota" }) : "antes"}. Motivo: ${s.ultimoError}`);
    }
    return false;
  } finally {
    estado[t.nombre] = s;
    guardarEstado(estado);
  }
}

async function ciclo(una: boolean) {
  const proxima = new Map<string, number>();
  log(`Oráculo en vivo · ${TAREAS.filter((t) => t.activa).map((t) => `${t.nombre} cada ${t.cadaMin} min`).join(" · ")}`);
  for (;;) {
    const estado = leerEstado();
    let pautaNueva = false;
    for (const t of TAREAS) {
      if (!t.activa) continue;
      if (!una && Date.now() < (proxima.get(t.nombre) ?? 0)) continue;
      proxima.set(t.nombre, Date.now() + t.cadaMin * 60_000);
      if ((await pasar(t, estado)) && t.alertas) pautaNueva = true;
    }
    if (pautaNueva && telegramListo()) {
      await correr("notificar", ["--nuevas"], 4)
        .then((s) => log(`alertas: ${s.includes("Enviado") ? "avisadas por Telegram" : "sin nada nuevo"}`))
        .catch((err) => log(`alertas: ${(err as Error).message}`));
    }
    if (una) return;
    await new Promise((r) => setTimeout(r, 60_000));
  }
}

ciclo(process.argv.includes("--una")).catch((err) => {
  console.error(err);
  process.exit(1);
});
