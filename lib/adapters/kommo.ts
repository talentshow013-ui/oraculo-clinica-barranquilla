/**
 * Kommo (CRM de la clínica, donde caen los leads de WhatsApp) → embudo de pacientes, SOLO LECTURA.
 *
 * Lee los pipelines (etapas) y los leads con su etapa, fecha, precio, utm y campaña, y los convierte
 * en `RegistroEmbudo` AGREGADOS por día × fuente × campaña × paso (`lead_calificado`,
 * `cita_agendada`, `cita_asistida`, `venta`). Nunca guarda personas: ni nombre, ni teléfono, ni id
 * de lead; cada registro lleva `nRegistros` para el k-anonimato del panel. Las etapas de Kommo se
 * mapean a pasos por nombre (cita, asistió, venta…) y, si la clínica usa otros nombres, por
 * `config/kommo.json` ({ "<statusId>": "cita_agendada" }). Token de larga duración en `.env`.
 *
 * Solo GET: /api/v4/leads/pipelines y /api/v4/leads. Nada se escribe en Kommo.
 */
import type { FuenteAtribuida, Paso, RegistroEmbudo } from "@/lib/adapters/types";
import { aFechaBogota } from "@/lib/format/fechas";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Json = any;
export type PeticionKommo = (ruta: string, params?: Record<string, string | number>) => Promise<Json>;

export function crearPeticionKommo(subdominio: string, token: string, fetchFn: typeof fetch = fetch): PeticionKommo {
  return async (ruta, params = {}) => {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) q.set(k, String(v));
    const r = await fetchFn(`https://${subdominio}.kommo.com${ruta}${q.size ? `?${q}` : ""}`, { headers: { authorization: `Bearer ${token}` } });
    if (r.status === 204) return {};
    const json = (await r.json().catch(() => ({}))) as Json;
    if (!r.ok) throw new Error(`Kommo respondió (${r.status}): ${json?.hint ?? json?.detail ?? json?.title ?? r.statusText}`);
    return json;
  };
}

export interface EtapaKommo {
  id: number;
  nombre: string;
  pipelineId: number;
  tipo: "normal" | "ganado" | "perdido";
  orden: number;
}

/** Etapa (status) de Kommo → paso del embudo. null = no cuenta (perdido, o etapa que no es un avance). */
export function clasificarEtapa(e: EtapaKommo, manual: Record<string, Paso> = {}): Paso | null {
  const m = manual[String(e.id)];
  if (m) return m;
  if (e.tipo === "ganado") return "venta";
  if (e.tipo === "perdido") return null;
  const n = e.nombre.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  if (/venta|vendid|pag[oó]|cerrad|compr|factur/.test(n)) return "venta";
  if (/asisti|atendid|valorad|lleg[oó]|realizad|en consulta|mis pacientes|^pacientes|^vivante$/.test(n)) return "cita_asistida";
  if (/cita|agend|program|reserv/.test(n)) return "cita_agendada";
  return "lead_calificado";
}

/** Orden de avance: un lead en un paso avanzado también pasó por los anteriores. */
const ORDEN: Paso[] = ["lead_calificado", "cita_agendada", "cita_asistida", "venta"];

export function fuenteDeLead(c: { utm_source?: string | null; utm_medium?: string | null; fuente?: string | null }): FuenteAtribuida {
  const src = (c.utm_source ?? "").toLowerCase();
  const med = (c.utm_medium ?? "").toLowerCase();
  const f = (c.fuente ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const pagado = /cpc|paid|ads|pauta|ppc|cpm/.test(med);
  if (/tiktok/.test(src) || /tiktok/.test(f)) return "tiktok";
  if (/facebook|instagram|^fb$|^ig$|meta/.test(src)) return pagado || med === "" ? "meta" : "organico";
  if (/organ|social/.test(med) || /organ/.test(f)) return "organico";
  if (/referid|recomend|referral/.test(src + f)) return "referido";
  if (/google|search|web|sitio|directo|direct/.test(src + f)) return "directo";
  if (/meta|facebook|instagram|whatsapp ads|pauta/.test(f)) return "meta";
  return "desconocido";
}

export interface LeadKommo {
  id: number;
  creado: string;
  etapaId: number;
  pipelineId: number;
  precio: number;
  fuente: FuenteAtribuida;
  cerradoEn: string | null;
  campanaId: string | null;
}

const clave = (fecha: string, fuente: string, campanaId: string | null, paso: Paso) => `${fecha}|${fuente}|${campanaId ?? ""}|${paso}`;

/** Leads → registros agregados. Cada lead cuenta en su paso actual y en todos los anteriores (con fecha de creación); la venta se fecha al cierre y lleva el valor. */
export function agregarLeads(leads: ReadonlyArray<LeadKommo>, etapas: ReadonlyArray<EtapaKommo>, manual: Record<string, Paso>): RegistroEmbudo[] {
  const porEtapa = new Map(etapas.map((e) => [e.id, e]));
  const acum = new Map<string, RegistroEmbudo>();
  const suma = (fecha: string, fuente: FuenteAtribuida, campanaId: string | null, paso: Paso, valor: number | null) => {
    const k = clave(fecha, fuente, campanaId, paso);
    const r = acum.get(k) ?? { fecha, campanaId, fuenteAtribuida: fuente, paso, cantidad: 0, valorCOP: null, servicio: null, sede: null, nRegistros: 0 };
    r.cantidad += 1;
    r.nRegistros += 1;
    if (valor != null && valor > 0) r.valorCOP = (r.valorCOP ?? 0) + valor;
    acum.set(k, r);
  };
  for (const l of leads) {
    const etapa = porEtapa.get(l.etapaId);
    const paso = etapa ? clasificarEtapa(etapa, manual) : "lead_calificado";
    // todo lead fue lead, aunque hoy esté perdido
    suma(l.creado, l.fuente, l.campanaId, "lead_calificado", null);
    if (!paso || paso === "lead_calificado") continue;
    const hasta = ORDEN.indexOf(paso);
    for (let i = 1; i <= hasta; i++) {
      const p = ORDEN[i]!;
      if (p === "venta") suma(l.cerradoEn ?? l.creado, l.fuente, l.campanaId, "venta", l.precio);
      else suma(l.creado, l.fuente, l.campanaId, p, null);
    }
  }
  return [...acum.values()].sort((a, b) => a.fecha.localeCompare(b.fecha) || a.paso.localeCompare(b.paso));
}

export interface LoteKommo {
  etapas: EtapaKommo[];
  embudo: RegistroEmbudo[];
  meta: { capturadoEn: string; desde: string; hasta: string; origen: "kommo"; leads: number; avisos: string[] };
}

export interface OpcionesKommo {
  pedir: PeticionKommo;
  desde: string;
  hasta: string;
  /** Etapa (status id) → paso, cuando el nombre no basta. */
  manual?: Record<string, Paso>;
  /** Canal de entrada de Kommo (source_id) → fuente atribuida; los utm de WhatsApp suelen venir vacíos. */
  fuentes?: Record<string, FuenteAtribuida>;
  ahora?: string;
}

const campo = (l: Json, codigo: string): string | null => {
  const f = (l.custom_fields_values ?? []).find((x: Json) => String(x.field_code ?? "").toUpperCase() === codigo || String(x.field_name ?? "").toUpperCase() === codigo);
  const v = f?.values?.[0]?.value;
  return v == null ? null : String(v);
};
const epochAFecha = (s: number | null | undefined) => (s ? aFechaBogota(new Date(s * 1000)) : null);

export async function sincronizarKommo(o: OpcionesKommo): Promise<LoteKommo> {
  const avisos: string[] = [];
  const pipes = await o.pedir("/api/v4/leads/pipelines");
  const etapas: EtapaKommo[] = [];
  for (const p of pipes?._embedded?.pipelines ?? []) {
    for (const s of p?._embedded?.statuses ?? []) {
      const id = Number(s.id);
      etapas.push({ id, nombre: String(s.name ?? id), pipelineId: Number(s.pipeline_id ?? p.id), tipo: id === 142 || s.type === 1 ? "ganado" : id === 143 || s.type === 2 ? "perdido" : "normal", orden: Number(s.sort ?? 0) });
    }
  }
  const desdeEpoch = Math.floor(Date.UTC(Number(o.desde.slice(0, 4)), Number(o.desde.slice(5, 7)) - 1, Number(o.desde.slice(8, 10)), 5) / 1000);
  const leads: LeadKommo[] = [];
  for (let page = 1; page <= 200; page++) {
    const json = await o.pedir("/api/v4/leads", { page, limit: 250, "filter[created_at][from]": desdeEpoch, with: "source_id" });
    const lista: Json[] = json?._embedded?.leads ?? [];
    for (const l of lista) {
      const creado = epochAFecha(l.created_at);
      if (!creado || creado > o.hasta) continue;
      const utm_source = campo(l, "UTM_SOURCE");
      const utm_medium = campo(l, "UTM_MEDIUM");
      const utm_campaign = campo(l, "UTM_CAMPAIGN");
      const fuenteTexto = campo(l, "SOURCE") ?? campo(l, "FUENTE") ?? campo(l, "ORIGEN");
      let fuente = fuenteDeLead({ utm_source, utm_medium, fuente: fuenteTexto });
      if (fuente === "desconocido" && l.source_id != null && o.fuentes?.[String(l.source_id)]) fuente = o.fuentes[String(l.source_id)]!;
      leads.push({ id: Number(l.id), creado, etapaId: Number(l.status_id), pipelineId: Number(l.pipeline_id), precio: Number(l.price ?? 0) || 0, fuente, cerradoEn: epochAFecha(l.closed_at), campanaId: utm_campaign && /^\d{6,}$/.test(utm_campaign) ? utm_campaign : null });
    }
    if (lista.length < 250) break;
  }
  if (!leads.length) avisos.push("Kommo no devolvió leads en el periodo.");
  const sinFuente = leads.filter((l) => l.fuente === "desconocido").length;
  if (leads.length && sinFuente / leads.length > 0.5) avisos.push(`${sinFuente} de ${leads.length} leads de Kommo llegan sin fuente (los utm vienen vacíos): se cuentan como «desconocido». Para separar Meta de orgánico hay que decir qué canal es cada uno en config/kommo.json («fuentes»).`);
  return { etapas, embudo: agregarLeads(leads, etapas, o.manual ?? {}), meta: { capturadoEn: o.ahora ?? new Date().toISOString(), desde: o.desde, hasta: o.hasta, origen: "kommo", leads: leads.length, avisos } };
}

/** Une con la captura anterior: los días del rango nuevo reemplazan; el resto se conserva. */
export function fusionarKommo(viejo: LoteKommo | null, nuevo: LoteKommo): LoteKommo {
  if (!viejo) return nuevo;
  const fuera = (r: RegistroEmbudo) => r.fecha < nuevo.meta.desde || r.fecha > nuevo.meta.hasta;
  return { etapas: nuevo.etapas.length ? nuevo.etapas : viejo.etapas, embudo: [...viejo.embudo.filter(fuera), ...nuevo.embudo].sort((a, b) => a.fecha.localeCompare(b.fecha)), meta: { ...nuevo.meta, desde: viejo.meta.desde < nuevo.meta.desde ? viejo.meta.desde : nuevo.meta.desde, hasta: viejo.meta.hasta > nuevo.meta.hasta ? viejo.meta.hasta : nuevo.meta.hasta } };
}
