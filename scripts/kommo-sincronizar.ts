/**
 * Trae el embudo de pacientes desde Kommo (solo lectura) a `datos/kommo.json`: leads por día y
 * fuente, citas agendadas, asistidas y ventas, AGREGADOS (nunca una persona). El panel lo fusiona
 * con el embudo al leer.
 *
 *   npm run kommo:sincronizar                → últimos 30 días (incremental)
 *   npm run kommo:sincronizar -- --dias 90   → primera vez
 *
 * Necesita en .env: KOMMO_SUBDOMINIO y KOMMO_TOKEN (token de larga duración). Etapas con nombres
 * raros → config/kommo.json ({ "<statusId>": "cita_agendada" | "cita_asistida" | "venta" }).
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { cargarEnv } from "@/lib/adapters/env";
import { LoteKommoSchema, RUTA_KOMMO, parsearKommo } from "@/lib/adapters/kommo.archivo";
import { crearPeticionKommo, fusionarKommo, sincronizarKommo } from "@/lib/adapters/kommo";
import type { FuenteAtribuida, Paso } from "@/lib/adapters/types";
import { hoyBogota, sumarDias } from "@/lib/format/fechas";
import { validarSinPII } from "@/lib/privacy";

cargarEnv();
const iDias = process.argv.indexOf("--dias");
const dias = iDias >= 0 ? Number(process.argv[iDias + 1]) : 30;
const sub = process.env.KOMMO_SUBDOMINIO;
const token = process.env.KOMMO_TOKEN;
if (!sub || !token) {
  console.error("✗ Falta la conexión con Kommo: KOMMO_SUBDOMINIO y KOMMO_TOKEN en .env (docs/CONEXION_KOMMO.md).");
  process.exit(1);
}
/** config/kommo.json: { "etapas": { "<statusId>": "cita_agendada" }, "fuentes": { "<sourceId>": "meta" } } */
const rutaManual = resolve(process.cwd(), "config", "kommo.json");
const cfg = existsSync(rutaManual) ? (JSON.parse(readFileSync(rutaManual, "utf8")) as { etapas?: Record<string, Paso>; fuentes?: Record<string, FuenteAtribuida> }) : {};
const manual = cfg.etapas ?? {};
const fuentes = cfg.fuentes ?? {};

async function main() {
  const hasta = hoyBogota();
  const desde = sumarDias(hasta, -(Number.isFinite(dias) && dias > 0 ? dias : 30) + 1);
  console.log(`· Kommo ${desde} → ${hasta} · ${sub}.kommo.com`);
  const nuevo = await sincronizarKommo({ pedir: crearPeticionKommo(sub!, token!), desde, hasta, manual, fuentes });
  const viejo = existsSync(RUTA_KOMMO) ? parsearKommo(readFileSync(RUTA_KOMMO, "utf8")) : null;
  const lote = LoteKommoSchema.parse(validarSinPII(fusionarKommo(viejo, nuevo)));
  mkdirSync(dirname(RUTA_KOMMO), { recursive: true });
  writeFileSync(RUTA_KOMMO, JSON.stringify(lote, null, 2), "utf8");
  const cuenta = (paso: string) => nuevo.embudo.filter((r) => r.paso === paso).reduce((a, r) => a + r.cantidad, 0);
  const ventas = nuevo.embudo.filter((r) => r.paso === "venta").reduce((a, r) => a + (r.valorCOP ?? 0), 0);
  console.log(`✓ ${nuevo.meta.leads} leads en el rango · ${cuenta("cita_agendada")} citas agendadas · ${cuenta("cita_asistida")} asistieron · ${cuenta("venta")} ventas ($ ${ventas.toLocaleString("es-CO")})`);
  console.log(`✓ ${lote.etapas.length} etapas leídas · ${lote.embudo.length} registros en total (${lote.meta.desde} → ${lote.meta.hasta})`);
  for (const a of lote.meta.avisos) console.log(`· ${a}`);
  const canales = new Map<string, number>();
  for (const r of nuevo.embudo) if (r.paso === "lead_calificado") canales.set(r.fuenteAtribuida, (canales.get(r.fuenteAtribuida) ?? 0) + r.cantidad);
  console.log(`· Leads por fuente: ${[...canales.entries()].map(([f, n]) => `${f} ${n}`).join(" · ")}`);
  console.log(`✓ Escrito ${RUTA_KOMMO}`);
}

main().catch((e) => {
  console.error(`✗ ${e instanceof Error ? e.message : String(e)}`);
  process.exit(1);
});
