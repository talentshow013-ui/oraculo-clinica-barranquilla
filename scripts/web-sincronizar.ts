/**
 * Trae el sitio web (Google Analytics 4) a `datos/web.json`. Lo corre el reloj diario en la VPS.
 *
 *   npm run web:sincronizar                → últimos 30 días (incremental: conserva lo anterior)
 *   npm run web:sincronizar -- --dias 90   → primera vez
 *
 * Necesita en .env: GA4_PROPIEDAD_ID y la llave de la cuenta de servicio (GA4_CREDENCIALES = ruta al
 * JSON, por defecto datos/ga4-credenciales.json). Guía: docs/CONEXION_GA4.md. Solo lectura.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { cargarEnv } from "@/lib/adapters/env";
import { RUTA_WEB, parsearWeb } from "@/lib/adapters/web.archivo";
import { crearConsulta, fusionarWeb, pedirToken, sincronizarWeb, type LlaveServicio } from "@/lib/adapters/web.ga4";
import { LoteWebSchema } from "@/lib/adapters/types";
import { hoyBogota, sumarDias } from "@/lib/format/fechas";
import { validarSinPII } from "@/lib/privacy";

cargarEnv();
const iDias = process.argv.indexOf("--dias");
const dias = iDias >= 0 ? Number(process.argv[iDias + 1]) : 30;
const propiedadId = (process.env.GA4_PROPIEDAD_ID ?? "").replace(/^properties\//, "");
const rutaLlave = resolve(process.cwd(), process.env.GA4_CREDENCIALES || "datos/ga4-credenciales.json");
if (!propiedadId || !existsSync(rutaLlave)) {
  console.error(`✗ Falta la conexión con Google Analytics: GA4_PROPIEDAD_ID en .env y la llave en ${rutaLlave}. Guía: docs/CONEXION_GA4.md`);
  process.exit(1);
}

async function main() {
  const llave = JSON.parse(readFileSync(rutaLlave, "utf8")) as LlaveServicio;
  if (!llave.client_email || !llave.private_key) throw new Error("La llave no es de una cuenta de servicio de Google (faltan client_email / private_key).");
  const hasta = hoyBogota(); // hoy incluido: en vivo, lo de hoy se reemplaza en cada pasada
  const desde = sumarDias(hasta, -(Number.isFinite(dias) && dias > 0 ? dias : 30) + 1);
  console.log(`· Sitio web ${desde} → ${hasta} · propiedad ${propiedadId} · ${llave.client_email}`);
  const token = await pedirToken(llave);
  const nuevo = await sincronizarWeb({ consultar: crearConsulta(propiedadId, token), propiedadId, desde, hasta });
  const viejo = existsSync(RUTA_WEB) ? parsearWeb(readFileSync(RUTA_WEB, "utf8")) : null;
  const lote = LoteWebSchema.parse(validarSinPII(fusionarWeb(viejo, nuevo)));
  mkdirSync(dirname(RUTA_WEB), { recursive: true });
  writeFileSync(RUTA_WEB, JSON.stringify(lote, null, 2), "utf8");
  const sesiones = nuevo.sesiones.reduce((a, s) => a + s.sesiones, 0);
  console.log(`✓ ${sesiones.toLocaleString("es-CO")} sesiones en el rango pedido · ${lote.sesiones.length} filas en total (${lote.meta.desde} → ${lote.meta.hasta}) · ${lote.paginas.length} páginas · ${lote.eventos.length} eventos · ${lote.ciudades.length} ciudades`);
  for (const a of lote.meta.avisos) console.log(`· ${a}`);
  console.log(`✓ Escrito ${RUTA_WEB}`);
}

main().catch((e) => {
  console.error(`✗ ${e instanceof Error ? e.message : String(e)}`);
  process.exit(1);
});
