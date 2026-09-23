/**
 * Trae la pauta de Google Ads (solo lectura) a `datos/googleads.json`. El panel la fusiona al leer.
 *
 *   npm run googleads:sincronizar                → últimos 30 días (incremental)
 *   npm run googleads:sincronizar -- --dias 90   → primera vez
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { cargarEnv } from "@/lib/adapters/env";
import { LotePlataformaSchema, RUTA_GOOGLE_ADS, parsearPlataforma } from "@/lib/adapters/tiktok.archivo";
import { crearConsultaGoogle, fusionarGoogleAds, sincronizarGoogleAds, tokenDeAcceso, type LoteGoogleAds } from "@/lib/adapters/google.ads";
import { hoyBogota, sumarDias } from "@/lib/format/fechas";
import { validarSinPII } from "@/lib/privacy";

cargarEnv();
const iDias = process.argv.indexOf("--dias");
const dias = iDias >= 0 ? Number(process.argv[iDias + 1]) : 30;
const e = process.env;
if (!e.GOOGLE_ADS_DEVELOPER_TOKEN || !e.GOOGLE_ADS_CLIENT_ID || !e.GOOGLE_ADS_CLIENT_SECRET || !e.GOOGLE_ADS_REFRESH_TOKEN || !e.GOOGLE_ADS_CUSTOMER_ID) {
  console.error("✗ Falta la conexión con Google Ads en .env. Corre primero: npm run googleads:conectar (docs/CONEXION_GOOGLE_ADS.md)");
  process.exit(1);
}

async function main() {
  const cred = { developerToken: e.GOOGLE_ADS_DEVELOPER_TOKEN!, clientId: e.GOOGLE_ADS_CLIENT_ID!, clientSecret: e.GOOGLE_ADS_CLIENT_SECRET!, refreshToken: e.GOOGLE_ADS_REFRESH_TOKEN!, loginCustomerId: e.GOOGLE_ADS_LOGIN_CUSTOMER_ID || undefined };
  const hasta = hoyBogota(); // hoy incluido: en vivo, lo de hoy se reemplaza en cada pasada
  const desde = sumarDias(hasta, -(Number.isFinite(dias) && dias > 0 ? dias : 30) + 1);
  console.log(`· Google Ads ${desde} → ${hasta} · cuenta ${e.GOOGLE_ADS_CUSTOMER_ID}`);
  const token = await tokenDeAcceso(cred);
  const nuevo = await sincronizarGoogleAds({ consultar: crearConsultaGoogle(cred, e.GOOGLE_ADS_CUSTOMER_ID!, token), customerId: e.GOOGLE_ADS_CUSTOMER_ID!, desde, hasta });
  const viejo = existsSync(RUTA_GOOGLE_ADS) ? (parsearPlataforma(readFileSync(RUTA_GOOGLE_ADS, "utf8")) as LoteGoogleAds) : null;
  const lote = LotePlataformaSchema.parse(validarSinPII(fusionarGoogleAds(viejo, nuevo)));
  mkdirSync(dirname(RUTA_GOOGLE_ADS), { recursive: true });
  writeFileSync(RUTA_GOOGLE_ADS, JSON.stringify(lote, null, 2), "utf8");
  const gasto = nuevo.insights.filter((i) => i.nivel === "campana").reduce((a, i) => a + i.gasto, 0);
  console.log(`✓ ${nuevo.insights.length} filas nuevas · gasto del rango $ ${gasto.toLocaleString("es-CO")} · ${lote.insights.length} filas en total (${lote.meta.desde} → ${lote.meta.hasta}) · ${lote.creativos.length} anuncios con texto`);
  console.log(`✓ Escrito ${RUTA_GOOGLE_ADS}`);
}

main().catch((err) => {
  console.error(`✗ ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
