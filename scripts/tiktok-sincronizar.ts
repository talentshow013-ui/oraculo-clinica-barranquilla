/**
 * Trae la pauta de TikTok (solo lectura) a `datos/tiktok.json`. El panel la fusiona con Meta al leer.
 *
 *   npm run tiktok:sincronizar                → últimos 30 días (incremental)
 *   npm run tiktok:sincronizar -- --dias 90   → primera vez
 *
 * Necesita en .env: TIKTOK_ACCESS_TOKEN y TIKTOK_ADVERTISER_ID (guía: docs/CONEXION_TIKTOK.md).
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { cargarEnv } from "@/lib/adapters/env";
import { LoteTikTokSchema, RUTA_TIKTOK, parsearTikTok } from "@/lib/adapters/tiktok.archivo";
import { crearPeticionTikTok, fusionarTikTok, sincronizarTikTok } from "@/lib/adapters/tiktok.ads";
import { hoyBogota, sumarDias } from "@/lib/format/fechas";
import { validarSinPII } from "@/lib/privacy";

cargarEnv();
const iDias = process.argv.indexOf("--dias");
const dias = iDias >= 0 ? Number(process.argv[iDias + 1]) : 30;
const token = process.env.TIKTOK_ACCESS_TOKEN;
const advertiserId = process.env.TIKTOK_ADVERTISER_ID;
if (!token || !advertiserId) {
  console.error("✗ Falta la conexión con TikTok Ads: TIKTOK_ACCESS_TOKEN y TIKTOK_ADVERTISER_ID en .env (docs/CONEXION_TIKTOK.md).");
  process.exit(1);
}

async function main() {
  const hasta = sumarDias(hoyBogota(), -1);
  const desde = sumarDias(hasta, -(Number.isFinite(dias) && dias > 0 ? dias : 30) + 1);
  console.log(`· TikTok Ads ${desde} → ${hasta} · anunciante ${advertiserId}`);
  const nuevo = await sincronizarTikTok({ pedir: crearPeticionTikTok(token!), advertiserId: advertiserId!, desde, hasta });
  const viejo = existsSync(RUTA_TIKTOK) ? parsearTikTok(readFileSync(RUTA_TIKTOK, "utf8")) : null;
  const lote = LoteTikTokSchema.parse(validarSinPII(fusionarTikTok(viejo, nuevo)));
  mkdirSync(dirname(RUTA_TIKTOK), { recursive: true });
  writeFileSync(RUTA_TIKTOK, JSON.stringify(lote, null, 2), "utf8");
  const gasto = nuevo.insights.filter((i) => i.nivel === "campana").reduce((a, i) => a + i.gasto, 0);
  console.log(`✓ ${nuevo.insights.length} filas nuevas · gasto del rango $ ${gasto.toLocaleString("es-CO")} · ${lote.insights.length} filas en total (${lote.meta.desde} → ${lote.meta.hasta}) · ${lote.creativos.length} anuncios con texto`);
  console.log(`✓ Escrito ${RUTA_TIKTOK}`);
}

main().catch((e) => {
  console.error(`✗ ${e instanceof Error ? e.message : String(e)}`);
  process.exit(1);
});
