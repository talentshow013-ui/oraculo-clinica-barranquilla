/**
 * «¿Cuánto llevamos hoy?» en vivo: trae Meta y Google Ads en el momento y muestra, por cuenta y por
 * campaña, el gasto, los resultados (columna «Resultados») y el costo por resultado de hoy y de ayer.
 * No manda nada a Telegram.
 *
 *   npm run hoy                → trae y muestra
 *   npm run hoy -- --sin-traer → solo muestra lo que ya hay
 *   npm run hoy -- --json      → lo mismo en JSON
 */
import { spawnSync } from "node:child_process";
import { cargarEnv } from "@/lib/adapters/env";
import type { InsightRow } from "@/lib/adapters/types";
import { cop, num } from "@/lib/format";
import { fechaCorta, hoyBogota } from "@/lib/format/fechas";
import { resumenDelDia, type CifrasDia } from "@/lib/metrics/dia";

cargarEnv();
process.env.ORACULO_FUENTE ||= "archivo";
const json = process.argv.includes("--json");
const aviso = (t: string) => (json ? process.stderr.write(`${t}\n`) : console.log(t));

function traer(script: string, args: string[]): string {
  const r = spawnSync("npm", ["run", "-s", script, "--", ...args], { encoding: "utf8", env: process.env });
  return r.status === 0 ? "al día" : `falló (${(r.stderr || r.stdout).trim().split("\n").pop()?.slice(0, 120)})`;
}

async function main() {
  if (!process.argv.includes("--sin-traer")) {
    if (process.env.META_ORGANICO_TOKEN) aviso(`· Meta: ${traer("meta:sincronizar", ["--dias", "2"])}`);
    if (process.env.GOOGLE_ADS_REFRESH_TOKEN) aviso(`· Google Ads: ${traer("googleads:sincronizar", ["--dias", "2"])}`);
  }
  const { correrMotor } = await import("@/lib/datos");
  const cuentas: { nombre: string; insights: InsightRow[] }[] = [];
  for (const plataforma of ["pauta", "google"] as const) {
    const base = await correrMotor(undefined, { plataforma });
    for (const c of base.cuentas) {
      if (c.id === "sin_cuenta") continue;
      const r = c.id === base.cuenta.id ? base : await correrMotor(undefined, { plataforma, cuentaId: c.id });
      cuentas.push({ nombre: c.nombre, insights: r.loteCuenta.insights });
    }
  }
  const hoy = hoyBogota();
  const r = resumenDelDia(cuentas, hoy);
  if (json) {
    process.stdout.write(JSON.stringify(r, null, 2));
    return;
  }
  const linea = (x: CifrasDia) => `${cop(x.gasto)} · ${num(x.resultados)} resultados · ${x.costoPorResultado == null ? "—" : cop(x.costoPorResultado)} c/u`;
  const hora = new Date().toLocaleTimeString("es-CO", { timeZone: "America/Bogota", hour: "2-digit", minute: "2-digit" });
  console.log(`\nHOY ${fechaCorta(hoy)} (a las ${hora}) · fuente: API de Meta y Google Ads`);
  for (const c of r.cuentas) {
    console.log(`\n${c.nombre}\n  hoy:  ${linea(c.hoy)}\n  ayer: ${linea(c.ayer)}`);
    for (const k of c.campanas) console.log(`    · ${k.nombre}: ${linea(k)}`);
  }
  console.log(`\nTOTAL hoy:  ${linea(r.total.hoy)}\nTOTAL ayer: ${linea(r.total.ayer)}`);
}

main().catch((e) => {
  console.error(`✗ ${e instanceof Error ? e.message : String(e)}`);
  process.exit(1);
});
