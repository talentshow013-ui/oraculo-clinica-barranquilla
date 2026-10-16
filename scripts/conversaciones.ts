/**
 * Conversaciones de WhatsApp que llegaron a Kommo (webhook): de qué anuncio vino cada una, cuánto tardó
 * la primera respuesta de la asesora y en qué terminó (cita, asistió, venta), con el gasto del anuncio.
 *
 *   npm run conversaciones                  → últimos 7 días
 *   npm run conversaciones -- --hoy         → hoy
 *   npm run conversaciones -- --ayer        → ayer
 *   npm run conversaciones -- --dias 30
 *
 * En la VPS lee los archivos; en cualquier otro equipo (el PC de la clínica, el Mac) los pide a la VPS
 * con el usuario y clave del panel (VPS_PANEL_USUARIO / VPS_PANEL_CLAVE, u ORACULO_USUARIO / ORACULO_CLAVE).
 * Nunca hay texto de mensajes ni datos de pacientes aquí.
 */
import { cargarEnv } from "@/lib/adapters/env";
import { resumenWhatsapp, type ResumenWhatsapp } from "@/lib/conversaciones";
import { hoyBogota, sumarDias } from "@/lib/format/fechas";
import { duracion } from "@/lib/notificaciones/whatsapp";

cargarEnv();
const e = process.env;
const pct = (n: number, de: number) => (de ? `${Math.round((100 * n) / de)} %` : "—");
const cop = (v: number | null) => (v == null ? "—" : `$ ${Math.round(v).toLocaleString("es-CO")}`);

async function pedirALaVps(desde: string, hasta: string): Promise<ResumenWhatsapp | null> {
  const usuario = e.ORACULO_USUARIO?.trim() || e.VPS_PANEL_USUARIO?.trim();
  const clave = e.ORACULO_CLAVE?.trim() || e.VPS_PANEL_CLAVE?.trim();
  if (!usuario || !clave) throw new Error("Las conversaciones viven en la VPS y aquí falta con qué pedirlas: agrega VPS_PANEL_USUARIO y VPS_PANEL_CLAVE (el usuario y la clave del panel) al .env.");
  let origen = "https://oraculo.vivantemedicinaestetica.com";
  try {
    if (e.ORACULO_URL_PANEL) origen = new URL(e.ORACULO_URL_PANEL).origin;
  } catch {
    /* se usa la dirección de siempre */
  }
  const r = await fetch(`${origen}/api/conversaciones?${new URLSearchParams({ desde, hasta })}`, { headers: { authorization: `Basic ${Buffer.from(`${usuario}:${clave}`).toString("base64")}` } });
  if (r.status === 401) throw new Error("La VPS no aceptó el usuario y clave del panel (VPS_PANEL_USUARIO / VPS_PANEL_CLAVE).");
  if (!r.ok) throw new Error(`La VPS respondió ${r.status}.`);
  const j = (await r.json()) as ResumenWhatsapp | { vacio: true };
  return "vacio" in j ? null : j;
}

async function main() {
  const hoy = hoyBogota();
  const iDias = process.argv.indexOf("--dias");
  let desde: string;
  let hasta = hoy;
  if (process.argv.includes("--hoy")) desde = hoy;
  else if (process.argv.includes("--ayer")) desde = hasta = sumarDias(hoy, -1);
  else desde = sumarDias(hoy, -((iDias >= 0 ? Number(process.argv[iDias + 1]) || 7 : 7) - 1));

  const local = process.argv.includes("--remoto") ? null : resumenWhatsapp({ desde, hasta });
  const r = local ?? (await pedirALaVps(desde, hasta));
  if (!r) {
    console.log("Todavía no ha llegado ninguna conversación por el webhook de Kommo.");
    return;
  }

  console.log(`Conversaciones de WhatsApp en Kommo · ${desde} → ${hasta}${local ? "" : " (datos de la VPS)"}`);
  console.log(`Fuente: webhook de Kommo, guardando desde ${r.primerDia}${r.primerDia > desde ? " (antes no hay datos: solo cuenta desde que se activó)" : ""} · último aviso ${r.actualizadoEn ?? "—"} · cruce con el embudo ${r.cruceEn ?? "aún no"}.`);
  console.log(`Nuevas: ${r.nuevas} · de qué anuncio vienen: ${r.identificadas} (${pct(r.identificadas, r.nuevas)}) · sin identificar: ${r.sinIdentificar.total} (mensaje genérico ${r.sinIdentificar.genericas}, igual en varias campañas ${r.sinIdentificar.ambiguas}, otro texto ${r.sinIdentificar.ninguno})`);
  const em = r.embudo;
  console.log(`En qué terminaron (etapa del lead en Kommo): ${em.citas} citas · ${em.asistieron} asistieron · ${em.ventas} ventas${em.valor ? ` (${cop(em.valor)})` : ""} · ${em.conLead} de ${em.conversaciones} conversaciones ya cruzadas con su lead`);

  if (r.porAnuncio.length) {
    console.log("\nPor anuncio (primero los que traen ventas y citas):");
    for (const [i, a] of r.porAnuncio.slice(0, 15).entries()) {
      const marca = a.certeza === "exacto" ? "" : a.certeza === "activo" ? " [el activo entre anuncios con el mismo mensaje]" : a.certeza === "parecido" ? " [mensaje parecido]" : " [solo la campaña]";
      const costos = a.gasto == null ? "" : ` · gasto ${cop(a.gasto)} → ${cop(a.costoConversacion)} por conversación${a.citas ? ` · ${cop(a.costoCita)} por cita` : ""}${a.ventas ? ` · ${cop(a.costoVenta)} por venta` : ""}`;
      console.log(`  ${i + 1}. ${a.cuenta} · ${a.campana}${a.anuncio ? ` · ${a.anuncio}` : ""}${marca}`);
      console.log(`     ${a.conversaciones} conv. → ${a.citas} citas → ${a.asistieron} asistieron → ${a.ventas} ventas · respuesta mediana ${duracion(a.medianaSeg)}${costos}`);
    }
    if (r.porAnuncio.length > 15) console.log(`  … y ${r.porAnuncio.length - 15} más.`);
  }

  const at = r.atencion;
  console.log(`\nAtención (primera respuesta de una persona): ${at.atendidas} atendidas · mediana ${duracion(at.medianaSeg)} · hasta 5 min ${pct(at.hasta5min, at.atendidas)} · hasta 15 min ${pct(at.hasta15min, at.atendidas)} · hasta 1 h ${pct(at.hasta60min, at.atendidas)} · sin respuesta tras más de 1 h: ${at.sinRespuesta}${at.cerradasSinRespuesta ? ` · cerradas sin responder: ${at.cerradasSinRespuesta}` : ""}`);
  for (const a of at.porAsesora) console.log(`  · ${a.asesora ?? `asesora ${a.asesoraId}`}: ${a.atendidas} atendidas · mediana ${duracion(a.medianaSeg)} · ${pct(a.hasta15min, a.atendidas)} en 15 min o menos`);
  console.log("\nLos tiempos cuentan noches y fines de semana. Citas y ventas: según la etapa del lead en Kommo (se cruza cada hora).");
}

main().catch((err) => {
  console.error(`✗ ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
