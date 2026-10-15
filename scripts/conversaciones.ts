/**
 * Conversaciones de WhatsApp que llegaron a Kommo, por el webhook (la VPS las va guardando sin texto):
 * de qué anuncio vino cada una y cuánto tardó la primera respuesta de la asesora.
 *
 *   npm run conversaciones                  → últimos 7 días
 *   npm run conversaciones -- --hoy         → hoy
 *   npm run conversaciones -- --dias 30
 *
 * Solo lee `datos/conversaciones.json`. No toca Kommo salvo para poner el nombre de cada asesora
 * (lista de usuarios, solo lectura). Nunca hay texto de mensajes ni datos de pacientes aquí.
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { cargarEnv } from "@/lib/adapters/env";
import { RUTA_CONVERSACIONES, cargarConversaciones } from "@/lib/adapters/conversaciones.archivo";
import { crearPeticionKommo } from "@/lib/adapters/kommo";
import { resumir } from "@/lib/adapters/kommo.conversaciones";
import { hoyBogota, sumarDias } from "@/lib/format/fechas";

cargarEnv();

const dur = (s: number | null) => {
  if (s == null) return "—";
  if (s < 60) return `${s} s`;
  if (s < 3600) return `${Math.round(s / 60)} min`;
  const h = Math.floor(s / 3600);
  const m = Math.round((s % 3600) / 60);
  return m ? `${h} h ${m} min` : `${h} h`;
};
const pct = (n: number, de: number) => (de ? `${Math.round((100 * n) / de)} %` : "—");

async function nombresDeAsesoras(): Promise<Map<string, string>> {
  const sub = process.env.KOMMO_SUBDOMINIO;
  const token = process.env.KOMMO_TOKEN;
  const m = new Map<string, string>();
  if (!sub || !token) return m;
  try {
    const j = await crearPeticionKommo(sub, token)("/api/v4/users", { limit: 250 });
    for (const u of j?._embedded?.users ?? []) m.set(String(u.id), String(u.name ?? u.id));
  } catch {
    /* sin nombres: se muestra el id */
  }
  return m;
}

async function main() {
  const hoy = hoyBogota();
  const iDias = process.argv.indexOf("--dias");
  const dias = process.argv.includes("--hoy") ? 1 : iDias >= 0 ? Number(process.argv[iDias + 1]) || 7 : 7;
  const desde = sumarDias(hoy, -dias + 1);

  const estado = cargarConversaciones();
  const todas = Object.values(estado.conversaciones);
  if (!todas.length) {
    console.log("Todavía no ha llegado ningún aviso de Kommo.");
    console.log("El webhook se activa en Kommo → Ajustes → Integraciones → Web hooks (ver docs/WEBHOOK_KOMMO.md).");
    return;
  }
  const primera = todas.reduce((a, c) => (c.dia < a ? c.dia : a), todas[0]!.dia);
  const r = resumir(estado, { desde, hasta: hoy });
  const nombres = await nombresDeAsesoras();

  console.log(`Conversaciones de WhatsApp en Kommo · ${desde} → ${hoy}`);
  console.log(`Fuente: webhook de Kommo, guardando desde ${primera}${primera > desde ? " (antes de esa fecha no hay datos: el webhook solo ve lo que llega después de activarse)" : ""}.`);
  console.log(`Nuevas: ${r.nuevas} · de qué anuncio vienen: ${r.identificadas} (${pct(r.identificadas, r.nuevas)}) · sin identificar: ${r.sinIdentificar.total} (mensaje genérico ${r.sinIdentificar.genericas}, igual en varias campañas ${r.sinIdentificar.ambiguas}, otro texto ${r.sinIdentificar.ninguno})`);

  if (r.porAnuncio.length) {
    console.log("\nPor anuncio (más conversaciones primero):");
    for (const [i, a] of r.porAnuncio.slice(0, 15).entries()) {
      const marca = a.certeza === "exacto" ? "" : a.certeza === "activo" ? " · [el activo entre anuncios con el mismo mensaje]" : a.certeza === "parecido" ? " · [mensaje parecido]" : " · [solo la campaña]";
      console.log(`  ${i + 1}. ${a.cuenta} · ${a.campana}${a.anuncio ? ` · ${a.anuncio}` : ""} — ${a.conversaciones} conv. · ${a.atendidas} atendidas · mediana ${dur(a.medianaSeg)}${marca}`);
    }
    if (r.porAnuncio.length > 15) console.log(`  … y ${r.porAnuncio.length - 15} más.`);
  }

  const at = r.atencion;
  console.log(`\nAtención (primera respuesta de una persona): ${at.atendidas} atendidas · mediana ${dur(at.medianaSeg)} · hasta 5 min ${at.hasta5min} (${pct(at.hasta5min, at.atendidas)}) · hasta 15 min ${at.hasta15min} (${pct(at.hasta15min, at.atendidas)}) · hasta 1 h ${at.hasta60min} (${pct(at.hasta60min, at.atendidas)}) · sin respuesta tras más de 1 h: ${at.sinRespuesta}`);
  for (const a of at.porAsesora) console.log(`  · ${nombres.get(a.asesoraId) ?? `asesora ${a.asesoraId}`}: ${a.atendidas} atendidas · mediana ${dur(a.medianaSeg)} · ${pct(a.hasta15min, a.atendidas)} en 15 min o menos`);
  console.log("\nLos tiempos cuentan horas de la noche y fines de semana: una conversación de las 10 p. m. respondida a las 8 a. m. sale con 10 h.");

  const forma = join(dirname(RUTA_CONVERSACIONES), "kommo-webhook-forma.json");
  if (existsSync(forma)) {
    const f = JSON.parse(readFileSync(forma, "utf8")) as { avisos?: number; ultimoAviso?: string };
    console.log(`Webhook: ${f.avisos ?? 0} avisos recibidos · último ${f.ultimoAviso ?? "—"}`);
  }
}

main().catch((e) => {
  console.error(`✗ ${e instanceof Error ? e.message : String(e)}`);
  process.exit(1);
});
