/**
 * Pacientes (Kommo): qué pasa con los leads después del clic. Leads → cita agendada → asistió →
 * venta, por periodo, por fuente y por semana, con las tasas entre pasos y lecturas de dueño.
 * Todo sale de `datos/kommo.json` (agregado, sin personas). Sin datos → «—», nunca cero.
 */
import type { LoteKommo } from "@/lib/adapters/kommo";
import type { FuenteAtribuida, RegistroEmbudo } from "@/lib/adapters/types";
import type { FuenteHallazgo } from "@/lib/diagnostics/engine";
import { semanaISO } from "@/lib/format/fechas";

export const NOMBRE_FUENTE: Record<FuenteAtribuida, string> = { meta: "Pauta de Meta", tiktok: "TikTok", organico: "Orgánico", referido: "Referidos", directo: "Directo / sitio web", desconocido: "Sin fuente (no etiquetada en Kommo)" };

export interface TotalesPacientes {
  leads: number;
  citas: number;
  asistieron: number;
  ventas: number;
  valorVentas: number;
}

export interface FuentePacientes extends TotalesPacientes {
  fuente: FuenteAtribuida;
  leadACita: number | null;
  leadAVenta: number | null;
}

export interface SemanaPacientes extends TotalesPacientes {
  semana: string;
  desde: string;
}

export interface ResultadoPacientes {
  sinDatos: boolean;
  desde: string;
  hasta: string;
  capturadoEn: string | null;
  avisos: string[];
  totales: TotalesPacientes;
  tasas: { leadACita: number | null; citaAAsistencia: number | null; asistenciaAVenta: number | null; leadAVenta: number | null };
  porFuente: FuentePacientes[];
  porSemana: SemanaPacientes[];
  /** Etapas de Kommo leídas, para que la clínica vea cómo se mapearon. */
  etapas: { nombre: string; paso: string }[];
  lecturas: string[];
  fuente: FuenteHallazgo;
}

const tasa = (n: number, d: number): number | null => (d > 0 ? n / d : null);
const pctTexto = (v: number) => `${(v * 100).toFixed(1).replace(".", ",")} %`;
const vacioT = (): TotalesPacientes => ({ leads: 0, citas: 0, asistieron: 0, ventas: 0, valorVentas: 0 });

function acumular(t: TotalesPacientes, r: RegistroEmbudo) {
  if (r.paso === "lead_calificado") t.leads += r.cantidad;
  else if (r.paso === "cita_agendada") t.citas += r.cantidad;
  else if (r.paso === "cita_asistida") t.asistieron += r.cantidad;
  else if (r.paso === "venta") {
    t.ventas += r.cantidad;
    t.valorVentas += r.valorCOP ?? 0;
  }
}

const PASO_NOMBRE: Record<string, string> = { lead_calificado: "Lead", cita_agendada: "Cita agendada", cita_asistida: "Asistió", venta: "Venta", perdido: "No cuenta (perdido)" };

function vacio(rango: { desde: string; hasta: string }): ResultadoPacientes {
  return { sinDatos: true, desde: rango.desde, hasta: rango.hasta, capturadoEn: null, avisos: [], totales: vacioT(), tasas: { leadACita: null, citaAAsistencia: null, asistenciaAVenta: null, leadAVenta: null }, porFuente: [], porSemana: [], etapas: [], lecturas: [], fuente: { origen: "Kommo · embudo de pacientes de la clínica", desde: rango.desde, hasta: rango.hasta, registros: 0, metodo: "Todavía no se ha conectado Kommo.", enlace: "/pacientes#fuente" } };
}

export function analizarPacientes(lote: LoteKommo | null, rango: { desde: string; hasta: string }): ResultadoPacientes {
  if (!lote || !lote.embudo.length) return vacio(rango);
  const en = lote.embudo.filter((r) => r.fecha >= rango.desde && r.fecha <= rango.hasta);
  if (!en.length) return { ...vacio(rango), sinDatos: false, capturadoEn: lote.meta.capturadoEn, avisos: lote.meta.avisos };

  const totales = vacioT();
  const porFuenteM = new Map<FuenteAtribuida, TotalesPacientes>();
  const porSemanaM = new Map<string, SemanaPacientes>();
  for (const r of en) {
    acumular(totales, r);
    const f = porFuenteM.get(r.fuenteAtribuida) ?? vacioT();
    acumular(f, r);
    porFuenteM.set(r.fuenteAtribuida, f);
    const s = semanaISO(r.fecha);
    const w = porSemanaM.get(s) ?? { semana: s, desde: r.fecha, ...vacioT() };
    acumular(w, r);
    if (r.fecha < w.desde) w.desde = r.fecha;
    porSemanaM.set(s, w);
  }
  const tasas = { leadACita: tasa(totales.citas, totales.leads), citaAAsistencia: tasa(totales.asistieron, totales.citas), asistenciaAVenta: tasa(totales.ventas, totales.asistieron), leadAVenta: tasa(totales.ventas, totales.leads) };
  const porFuente: FuentePacientes[] = [...porFuenteM.entries()].map(([fuente, t]) => ({ fuente, ...t, leadACita: tasa(t.citas, t.leads), leadAVenta: tasa(t.ventas, t.leads) })).sort((a, b) => b.leads - a.leads);
  const porSemana = [...porSemanaM.values()].sort((a, b) => a.semana.localeCompare(b.semana));

  const lecturas: string[] = [];
  if (tasas.leadACita != null) lecturas.push(`De cada 100 personas que escriben, ${(tasas.leadACita * 100).toFixed(1).replace(".", ",")} agendan cita (${pctTexto(tasas.leadACita)}). ${tasas.leadACita < 0.05 ? "Ahí está la fuga más grande: la conversación, no la pauta." : "La conversación está cumpliendo."}`);
  if (tasas.citaAAsistencia != null) lecturas.push(`De las citas agendadas asiste ${pctTexto(tasas.citaAAsistencia)}${tasas.citaAAsistencia < 0.6 ? ": recordatorio 24 h antes y confirmación por WhatsApp suben esto sin gastar un peso." : "."}`);
  if (totales.ventas > 0 && totales.valorVentas === 0) lecturas.push(`Hay ${totales.ventas} ventas registradas sin valor: en Kommo no están poniendo el precio al cerrar. Sin eso no se puede calcular cuánto vale un lead.`);
  const desconocido = porFuenteM.get("desconocido");
  if (desconocido && totales.leads && desconocido.leads / totales.leads > 0.5) lecturas.push(`${pctTexto(desconocido.leads / totales.leads)} de los leads no dicen de dónde vienen: hay que nombrar los canales en Kommo para saber cuántos trae la pauta.`);

  return {
    sinDatos: false,
    desde: rango.desde,
    hasta: rango.hasta,
    capturadoEn: lote.meta.capturadoEn,
    avisos: lote.meta.avisos,
    totales,
    tasas,
    porFuente,
    porSemana,
    etapas: lote.etapas.filter((e) => e.tipo !== "perdido").map((e) => ({ nombre: e.nombre, paso: PASO_NOMBRE[e.tipo === "ganado" ? "venta" : /mis pacientes|^pacientes|^vivante$|asisti|atendid/i.test(e.nombre) ? "cita_asistida" : /agend|cita/i.test(e.nombre) ? "cita_agendada" : "lead_calificado"]! })),
    lecturas,
    fuente: { origen: "Kommo · embudo de pacientes de la clínica", desde: rango.desde, hasta: rango.hasta, registros: en.length, metodo: "Leads por día de creación, citas y asistencias por la etapa en que está cada lead en Kommo, ventas por la etapa «ganado» con el precio del lead. Conteos agregados; nunca una persona.", enlace: "/pacientes#fuente" },
  };
}
