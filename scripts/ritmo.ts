/**
 * «¿Hoy viene lento?» en vivo: por cada cuenta de Meta, los leads y el gasto de hoy hasta la última
 * hora completa contra lo normal a esa misma hora (mediana de 14 días) y contra el mismo día de la
 * semana, y la hora más floja.
 * Directo de la API de Meta (no usa el conector ni manda nada a Telegram).
 *
 *   npm run ritmo              → las 4 cuentas
 *   npm run ritmo -- --json
 */
import { cargarEnv } from "@/lib/adapters/env";
import { cliente } from "@/config/cliente";
import { cop, num } from "@/lib/format";
import { hoyBogota, sumarDias } from "@/lib/format/fechas";
import { leadsDeAcciones, ritmoDelDia, type HoraPauta, type RitmoDia } from "@/lib/metrics/ritmo";

cargarEnv();
const token = process.env.META_ORGANICO_TOKEN;
if (!token) {
  console.error("✗ Falta META_ORGANICO_TOKEN en .env");
  process.exit(1);
}
const json = process.argv.includes("--json");
const hoy = hoyBogota();
const horaActual = Number(new Date().toLocaleString("en-US", { timeZone: "America/Bogota", hour: "numeric", hour12: false })) % 24;

interface Fila { date_start: string; hourly_stats_aggregated_by_advertiser_time_zone: string; spend?: string; actions?: { action_type: string; value: string }[] }

async function horasDe(cuentaId: string): Promise<HoraPauta[]> {
  const p = new URLSearchParams({
    level: "account",
    time_range: JSON.stringify({ since: sumarDias(hoy, -14), until: hoy }),
    time_increment: "1",
    breakdowns: "hourly_stats_aggregated_by_advertiser_time_zone",
    fields: "spend,actions",
    limit: "500",
    access_token: token!,
  });
  const salida: HoraPauta[] = [];
  let url: string | undefined = `https://graph.facebook.com/v25.0/${cuentaId}/insights?${p}`;
  for (let i = 0; url && i < 10; i++) {
    const j = (await (await fetch(url)).json()) as { data?: Fila[]; paging?: { next?: string }; error?: { message: string } };
    if (j.error) throw new Error(j.error.message);
    for (const f of j.data ?? []) salida.push({ fecha: f.date_start, hora: Number(f.hourly_stats_aggregated_by_advertiser_time_zone.slice(0, 2)), gasto: Number(f.spend ?? 0), leads: leadsDeAcciones(f.actions) });
    url = j.paging?.next;
  }
  return salida;
}

const pctTxt = (v: number) => `${v >= 0 ? "+" : "−"}${Math.abs(Math.round(v * 100))} %`;
const horaTxt = (h: number) => `${h % 12 || 12} ${h < 12 ? "a. m." : "p. m."}`;

async function main() {
  const cuentas = cliente.cuentasPublicitarias.filter((c) => (c.plataforma ?? "meta") === "meta");
  const salida: { cuenta: string; ritmo: RitmoDia }[] = [];
  for (const c of cuentas) salida.push({ cuenta: c.nombre, ritmo: ritmoDelDia(await horasDe(c.id), hoy, horaActual) });
  if (json) {
    process.stdout.write(JSON.stringify(salida, null, 2));
    return;
  }
  const diaSemana = new Date(`${hoy}T12:00:00Z`).toLocaleDateString("es-CO", { weekday: "long", timeZone: "UTC" });
  console.log(`\nRITMO DE HOY (${diaSemana}) hasta las ${horaTxt(horaActual)}, horas completas · contra lo normal a esa hora (mediana de 14 días) y contra otros ${diaSemana} · API de Meta`);
  const tot = { hoy: 0, prom: 0, gHoy: 0, gProm: 0, mismo: 0 };
  for (const { cuenta, ritmo: r } of salida) {
    tot.hoy += r.hoy.leads; tot.prom += r.promedio.leads; tot.gHoy += r.hoy.gasto; tot.gProm += r.promedio.gasto; tot.mismo += r.mismoDia?.leads ?? 0;
    /* el veredicto sale del mismo día de la semana si lo hay (los lunes arrancan distinto) */
    const base = r.diferenciaMismoDia ?? r.diferencia;
    const dif = base == null ? "sin días para comparar" : base < -0.15 ? "⚠️ viene lento" : base > 0.15 ? "✅ viene mejor" : "normal";
    console.log(`\n${cuenta} · ${dif}\n  hoy: ${num(r.hoy.leads)} leads con ${cop(r.hoy.gasto)}\n  lo normal a esta hora: ${num(Math.round(r.promedio.leads))} leads con ${cop(Math.round(r.promedio.gasto))}${r.diferencia == null ? "" : ` (${pctTxt(r.diferencia)})`}`);
    if (r.mismoDia) console.log(`  otros ${diaSemana} a esta hora: ${num(Math.round(r.mismoDia.leads))} leads con ${cop(Math.round(r.mismoDia.gasto))}${r.diferenciaMismoDia == null ? "" : ` (${pctTxt(r.diferenciaMismoDia)})`}`);
    if (r.horaMasFloja) console.log(`  hora más floja: ${horaTxt(r.horaMasFloja.hora)} (${num(r.horaMasFloja.hoy)} leads; normalmente ${num(Math.round(r.horaMasFloja.promedio * 10) / 10, 1)})`);
    if (r.enCurso) console.log(`  en curso (${horaTxt(r.enCurso.hora)}): ${num(r.enCurso.leads)} leads con ${cop(r.enCurso.gasto)}`);
  }
  if (tot.prom > 0) console.log(`\nTOTAL: ${num(tot.hoy)} leads con ${cop(tot.gHoy)} · lo normal a esta hora ${num(Math.round(tot.prom))} (${pctTxt(tot.hoy / tot.prom - 1)})${tot.mismo > 0 ? ` · otros ${diaSemana} ${num(Math.round(tot.mismo))} (${pctTxt(tot.hoy / tot.mismo - 1)})` : ""}`);
  console.log("Leads por hora = conversaciones iniciadas + formularios (Meta no da «Resultados» por hora).");
}

main().catch((e) => {
  console.error(`✗ ${e instanceof Error ? e.message : String(e)}`);
  process.exit(1);
});
