/**
 * El mensaje de Telegram que pidió la clínica (6 a. m., 12 m., 6 p. m.): corto y accionable.
 *   1. Gasto, leads y costo por lead del día (y el día anterior para comparar), por cuenta.
 *   2. Hasta 3 oportunidades: anuncios que traen leads mucho más baratos que el promedio (subirles
 *      presupuesto) o pruebas nuevas que arrancan bien.
 *   3. Hasta 3 riesgos, ordenados por plata: medición rota, anuncios rechazados, anuncios que
 *      gastan de más para los leads que traen (pausar o cambiar).
 * El detalle completo vive en el panel. Leads = columna «Resultados» de lo que busca contactos.
 */
import type { InsightRow } from "@/lib/adapters/types";
import { cop, num } from "@/lib/format";
import { sumarDias } from "@/lib/format/fechas";
import { agregar, razon } from "@/lib/metrics/core";
import { buscaContactos, evaluarAlertas, type Umbrales } from "./alertas";

export interface CifrasResumen {
  gasto: number;
  leads: number;
  cpl: number | null;
}
export interface Punto {
  texto: string;
  /** Pesos que mueve (para ordenar). */
  peso: number;
}
export interface ResumenConciso {
  cuentas: ({ nombre: string } & CifrasResumen)[];
  dia: CifrasResumen;
  anterior: CifrasResumen;
  oportunidades: Punto[];
  riesgos: Punto[];
}

/** Nombre legible: sin emojis ni rayas, « I » como separador → « · », máximo ~55 caracteres. */
export function nombreCorto(nombre: string, max = 55): string {
  const limpio = nombre
    .replace(/[\p{Extended_Pictographic}\p{Emoji_Modifier}‍️⃣]/gu, " ")
    .replace(/[⚪⚫🔴🟠🟡🟢🔵🟣🟤🟥🟧🟨🟩🟦🟪🟫⬛⬜]/gu, " ")
    .replace(/\s+[I|]\s+/g, " · ")
    .replace(/\s+/g, " ")
    .replace(/^[\s·|I]+|[\s·|]+$/g, "")
    .trim();
  if (limpio.length <= max) return limpio;
  const partes = limpio.split(" · ");
  let salida = "";
  for (const p of partes) {
    if ((salida ? salida.length + 3 : 0) + p.length > max - 4) break;
    salida = salida ? `${salida} · ${p}` : p;
  }
  return salida ? `${salida} · …` : `${limpio.slice(0, max - 1)}…`;
}

const cifras = (filas: ReadonlyArray<InsightRow>): CifrasResumen => {
  const a = agregar(filas);
  const leads = filas.filter(buscaContactos).reduce((s, f) => s + f.resultados, 0);
  return { gasto: a.gasto, leads, cpl: razon(a.gasto, leads) };
};

export function resumenConciso(cuentas: ReadonlyArray<{ nombre: string; insights: ReadonlyArray<InsightRow> }>, dia: string, hoy: string, u: Umbrales, ventana = 3): ResumenConciso {
  const anteriorDia = sumarDias(dia, -1);
  const campDia = (x: ReadonlyArray<InsightRow>, d: string) => x.filter((f) => f.nivel === "campana" && f.fecha === d);
  const todasDia: InsightRow[] = [];
  const todasAnt: InsightRow[] = [];
  const oportunidades: Punto[] = [];
  const riesgos: Punto[] = [];
  const porCuenta = cuentas.map(({ nombre: nombreCompleto, insights }) => {
    const nombre = nombreCorto(nombreCompleto, 40);
    const d = campDia(insights, dia);
    todasDia.push(...d);
    todasAnt.push(...campDia(insights, anteriorDia));

    /* anuncios activos que buscan contactos, últimos `ventana` días */
    const ultimo = insights.reduce((m, f) => (f.fecha > m ? f.fecha : m), "");
    const desde = sumarDias(ultimo, -(ventana - 1));
    const grupos = new Map<string, InsightRow[]>();
    for (const f of insights) if (f.nivel === "anuncio" && f.fecha >= desde) grupos.set(f.id, [...(grupos.get(f.id) ?? []), f]);
    const anuncios = [...grupos.values()]
      .map((fs) => {
        const orden = [...fs].sort((a, b) => a.fecha.localeCompare(b.fecha));
        const ult = orden[orden.length - 1]!;
        const primero = insights.filter((f) => f.nivel === "anuncio" && f.id === ult.id).reduce((m, f) => (f.fecha < m ? f.fecha : m), ult.fecha);
        return { nombre: nombreCorto(ult.nombre), estado: ult.estado, contactos: fs.some(buscaContactos), nuevo: primero >= desde, ...cifras(fs) };
      })
      .filter((a) => a.estado === "activo" && a.contactos && a.gasto > 0);
    const base = cifras(anuncios.length ? [...grupos.values()].flat().filter((f) => buscaContactos(f)) : []);
    const promedio = base.cpl;

    for (const a of anuncios) {
      if (promedio != null && a.cpl != null && a.leads >= 5 && a.cpl <= promedio * 0.7) {
        oportunidades.push({ peso: a.leads * (promedio - a.cpl), texto: `«${a.nombre}» (${nombre}): ${num(a.leads)} leads a ${cop(a.cpl)} en ${ventana} días, contra ${cop(promedio)} de promedio. Subirle presupuesto.` });
      } else if (a.nuevo && a.leads >= 2 && promedio != null && a.cpl != null && a.cpl < promedio) {
        oportunidades.push({ peso: a.leads * (promedio - a.cpl) * 0.5, texto: `Prueba nueva «${a.nombre}» (${nombre}) arranca bien: ${num(a.leads)} leads a ${cop(a.cpl)}. Dejarla correr.` });
      }
      const exceso = a.gasto - a.leads * u.cplMaximo;
      if (exceso >= 30_000 && !a.nuevo) {
        riesgos.push({ peso: exceso, texto: `«${a.nombre}» (${nombre}): ${cop(a.gasto)} en ${ventana} días y ${a.leads ? `${num(a.leads)} leads a ${cop(a.cpl)}` : "ningún lead"}. Pausarlo o cambiar el anuncio.` });
      }
    }
    const alertas = evaluarAlertas(insights, hoy, u);
    const medicion = alertas.find((x) => x.tipo === "sin_conversiones");
    if (medicion) riesgos.push({ peso: Number.MAX_SAFE_INTEGER, texto: `${nombre}: ${medicion.texto}` });
    const rechazados = alertas.filter((x) => x.tipo === "rechazado").map((x) => `«${nombreCorto(x.entidad, 30)}»`);
    if (rechazados.length) riesgos.push({ peso: 50_000, texto: `${nombre}: ${rechazados.length === 1 ? "anuncio rechazado" : `${rechazados.length} anuncios rechazados`} por Meta (${rechazados.slice(0, 2).join(", ")}${rechazados.length > 2 ? "…" : ""}). Corregir o apelar.` });
    return { nombre, ...cifras(d) };
  });
  const top = (xs: Punto[]) => xs.sort((a, b) => b.peso - a.peso).slice(0, 3);
  return { cuentas: porCuenta, dia: cifras(todasDia), anterior: cifras(todasAnt), oportunidades: top(oportunidades), riesgos: top(riesgos) };
}

const esc = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export function componerResumenConciso(r: ResumenConciso, o: { momento: string; etiquetaDia: string; urlPanel?: string }): string {
  const cplTxt = (c: CifrasResumen) => (c.cpl == null ? "—" : cop(c.cpl));
  const L: string[] = [
    `🔮 <b>Oráculo · ${esc(o.momento)}</b>`,
    "",
    `<b>${esc(o.etiquetaDia)}</b>`,
    `💰 Gasto: ${cop(r.dia.gasto)}`,
    `💬 Leads: ${num(r.dia.leads)}`,
    `📊 Costo por lead: ${cplTxt(r.dia)}  <i>(día anterior ${cplTxt(r.anterior)} · ${num(r.anterior.leads)} leads)</i>`,
    "",
  ];
  for (const c of r.cuentas.filter((x) => x.gasto > 0)) L.push(`• ${esc(c.nombre)}: ${num(c.leads)} leads · ${cplTxt(c)} c/u`);
  L.push("", "✅ <b>Oportunidades</b>");
  if (r.oportunidades.length) r.oportunidades.forEach((x, i) => L.push(`${i + 1}. ${esc(x.texto)}`));
  else L.push("Nada que escalar hoy.");
  L.push("", "⚠️ <b>Riesgos</b>");
  if (r.riesgos.length) r.riesgos.forEach((x, i) => L.push(`${i + 1}. ${esc(x.texto)}`));
  else L.push("Sin riesgos importantes.");
  if (o.urlPanel) L.push("", `Detalle en el panel: ${esc(o.urlPanel)}`);
  return L.join("\n");
}
