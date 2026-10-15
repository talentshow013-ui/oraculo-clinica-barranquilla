/**
 * Cruza las conversaciones de WhatsApp (webhook de Kommo) con el embudo de Kommo: para el lead de cada
 * conversación, en qué etapa va hoy (cita, asistió, venta). Va por huellas: los leads de Kommo se leen,
 * se convierten en huella y solo se guardan los que coinciden. Nunca se guarda un id, nombre ni teléfono.
 * Lo corre `oraculo-vivo` cada hora en la VPS (donde viven las conversaciones y el secreto).
 *
 *   npm run conversaciones:cruzar
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { cargarEnv } from "@/lib/adapters/env";
import { cargarConversaciones, cargarEmbudoConversaciones, guardarEmbudoConversaciones } from "@/lib/adapters/conversaciones.archivo";
import { crearPeticionKommo, leerEtapas } from "@/lib/adapters/kommo";
import { cruzarLeads } from "@/lib/adapters/kommo.conversaciones";
import type { Paso } from "@/lib/adapters/types";

cargarEnv();
const secreto = process.env.KOMMO_WEBHOOK_SECRETO;
const sub = process.env.KOMMO_SUBDOMINIO;
const token = process.env.KOMMO_TOKEN;

async function main() {
  if (!secreto || !sub || !token) {
    console.log("· Este equipo no recibe el webhook de Kommo (falta KOMMO_WEBHOOK_SECRETO o la conexión con Kommo): el cruce se hace en la VPS.");
    return;
  }
  const estado = cargarConversaciones();
  const conversaciones = Object.values(estado.conversaciones);
  const huellas = new Set(conversaciones.map((c) => c.lead).filter((x): x is string => !!x));
  const pedir = crearPeticionKommo(sub, token);

  const rutaManual = resolve(process.cwd(), "config", "kommo.json");
  const manual = existsSync(rutaManual) ? ((JSON.parse(readFileSync(rutaManual, "utf8")) as { etapas?: Record<string, Paso> }).etapas ?? {}) : {};
  const etapas = await leerEtapas(pedir);

  /* los leads tocados desde el día antes de la primera conversación (un lead que avanza de etapa cambia su updated_at) */
  const leads: { id: number; etapaId: number; precio: number }[] = [];
  if (huellas.size) {
    const desde = Math.min(...conversaciones.map((c) => c.inicio)) - 86_400;
    for (let page = 1; page <= 200; page++) {
      const j = await pedir("/api/v4/leads", { page, limit: 250, "filter[updated_at][from]": desde });
      const lista = (j?._embedded?.leads ?? []) as { id: number; status_id: number; price?: number }[];
      for (const l of lista) leads.push({ id: Number(l.id), etapaId: Number(l.status_id), precio: Number(l.price ?? 0) || 0 });
      if (lista.length < 250) break;
    }
  }
  const nuevos = cruzarLeads(huellas, leads, etapas, manual, secreto);

  /* lo cruzado antes se conserva (un lead que no se movió no vuelve en la consulta), solo para conversaciones que siguen guardadas */
  const previo = cargarEmbudoConversaciones();
  const unidos = Object.fromEntries(Object.entries({ ...(previo?.leads ?? {}), ...nuevos }).filter(([h]) => huellas.has(h)));

  const asesoras: Record<string, string> = { ...(previo?.asesoras ?? {}) };
  try {
    const u = await pedir("/api/v4/users", { limit: 250 });
    for (const x of u?._embedded?.users ?? []) asesoras[String(x.id)] = String(x.name ?? x.id);
  } catch {
    /* sin nombres: se muestra el id */
  }

  guardarEmbudoConversaciones({ version: 1, actualizadoEn: new Date().toISOString(), leads: unidos, asesoras });
  const pasos = Object.values(unidos);
  const cuenta = (p: Paso) => pasos.filter((x) => x.paso === p).length;
  console.log(`✓ ${conversaciones.length} conversaciones · ${huellas.size} con lead · ${pasos.length} cruzados con Kommo (${leads.length} leads revisados): ${cuenta("cita_agendada")} en cita, ${cuenta("cita_asistida")} asistieron, ${cuenta("venta")} ventas`);
}

main().catch((e) => {
  console.error(`✗ ${e instanceof Error ? e.message : String(e)}`);
  process.exit(1);
});
