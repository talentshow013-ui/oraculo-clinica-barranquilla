/**
 * Alertas y «estado de la pauta» que la clínica pidió recibir por Telegram tres veces al día
 * (6 a. m., 12 m., 6 p. m.). Umbrales de la clínica en `UMBRALES_CLINICA`:
 *   - costo por lead (conversación) por encima de $4.000,
 *   - anuncio rechazado,
 *   - CTR por debajo de 1,30 % a nivel de conjunto,
 *   - anuncio de bajo rendimiento medido a 3, 7 y 15 días: más de 2.000 impresiones y ningún
 *     resultado, con CTR bajo (< 1,30 %) o gancho bajo (< 20 % vio 3 s),
 *   - la cuenta lleva 2 días completos gastando y 0 conversiones (la medición se rompió),
 *   - y, siempre, cuántos leads trajo cada campaña y anuncio activo y a qué costo.
 * Todo sale de las filas del lote (`insights`); aquí no se llama a ninguna plataforma.
 */
import type { InsightRow } from "@/lib/adapters/types";
import { cop, num, pct } from "@/lib/format";
import { fechaCorta, sumarDias } from "@/lib/format/fechas";
import { agregar, ctr, hookRate, holdRate, razon, type Agregado } from "@/lib/metrics/core";
import { esFruto } from "@/lib/adapters/meta.mcp";

export interface Umbrales {
  /** Costo por lead máximo (COP). */
  cplMaximo: number;
  /** CTR mínimo a nivel de conjunto (0–1). */
  ctrMinimoConjunto: number;
  /** Impresiones mínimas en la ventana para juzgar el CTR de un conjunto (evita alertar con 40 impresiones). */
  impresionesMinimasCtr: number;
  hookMinimo: number;
  holdMinimo: number;
  /** Más de estas impresiones sin un solo resultado = bajo rendimiento. */
  impresionesSinResultado: number;
  /** Días de medición del bajo rendimiento. */
  ventanas: number[];
  /** Un anuncio es «nuevo» si su primer día con datos está dentro de estos días. */
  diasNuevo: number;
  /** Gasto diario mínimo para que «0 conversiones» signifique medición rota y no un día flojo. */
  gastoMinimoSinConversiones: number;
}

export const UMBRALES_CLINICA: Umbrales = { cplMaximo: 4000, ctrMinimoConjunto: 0.013, impresionesMinimasCtr: 1000, hookMinimo: 0.2, holdMinimo: 0.2, impresionesSinResultado: 2000, ventanas: [3, 7, 15], diasNuevo: 3, gastoMinimoSinConversiones: 20000 };

export type TipoAlerta = "sin_conversiones" | "cpl_alto" | "rechazado" | "ctr_bajo_conjunto" | "bajo_rendimiento";

export interface Alerta {
  tipo: TipoAlerta;
  nivel: InsightRow["nivel"];
  entidad: string;
  /** Ventanas (días) en las que se cumple; para lo que no se mide por ventana, []. */
  ventanas: number[];
  texto: string;
}

/** ¿Busca contactos (conversación o lead)? Google siempre; en Meta, según su columna «Resultados». Compras y clics, no. */
const buscaContactos = (f: InsightRow) => f.fuente === "google" || (f.tipoResultado != null && esFruto(f.tipoResultado) && !/compra|purchase/i.test(f.tipoResultado));

/** Leads = conversaciones iniciadas si la fuente las trae; si no, resultados. */
const leads = (a: Agregado) => a.conversacionesIniciadas ?? a.resultados;
const cpl = (a: Agregado) => razon(a.gasto, leads(a));

interface Entidad {
  nivel: InsightRow["nivel"];
  id: string;
  nombre: string;
  padreId: string | null;
  estado: InsightRow["estado"];
  primerDia: string;
  ultimoDia: string;
  filas: InsightRow[];
}

function entidades(filas: ReadonlyArray<InsightRow>): Entidad[] {
  const m = new Map<string, Entidad>();
  for (const f of [...filas].sort((a, b) => a.fecha.localeCompare(b.fecha))) {
    const k = `${f.nivel}:${f.id}`;
    const e = m.get(k);
    if (e) {
      e.filas.push(f);
      e.ultimoDia = f.fecha;
      e.estado = f.estado; // el estado más reciente manda
      if (f.nombre) e.nombre = f.nombre;
    } else m.set(k, { nivel: f.nivel, id: f.id, nombre: f.nombre || f.id, padreId: f.padreId, estado: f.estado, primerDia: f.fecha, ultimoDia: f.fecha, filas: [f] });
  }
  return [...m.values()];
}

/** Último día con datos del lote (puede ser hoy si se sincronizó a mediodía). */
const ultimoDiaConDatos = (filas: ReadonlyArray<InsightRow>) => filas.reduce((max, f) => (f.fecha > max ? f.fecha : max), "");

const enVentana = (e: Entidad, hasta: string, dias: number) => agregar(e.filas.filter((f) => f.fecha > sumarDias(hasta, -dias) && f.fecha <= hasta));

export function evaluarAlertas(filas: ReadonlyArray<InsightRow>, hoy: string, u: Umbrales): Alerta[] {
  if (!filas.length) return [];
  const hasta = ultimoDiaConDatos(filas);
  const ents = entidades(filas);
  const salida: Alerta[] = [];
  const v3 = u.ventanas[0] ?? 3;

  /* medición rota: los dos últimos días completos con gasto y ni una conversión, contando solo las
     campañas que buscan contactos (Google siempre; en Meta las de mensajes, clientes potenciales o ventas) */
  const buscan = filas.filter((f) => f.nivel === "campana" && buscaContactos(f));
  const dia = (d: string) => agregar(buscan.filter((f) => f.fecha === d));
  const [a1, a2] = [dia(sumarDias(hoy, -1)), dia(sumarDias(hoy, -2))];
  if (a1.gasto >= u.gastoMinimoSinConversiones && a2.gasto >= u.gastoMinimoSinConversiones && leads(a1) === 0 && leads(a2) === 0) {
    salida.push({ tipo: "sin_conversiones", nivel: "cuenta", entidad: "la cuenta", ventanas: [2], texto: `Dos días gastando (${cop(a1.gasto + a2.gasto)}) y ni una conversión registrada. Si por WhatsApp sí están llegando mensajes, la medición se rompió: hay que revisar la etiqueta hoy.` });
  }

  for (const e of ents) {
    if (e.nivel === "cuenta") continue;
    const nombre = e.nombre;

    if (e.nivel === "anuncio" && e.estado === "rechazado") {
      salida.push({ tipo: "rechazado", nivel: e.nivel, entidad: nombre, ventanas: [], texto: `Anuncio rechazado: «${nombre}». Hay que corregirlo o apelar en el administrador.` });
    }

    const a3 = enVentana(e, hasta, v3);
    const activoReciente = e.estado === "activo" && a3.gasto > 0;
    if (!activoReciente) continue;
    /* costo por lead y bajo rendimiento solo tienen sentido en lo que busca contactos */
    const contactos = e.filas.some(buscaContactos);

    if (contactos && (e.nivel === "campana" || e.nivel === "anuncio")) {
      const c = cpl(a3);
      const l = leads(a3);
      if (c != null && c > u.cplMaximo) {
        salida.push({ tipo: "cpl_alto", nivel: e.nivel, entidad: nombre, ventanas: [v3], texto: `${e.nivel === "campana" ? "Campaña" : "Anuncio"} «${nombre}»: cada lead está costando ${cop(c)} (${num(l)} leads con ${cop(a3.gasto)} en ${v3} días). El tope es ${cop(u.cplMaximo)}.` });
      } else if (l === 0 && a3.gasto > u.cplMaximo) {
        salida.push({ tipo: "cpl_alto", nivel: e.nivel, entidad: nombre, ventanas: [v3], texto: `${e.nivel === "campana" ? "Campaña" : "Anuncio"} «${nombre}»: ${cop(a3.gasto)} gastados en ${v3} días y ni un lead.` });
      }
    }

    if (e.nivel === "conjunto") {
      const t = ctr(a3);
      if (t != null && a3.impresiones >= u.impresionesMinimasCtr && t < u.ctrMinimoConjunto) {
        salida.push({ tipo: "ctr_bajo_conjunto", nivel: e.nivel, entidad: nombre, ventanas: [v3], texto: `Conjunto «${nombre}»: CTR ${pct(t, 2)} en ${v3} días (${num(a3.impresiones)} impresiones); el mínimo es ${pct(u.ctrMinimoConjunto, 2)}. El público o el anuncio no están enganchando.` });
      }
    }

    if (contactos && e.nivel === "anuncio") {
      /* regla de la clínica: más de 2.000 impresiones y ningún resultado, con CTR bajo o gancho bajo */
      const ventanas: number[] = [];
      for (const d of u.ventanas) {
        const a = enVentana(e, hasta, d);
        if (a.impresiones <= u.impresionesSinResultado || leads(a) !== 0) continue;
        const t = ctr(a);
        const h = hookRate(a);
        if ((t != null && t < u.ctrMinimoConjunto) || (h != null && h < u.hookMinimo)) ventanas.push(d);
      }
      if (ventanas.length) {
        const aMax = enVentana(e, hasta, ventanas[ventanas.length - 1]!);
        const partes = [`${num(aMax.impresiones)} impresiones y ningún lead`, `CTR ${pct(ctr(aMax), 2)}`];
        if (hookRate(aMax) != null) partes.push(`gancho ${pct(hookRate(aMax))}`);
        salida.push({ tipo: "bajo_rendimiento", nivel: e.nivel, entidad: nombre, ventanas, texto: `Anuncio «${nombre}» viene flojo a ${ventanas.join("/")} días: ${partes.join(" · ")}. Mejor cambiar el gancho o pausarlo.` });
      }
    }
  }
  const orden: Record<TipoAlerta, number> = { sin_conversiones: 0, rechazado: 1, cpl_alto: 2, bajo_rendimiento: 3, ctr_bajo_conjunto: 4 };
  return salida.sort((a, b) => orden[a.tipo] - orden[b.tipo] || a.entidad.localeCompare(b.entidad, "es"));
}

export interface AnuncioEstado {
  nombre: string;
  nuevo: boolean;
  gasto: number;
  impresiones: number;
  ctr: number | null;
  gancho: number | null;
  retencion: number | null;
  leads: number;
  cpl: number | null;
}
export interface CampanaEstado {
  nombre: string;
  gasto: number;
  leads: number;
  cpl: number | null;
  ctr: number | null;
  anuncios: AnuncioEstado[];
}
export interface EstadoPauta {
  hasta: string;
  dias: number;
  ayer: { fecha: string; gasto: number; leads: number; cpl: number | null } | null;
  campanas: CampanaEstado[];
}

/** Todo lo que está al aire (activo y con gasto en los últimos `dias`), campaña por campaña con sus anuncios; lo nuevo, marcado. */
export function estadoPauta(filas: ReadonlyArray<InsightRow>, hoy: string, dias = 3, diasNuevo = UMBRALES_CLINICA.diasNuevo): EstadoPauta {
  if (!filas.length) return { hasta: hoy, dias, ayer: null, campanas: [] };
  const hasta = ultimoDiaConDatos(filas);
  const ents = entidades(filas);
  const conjuntoDeCampana = new Map(ents.filter((e) => e.nivel === "conjunto").map((e) => [e.id, e.padreId]));
  const anuncios = ents.filter((e) => e.nivel === "anuncio");
  const campanas: CampanaEstado[] = [];
  for (const c of ents.filter((e) => e.nivel === "campana")) {
    const a = enVentana(c, hasta, dias);
    if (c.estado !== "activo" || a.gasto <= 0) continue;
    const mios = anuncios
      .filter((x) => x.estado === "activo" && (x.padreId === c.id || conjuntoDeCampana.get(x.padreId ?? "") === c.id))
      .map((x) => ({ e: x, a: enVentana(x, hasta, dias) }))
      .filter(({ a }) => a.impresiones > 0)
      .sort((x, y) => y.a.gasto - x.a.gasto)
      .map(({ e, a }) => ({ nombre: e.nombre, nuevo: e.primerDia > sumarDias(hasta, -diasNuevo), gasto: a.gasto, impresiones: a.impresiones, ctr: ctr(a), gancho: hookRate(a), retencion: holdRate(a), leads: leads(a), cpl: cpl(a) }));
    campanas.push({ nombre: c.nombre, gasto: a.gasto, leads: leads(a), cpl: cpl(a), ctr: ctr(a), anuncios: mios });
  }
  campanas.sort((x, y) => y.gasto - x.gasto);
  const filasCampanaAyer = filas.filter((f) => f.nivel === "campana" && f.fecha === hasta);
  const ay = filasCampanaAyer.length ? agregar(filasCampanaAyer) : null;
  return { hasta, dias, ayer: ay ? { fecha: hasta, gasto: ay.gasto, leads: leads(ay), cpl: cpl(ay) } : null, campanas: campanas };
}

const esc = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const ICONO: Record<TipoAlerta, string> = { sin_conversiones: "🚨", rechazado: "⛔", cpl_alto: "💸", bajo_rendimiento: "📉", ctr_bajo_conjunto: "🎯" };

/** El mensaje de las 6 / 12 / 18: por cuenta, alertas primero y luego el estado de todo lo activo. HTML de Telegram. */
export function componerAvisoPauta(cuentas: ReadonlyArray<{ nombre: string; insights: ReadonlyArray<InsightRow> }>, o: { hoy: string; momento: string; umbrales: Umbrales; urlPanel?: string }): string {
  const L: string[] = [`🔮 <b>Oráculo · ${esc(fechaCorta(o.hoy))} · ${esc(o.momento)}</b>`];
  for (const c of cuentas) {
    const alertas = evaluarAlertas(c.insights, o.hoy, o.umbrales);
    const e = estadoPauta(c.insights, o.hoy, o.umbrales.ventanas[0] ?? 3, o.umbrales.diasNuevo);
    if (!alertas.length && !e.campanas.length) continue;
    L.push("", `<b>${esc(c.nombre)}</b>${e.ayer ? ` · ${esc(fechaCorta(e.ayer.fecha))}: ${num(e.ayer.leads)} leads por ${cop(e.ayer.gasto)}${e.ayer.cpl != null ? ` (${cop(e.ayer.cpl)} cada uno)` : ""}` : ""}`);
    if (alertas.length) {
      L.push(`<b>Alertas</b> (${alertas.length})`);
      for (const a of alertas.slice(0, 8)) L.push(`${ICONO[a.tipo]} ${esc(a.texto)}`);
      if (alertas.length > 8) L.push(`… y ${alertas.length - 8} más en el panel.`);
    } else L.push("✅ Sin alertas.");
    if (e.campanas.length) {
      L.push(`<b>Al aire · últimos ${e.dias} días</b>`);
      for (const ca of e.campanas) {
        L.push(`▪️ ${esc(ca.nombre)}: ${num(ca.leads)} leads · ${cop(ca.gasto)}${ca.cpl != null ? ` · ${cop(ca.cpl)} por lead` : ""}${ca.ctr != null ? ` · CTR ${pct(ca.ctr, 2)}` : ""}`);
        for (const an of ca.anuncios.slice(0, 6)) L.push(`   ${an.nuevo ? "🆕 NUEVO " : "· "}${esc(an.nombre)}: ${num(an.leads)} leads${an.cpl != null ? ` a ${cop(an.cpl)}` : ""} · ${num(an.impresiones)} impr${an.ctr != null ? ` · CTR ${pct(an.ctr, 2)}` : ""}${an.gancho != null ? ` · gancho ${pct(an.gancho, 0)}` : ""}${an.retencion != null ? ` · retención ${pct(an.retencion, 0)}` : ""}`);
        if (ca.anuncios.length > 6) L.push(`   … y ${ca.anuncios.length - 6} anuncios más.`);
      }
    } else L.push("Nada al aire con gasto en los últimos días.");
  }
  if (L.length === 1) L.push("", "Sin pauta activa ni alertas.");
  if (o.urlPanel) L.push("", `Panel: ${esc(o.urlPanel)}`);
  const t = L.join("\n");
  const c = Array.from(t);
  return c.length > 4000 ? c.slice(0, 3999).join("") + "…" : t;
}

/** Clave de una alerta para no repetirla en el día: misma cuenta, mismo tipo, misma campaña o anuncio. */
export function claveAlerta(cuenta: string, a: Pick<Alerta, "tipo" | "entidad">): string {
  return `${cuenta}|${a.tipo}|${a.entidad}`;
}

/** Aviso en el momento: solo las alertas que aparecieron desde el último aviso, agrupadas por cuenta. */
export function componerAlertasNuevas(items: ReadonlyArray<{ cuenta: string; alerta: Alerta }>, hora: string, urlPanel?: string): string {
  const L: string[] = [`🔔 <b>Alerta nueva · ${esc(hora)}</b>`];
  const porCuenta = new Map<string, Alerta[]>();
  for (const x of items) porCuenta.set(x.cuenta, [...(porCuenta.get(x.cuenta) ?? []), x.alerta]);
  for (const [cuenta, alertas] of porCuenta) {
    L.push("", `<b>${esc(cuenta)}</b>`);
    for (const a of alertas.slice(0, 8)) L.push(`${ICONO[a.tipo]} ${esc(a.texto)}`);
  }
  if (urlPanel) L.push("", `Panel: ${esc(urlPanel)}`);
  const t = L.join("\n");
  const c = Array.from(t);
  return c.length > 4000 ? c.slice(0, 3999).join("") + "…" : t;
}
