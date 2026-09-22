/**
 * Trae la pauta de Meta directo de la Marketing API al lote (`datos/lote.json`). Sin conector y sin
 * Claude: funciona igual en el PC de la clínica, en la VPS y en el reloj de las 6, 12 y 18.
 *
 *   npm run meta:sincronizar               → campañas, conjuntos y anuncios de los últimos 30 días
 *   npm run meta:sincronizar -- --dias 90  → otra ventana
 *   npm run meta:sincronizar -- --hoy      → solo hoy (rápido, para las alertas del mediodía)
 *
 * Necesita `META_ORGANICO_TOKEN` en `.env` (el mismo token de la página: ya trae `ads_read`).
 * Los resultados son los de la columna «Resultados» del administrador, campaña por campaña.
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { cargarEnv } from "@/lib/adapters/env";
import { estadoDeEntidad, mapearInsightMeta, urlEntidades, urlInsights, type FilaInsight } from "@/lib/adapters/meta.ads";
import { LoteDatosSchema, type Estado, type InsightRow, type LoteDatos } from "@/lib/adapters/types";
import { listarHuecos } from "@/lib/format/fechas";
import { cliente } from "@/config/cliente";
import { hoyBogota, sumarDias } from "@/lib/format/fechas";

cargarEnv();
const token = process.env.META_ORGANICO_TOKEN;
if (!token) {
  console.error("✗ Falta META_ORGANICO_TOKEN en .env (es el token de la página; ya trae permiso de lectura de anuncios).");
  process.exit(1);
}
const arg = (n: string) => {
  const i = process.argv.indexOf(n);
  return i >= 0 ? process.argv[i + 1] : undefined;
};
const RUTA = "datos/lote.json";
const hoy = hoyBogota();
const dias = process.argv.includes("--hoy") ? 1 : Number(arg("--dias") ?? 30);
const desde = sumarDias(hoy, -(dias - 1));

async function pedir<T>(url: string): Promise<{ data: T[]; siguiente: string | null }> {
  const r = await fetch(url);
  const j = (await r.json()) as { data?: T[]; paging?: { cursors?: { after?: string }; next?: string }; error?: { message: string } };
  if (j.error) throw new Error(j.error.message);
  return { data: j.data ?? [], siguiente: j.paging?.next ? (j.paging.cursors?.after ?? null) : null };
}

/** Todas las páginas de una consulta (Meta corta en `limit`). */
async function todo<T>(hacerUrl: (despues?: string) => string): Promise<T[]> {
  const salida: T[] = [];
  let despues: string | undefined;
  for (let i = 0; i < 40; i++) {
    const { data, siguiente } = await pedir<T>(hacerUrl(despues));
    salida.push(...data);
    if (!siguiente) break;
    despues = siguiente;
  }
  return salida;
}

interface Entidad { id: string; name?: string; status?: string; effective_status?: string }

async function cuenta(id: string, nombre: string): Promise<InsightRow[]> {
  const filas: InsightRow[] = [];
  const niveles = [
    { meta: "campaigns", insights: "campaign", nivel: "campana" },
    { meta: "adsets", insights: "adset", nivel: "conjunto" },
    { meta: "ads", insights: "ad", nivel: "anuncio" },
  ] as const;
  for (const n of niveles) {
    const entidades = await todo<Entidad>((d) => urlEntidades(id, n.meta, token!, d));
    const estado = new Map<string, Estado>(entidades.map((e) => [e.id, estadoDeEntidad(e.status, e.effective_status)]));
    const insights = await todo<FilaInsight>((d) => urlInsights(id, n.insights, { desde, hasta: hoy }, token!, d));
    for (const f of insights) {
      const idFila = n.nivel === "anuncio" ? f.ad_id : n.nivel === "conjunto" ? f.adset_id : f.campaign_id;
      filas.push(mapearInsightMeta(f, { cuentaId: id, nivel: n.nivel, estado: estado.get(String(idFila)) ?? "activo" }));
    }
    console.log(`  ${nombre} · ${n.nivel}: ${insights.length} filas`);
  }
  return filas;
}

function loteActual(): LoteDatos {
  try {
    return LoteDatosSchema.parse(JSON.parse(readFileSync(RUTA, "utf8")));
  } catch {
    return { insights: [], desgloses: [], creativos: [], embudo: [], competidores: [], anunciosCompetencia: [], experimentos: [], meta: { generadoEn: new Date().toISOString(), desde, hasta: hoy, origen: "archivo", huecos: [], advertencias: [] } };
  }
}

async function main() {
  const cuentas = cliente.cuentasPublicitarias.filter((c) => (c.plataforma ?? "meta") === "meta");
  console.log(`Meta · ${cuentas.length} cuentas · ${desde} → ${hoy}`);
  const nuevas: InsightRow[] = [];
  for (const c of cuentas) nuevas.push(...(await cuenta(c.id, c.nombre)));

  const lote = loteActual();
  /* las filas nuevas mandan sobre las de las mismas fechas; lo anterior al rango se conserva */
  const clave = (f: InsightRow) => `${f.cuentaId}|${f.nivel}|${f.id}|${f.fecha}`;
  const nuevasClaves = new Set(nuevas.map(clave));
  const viejas = lote.insights.filter((f) => !(f.fecha >= desde && f.fecha <= hoy) && !nuevasClaves.has(clave(f)));
  const insights = [...viejas, ...nuevas].sort((a, b) => a.fecha.localeCompare(b.fecha) || a.nivel.localeCompare(b.nivel));
  const fechas = insights.map((f) => f.fecha).filter(Boolean).sort();
  const rangoDesde = fechas[0] ?? desde;
  const rangoHasta = fechas[fechas.length - 1] ?? hoy;
  const salida: LoteDatos = {
    ...lote,
    insights,
    meta: { ...lote.meta, generadoEn: new Date().toISOString(), desde: rangoDesde, hasta: rangoHasta, origen: "archivo", huecos: listarHuecos(rangoDesde, rangoHasta, new Set(fechas)) },
  };
  LoteDatosSchema.parse(salida);
  mkdirSync("datos", { recursive: true });
  writeFileSync(RUTA, JSON.stringify(salida, null, 2));
  const deHoy = nuevas.filter((f) => f.nivel === "campana" && f.fecha === hoy);
  console.log(`✓ ${nuevas.length} filas nuevas en ${RUTA} (${salida.meta.desde} → ${salida.meta.hasta}).`);
  console.log(`  Hoy (${hoy}): ${deHoy.reduce((s, f) => s + f.resultados, 0)} resultados con ${Math.round(deHoy.reduce((s, f) => s + f.gasto, 0)).toLocaleString("es-CO")} COP.`);
}

main().catch((e) => {
  console.error(`✗ ${e instanceof Error ? e.message : String(e)}`);
  process.exit(1);
});
