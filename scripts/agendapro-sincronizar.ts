/**
 * Trae la agenda de AgendaPro (API v1, solo lectura) a `datos/agendapro.json`: cada cita con fecha,
 * hora, estado, servicio, profesional, sede y precio. Nunca datos de la paciente.
 *
 *   npm run agendapro:sincronizar               → citas creadas en los últimos 45 días (lo normal)
 *   npm run agendapro:sincronizar -- --dias 365 → primera vez / historia larga
 *
 * Necesita en .env: AGENDAPRO_USUARIO y AGENDAPRO_CLAVE (Configuraciones → Integraciones → API).
 * La API devuelve 30 citas por página, de la más reciente creada a la más vieja; se lee hasta pasar
 * la fecha de corte, despacio (límite de AgendaPro: 70 por minuto, 10.000 por día).
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { cargarEnv } from "@/lib/adapters/env";
import { API_AGENDAPRO, citaDesdeApi, fusionarCitas, LoteAgendaSchema, parsearAgenda, RUTA_AGENDAPRO, type Cita } from "@/lib/adapters/agendapro";
import { validarSinPII } from "@/lib/privacy";
import { hoyBogota, sumarDias } from "@/lib/format/fechas";

cargarEnv();
const usuario = process.env.AGENDAPRO_USUARIO;
const clave = process.env.AGENDAPRO_CLAVE;
if (!usuario || !clave) {
  console.error("✗ Faltan AGENDAPRO_USUARIO y AGENDAPRO_CLAVE en .env (AgendaPro → Configuraciones → Integraciones → API).");
  process.exit(1);
}
const iDias = process.argv.indexOf("--dias");
const dias = iDias >= 0 ? Number(process.argv[iDias + 1]) : 45;
const corte = sumarDias(hoyBogota(), -(Number.isFinite(dias) && dias > 0 ? dias : 45));
const auth = `Basic ${Buffer.from(`${usuario}:${clave}`).toString("base64")}`;
const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function pagina(n: number): Promise<Record<string, unknown>[]> {
  for (let intento = 1; ; intento++) {
    const r = await fetch(`${API_AGENDAPRO}/bookings?page=${n}`, { headers: { authorization: auth, accept: "application/json" } });
    if (r.status === 429 && intento < 4) {
      await esperar(65_000);
      continue;
    }
    if (!r.ok) throw new Error(`AgendaPro respondió ${r.status}: ${(await r.text()).slice(0, 160)}`);
    const j = (await r.json()) as unknown;
    if (!Array.isArray(j)) throw new Error(`AgendaPro devolvió algo inesperado: ${JSON.stringify(j).slice(0, 160)}`);
    return j as Record<string, unknown>[];
  }
}

async function main() {
  console.log(`· AgendaPro · citas creadas desde el ${corte}`);
  const nuevas: Cita[] = [];
  for (let n = 1; n < 5000; n++) {
    const datos = await pagina(n);
    if (!datos.length) break;
    const citas = datos.map(citaDesdeApi);
    nuevas.push(...citas);
    if (citas.every((c) => c.creada < corte)) break;
    await esperar(900); // ~66 por minuto: debajo del límite de 70
  }
  const vieja = existsSync(RUTA_AGENDAPRO) ? parsearAgenda(readFileSync(RUTA_AGENDAPRO, "utf8")) : null;
  const citas = fusionarCitas(vieja?.citas ?? [], nuevas);
  const fechas = citas.map((c) => c.fecha).sort();
  const lote = LoteAgendaSchema.parse(validarSinPII({ citas, meta: { capturadoEn: new Date().toISOString(), desde: fechas[0] ?? corte, hasta: fechas[fechas.length - 1] ?? hoyBogota(), origen: "agendapro", avisos: [] } }));
  mkdirSync(dirname(RUTA_AGENDAPRO), { recursive: true });
  writeFileSync(RUTA_AGENDAPRO, JSON.stringify(lote), "utf8");
  const hoy = hoyBogota();
  const deHoy = citas.filter((c) => c.fecha === hoy);
  console.log(`✓ ${nuevas.length} citas leídas · ${citas.length} en total (${lote.meta.desde} → ${lote.meta.hasta})`);
  console.log(`  Hoy: ${deHoy.length} citas en agenda · ${deHoy.filter((c) => c.estado === "Asiste").length} ya asistieron`);
}

main().catch((e) => {
  console.error(`✗ ${e instanceof Error ? e.message : String(e)}`);
  process.exitCode = 1;
});
