/**
 * Resuelve una métrica del catálogo a su valor sobre el resultado del motor.
 * Lo que no se puede calcular con los datos disponibles devuelve null: nunca 0.
 */
import type { MetricaCatalogo } from "@/lib/metrics/catalog";
import type { ContextoDiagnostico, Hallazgo } from "@/lib/diagnostics/engine";
import type { PasoEmbudo, MetricasNegocio } from "@/lib/metrics/funnel";
import type { EvaluacionCreativo } from "@/lib/metrics/creative";
import type { ResultadoRadar } from "@/lib/competitive";
import type { LoteDatos } from "@/lib/adapters/types";
import type { ConfigCliente } from "@/config/cliente";
import * as core from "@/lib/metrics/core";
import { cantidadPaso } from "@/lib/metrics/funnel";
import { diasEntre } from "@/lib/format/fechas";

export interface EntradaResolver {
  lote: LoteDatos;
  hoy: string;
  contexto: ContextoDiagnostico;
  total: core.Agregado;
  reciente: core.Agregado;
  previa: core.Agregado;
  serie: ReadonlyArray<{ fecha: string; agregado: core.Agregado | null }>;
  embudo: PasoEmbudo[];
  negocio: MetricasNegocio;
  creativos: EvaluacionCreativo[];
  hallazgos: Hallazgo[];
  plataEnRiesgoTotal: number | null;
  radar: ResultadoRadar;
  cliente: ConfigCliente;
}

export interface ValorMetrica {
  id: string;
  nombre: string;
  unidad: MetricaCatalogo["unidad"];
  valor: number | string | null;
  /** Valor de las ventanas reciente/anterior (14 días) cuando aplica, para el delta. */
  valorReciente?: number | null;
  valorPrevio: number | null;
  mejorEs: MetricaCatalogo["mejorEs"];
  formula: string;
  porQueImporta: string;
  /** false cuando el motor todavía no calcula esta métrica. */
  calculada: boolean;
}

type Fn = (e: EntradaResolver) => number | string | null;
type FnAgg = (a: core.Agregado) => number | null;

const paso = (e: EntradaResolver, p: PasoEmbudo["paso"]) => e.embudo.find((x) => x.paso === p) ?? null;
const activos = (e: EntradaResolver) => e.creativos.filter((c) => c.agregado.gasto > 0);
const desgl = (e: EntradaResolver, dim: string) => e.contexto.desglosesVisibles.filter((d) => d.dimension === dim);

function fraccionGasto(e: EntradaResolver, dim: string, pred: (valor: string) => boolean): number | null {
  const filas = desgl(e, dim);
  const total = filas.reduce((s, d) => s + d.gasto, 0);
  if (total === 0) return null;
  return filas.filter((d) => pred(d.valor)).reduce((s, d) => s + d.gasto, 0) / total;
}

const normalizar = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Métricas que se derivan directamente del agregado (total y ventana previa). */
const AGREGADAS: Record<string, FnAgg> = {
  inversion: (a) => a.gasto,
  impresiones: (a) => a.impresiones,
  alcance: (a) => a.alcance,
  frecuencia: core.frecuencia,
  puja_promedio: core.pujaPromedio,
  subastas_ganadas: (a) => a.subastasGanadas,
  entidades_activas: (a) => a.entidades,
  dias_con_datos: (a) => a.dias,
  gasto_diario_promedio: (a) => core.razon(a.gasto, a.dias),
  cpm: core.cpm,
  cpc: core.cpc,
  cpc_enlace: core.cpcEnlace,
  cpa: core.cpa,
  costo_conversacion: core.costoConversacion,
  costo_mil_alcance: core.costoMilAlcance,
  costo_vista_landing: core.costoVistaLanding,
  costo_interaccion: core.costoInteraccion,
  costo_3s: core.costo3s,
  costo_thruplay: core.costoThruplay,
  costo_segundo_visto: (a) => core.razon(a.gasto, a.tiempoReproduccionTotal),
  ctr: core.ctr,
  ctr_enlace: core.ctrEnlace,
  ctr_unico: core.ctrUnico,
  calidad_clic: core.calidadClic,
  tasa_interaccion: core.tasaInteraccion,
  tasa_guardado: core.tasaGuardado,
  tasa_compartido: core.tasaCompartido,
  tasa_comentario: core.tasaComentario,
  ratio_guardado_like: core.ratioGuardadoLike,
  tasa_visita_perfil: core.tasaVisitaPerfil,
  fuga_aterrizaje: core.fugaAterrizaje,
  hook_rate: core.hookRate,
  hold_rate: core.holdRate,
  tasa_finalizacion: core.tasaFinalizacion,
  retencion_25: core.retencion25,
  retencion_50: core.retencion50,
  retencion_75: core.retencion75,
  caida_25_50: core.caida2550,
  caida_50_75: core.caida5075,
  tiempo_promedio: core.tiempoPromedio,
  pct_duracion_vista: core.porcentajeDuracionVista,
  eficiencia_segundo: core.eficienciaSegundo,
  ctr_post_hold: core.ctrPostHold,
  reproducciones: (a) => a.reproducciones,
  duracion_creativo: core.duracionPromedio,
  conversaciones_iniciadas: (a) => a.conversacionesIniciadas,
  tasa_conversacion: core.tasaConversacion,
  tasa_respuesta_equipo: core.tasaRespuesta,
  costo_conversacion_respondida: (a) => core.razon(a.gasto, a.conversacionesRespondidas),
  conversaciones_por_dia: (a) => core.razon(a.conversacionesIniciadas, a.dias),
  roas_plataforma: core.roas,
};

const ESPECIALES: Record<string, Fn> = {
  hhi_inversion: (e) => core.concentracionHHI(activos(e).map((c) => c.agregado.gasto)),
  top1_inversion: (e) => core.concentracionTop1(activos(e).map((c) => c.agregado.gasto)),
  // Embudo
  paso_impresion: (e) => paso(e, "impresion")?.cantidad ?? null,
  paso_clic: (e) => paso(e, "clic")?.cantidad ?? null,
  paso_conversacion: (e) => paso(e, "conversacion")?.cantidad ?? null,
  paso_lead_calificado: (e) => paso(e, "lead_calificado")?.cantidad ?? null,
  paso_cita_agendada: (e) => paso(e, "cita_agendada")?.cantidad ?? null,
  paso_cita_asistida: (e) => paso(e, "cita_asistida")?.cantidad ?? null,
  paso_venta: (e) => paso(e, "venta")?.cantidad ?? null,
  paso_recompra: (e) => paso(e, "recompra")?.cantidad ?? null,
  show_rate: (e) => e.negocio.showRate,
  cierre_consultorio: (e) => e.negocio.cierreEnConsultorio,
  tasa_calificacion: (e) => core.razon(cantidadPaso(e.lote.embudo, "lead_calificado"), cantidadPaso(e.lote.embudo, "conversacion")),
  tasa_agendamiento: (e) => core.razon(cantidadPaso(e.lote.embudo, "cita_agendada"), cantidadPaso(e.lote.embudo, "lead_calificado")),
  fuga_pesos: (e) => core.sumaNullable(e.embudo.map((p) => p.fugaCOP)),
  indice_discrepancia: (e) => {
    const plataforma = e.total.resultados;
    const clinica = cantidadPaso(e.lote.embudo, "conversacion");
    return clinica === 0 ? null : Math.abs(plataforma - clinica) / clinica;
  },
  cobertura_datos_venta: (e) => {
    const dias = diasEntre(e.lote.meta.desde, e.lote.meta.hasta);
    const con = new Set(e.lote.embudo.filter((r) => r.paso === "venta" || r.paso === "cita_asistida").map((r) => r.fecha)).size;
    return core.razon(con, dias);
  },
  costo_lead_calificado: (e) => paso(e, "lead_calificado")?.costoUnitario ?? null,
  costo_cita_agendada: (e) => paso(e, "cita_agendada")?.costoUnitario ?? null,
  costo_cita_asistida: (e) => e.negocio.costoCitaAsistida,
  cac: (e) => e.negocio.cac,
  // Negocio
  ingresos_caja: (e) => e.negocio.ingresosCaja,
  roas_real: (e) => e.negocio.roasReal,
  poas: (e) => e.negocio.poas,
  margen_unitario: (e) => e.negocio.margenUnitarioCOP,
  ticket_promedio: (e) => core.razon(paso(e, "venta")?.valorCOP ?? null, paso(e, "venta")?.cantidad ?? null),
  cac_margen: (e) => e.negocio.ratioCacMargen,
  ltv: (e) => e.negocio.ltv,
  ltv_cac: (e) => e.negocio.ltvSobreCac,
  tasa_recompra: (e) => e.negocio.tasaRecompra,
  ocupacion_agenda: (e) => {
    const dias = e.contexto.serie.length;
    const cupos = dias * e.cliente.cuposDiarios;
    return core.razon(cantidadPaso(e.lote.embudo, "cita_asistida"), cupos);
  },
  costo_cupo_vacio: (e) => {
    const dias = e.contexto.serie.length;
    const vacios = Math.max(0, dias * e.cliente.cuposDiarios - cantidadPaso(e.lote.embudo, "cita_asistida"));
    return e.negocio.margenUnitarioCOP === null ? null : vacios * e.negocio.margenUnitarioCOP;
  },
  elasticidad_inversion: (e) => {
    const dGasto = core.delta(e.reciente.gasto, e.previa.gasto);
    const rec = e.contexto.embudoReciente.find((p) => p.paso === "cita_asistida")?.cantidad ?? null;
    const prev = e.contexto.embudoPrevio.find((p) => p.paso === "cita_asistida")?.cantidad ?? null;
    const dCitas = core.delta(rec, prev);
    return dGasto === null || dCitas === null || dGasto === 0 ? null : dCitas / dGasto;
  },
  margen_bruto_pauta: (e) =>
    e.negocio.ingresosCaja === null || e.negocio.margenFraccion === null ? null : e.negocio.ingresosCaja * e.negocio.margenFraccion - e.negocio.gasto,
  punto_equilibrio_cac: (e) => (e.negocio.margenUnitarioCOP === null ? null : e.negocio.margenUnitarioCOP * e.cliente.margenObjetivo),
  payback_meses: (e) => {
    if (e.negocio.cac === null || e.negocio.ltv === null) return null;
    const mensual = e.negocio.ltv / e.cliente.horizonteLtvMeses;
    return core.razon(e.negocio.cac, mensual);
  },
  // Creativo
  indice_fatiga: (e) => {
    const con = activos(e).filter((c) => c.fatiga.indice !== null);
    return con.length ? Math.max(...con.map((c) => c.fatiga.indice ?? 0)) : null;
  },
  fatiga_promedio_activos: (e) => {
    const con = activos(e).filter((c) => c.fatiga.indice !== null);
    const gasto = con.reduce((s, c) => s + c.agregado.gasto, 0);
    return gasto === 0 ? null : con.reduce((s, c) => s + (c.fatiga.indice ?? 0) * c.agregado.gasto, 0) / gasto;
  },
  vida_util: (e) => {
    const con = e.creativos.filter((c) => c.vidaUtilDias !== null);
    return con.length ? con.reduce((s, c) => s + (c.vidaUtilDias ?? 0), 0) / con.length : null;
  },
  ritmo_renovacion: (e) => {
    const semanas = diasEntre(e.lote.meta.desde, e.lote.meta.hasta) / 7;
    return core.razon(e.creativos.length, semanas);
  },
  creativos_activos: (e) => activos(e).length,
  diversidad_angulos: (e) => new Set(activos(e).map((c) => c.creativo.anguloDetectado)).size,
  cobertura_consciencia: (e) => new Set(activos(e).map((c) => c.creativo.nivelConsciencia)).size,
  riesgo_politica: (e) => e.hallazgos.find((h) => h.reglaId === "R09")?.evidencia.length ?? 0,
  cuadrante_decision: (e) => {
    const mejor = activos(e).filter((c) => c.cuadrante === "escalar").length;
    return `${mejor} para escalar`;
  },
  creativos_sin_senal: (e) => e.creativos.filter((c) => c.cuadrante === "sin_senal").length,
  mejor_creativo_costo: (e) => {
    const con = activos(e).filter((c) => c.cuadrante !== "sin_senal" && c.costoResultado !== null);
    if (!con.length) return null;
    return con.sort((a, b) => (a.costoResultado ?? 0) - (b.costoResultado ?? 0))[0]!.creativo.copyPrincipal.slice(0, 60);
  },
  dias_desde_ultimo_nuevo: (e) => {
    const ultimo = e.creativos.map((c) => c.creativo.fechaPrimerGasto).sort().at(-1);
    return ultimo ? diasEntre(ultimo, e.hoy) - 1 : null;
  },
  // Audiencia
  inversion_fuera_radio: (e) => {
    const validas = new Set(e.cliente.zonasValidas.map(normalizar));
    return fraccionGasto(e, "ubicacion", (v) => !validas.has(normalizar(v)));
  },
  inversion_fuera_horario: (e) => {
    const { inicio, fin } = e.cliente.horarioAtencion;
    return fraccionGasto(e, "hora", (v) => Number(v) < inicio || Number(v) >= fin);
  },
  concentracion_zona: (e) => {
    const filas = desgl(e, "ubicacion");
    const porZona = new Map<string, number>();
    for (const f of filas) porZona.set(f.valor, (porZona.get(f.valor) ?? 0) + f.gasto);
    return core.concentracionTop1([...porZona.values()]);
  },
  segmentos_sin_resultado: (e) => e.hallazgos.filter((h) => h.reglaId === "R11").length,
  solapamiento_conjuntos: (e) => (e.hallazgos.some((h) => h.reglaId === "R13") ? 1 : 0),
  segmentos_enmascarados: (e) => e.contexto.desglosesOcultos,
  cpa_edad: (e) => cpaMejorSegmento(e, "edad"),
  cpa_genero: (e) => cpaMejorSegmento(e, "genero"),
  cpa_zona: (e) => cpaMejorSegmento(e, "ubicacion"),
  cpa_plataforma: (e) => cpaMejorSegmento(e, "plataforma"),
  cpa_hora: (e) => cpaMejorSegmento(e, "hora"),
  // Competencia
  puntuacion_longevidad: (e) => {
    const a = e.radar.ganadores[0];
    return a ? a.puntuacionLongevidad : null;
  },
  anuncios_60_dias: (e) => e.radar.ganadores.length,
  cadencia_competencia: (e) => e.radar.cadencia.total,
  brecha_cadencia: (e) => core.razon(e.radar.cadenciaPropia, e.radar.cadencia.total),
  entradas_competencia: (e) => e.radar.movimientos.entradas.length,
  salidas_competencia: (e) => e.radar.movimientos.salidas.length,
  espacios_vacios: (e) => e.radar.espaciosVacios.length,
  angulos_saturados: (e) => e.radar.mapaAngulos.filter((a) => a.saturado).length,
  participacion_voz: (e) => e.radar.participacionVoz,
  competidores_activos: (e) => e.radar.competidoresActivos,
  uso_precio_competencia: (e) => e.radar.usoPrecio,
  uso_testimonio_competencia: (e) => e.radar.usoTestimonio,
  variantes_por_concepto: (e) => e.radar.variantesPromedio,
  // Salud
  cobertura_periodo: (e) => core.razon(e.contexto.serie.length, diasEntre(e.lote.meta.desde, e.lote.meta.hasta)),
  frescura_datos: (e) => diasEntre(e.lote.meta.hasta, e.hoy) - 1,
  huecos_datos: (e) => e.contexto.huecos.length,
  conjuntos_en_aprendizaje: (e) => e.hallazgos.find((h) => h.reglaId === "R21")?.evidencia.length ?? 0,
  anuncios_rechazados: (e) => e.lote.insights.filter((i) => i.nivel === "anuncio" && (i.estado === "rechazado" || i.estado === "en_revision")).length,
  volatilidad_cpa: (e) => core.coeficienteVariacion(e.contexto.serie.map((p) => core.cpa(p.agregado)).filter((x): x is number => x !== null)),
  senal_estadistica: (e) => core.razon(activos(e).filter((c) => c.cuadrante !== "sin_senal").length, activos(e).length),
  puntaje_optimizacion: () => null,
  dias_sin_actualizar: (e) => diasEntre(e.lote.meta.generadoEn.slice(0, 10), e.hoy) - 1,
  // Operación
  plata_en_riesgo: (e) => e.plataEnRiesgoTotal,
  ahorro_capturado: () => null,
  experimentos_activos: (e) => e.lote.experimentos.filter((x) => x.resultado === "en_curso").length,
  experimentos_ganados: (e) => {
    const g = e.lote.experimentos.filter((x) => x.resultado === "gano").length;
    const p = e.lote.experimentos.filter((x) => x.resultado === "perdio").length;
    return core.razon(g, g + p);
  },
  tiempo_reaccion: () => null,
  indice_madurez: (e) => {
    const partes = [
      core.razon(e.serie.length, diasEntre(e.lote.meta.desde, e.lote.meta.hasta)),
      e.negocio.calibrado ? 1 : 0,
      e.lote.experimentos.length > 0 ? 1 : 0,
      Math.min(1, activos(e).length / 3),
    ].filter((x): x is number => x !== null);
    return partes.length ? partes.reduce((s, x) => s + x, 0) / partes.length : null;
  },
  hallazgos_abiertos: (e) => e.hallazgos.length,
  penetracion_mercado: () => null,
  ritmo_entrega: () => null,
  ingresos_por_servicio: (e) => paso(e, "venta")?.valorCOP ?? null,
  cac_servicio: (e) => e.negocio.cac,
  tiempo_primera_respuesta: () => null,
  conversaciones_fuera_horario: (e) => {
    const { inicio, fin } = e.cliente.horarioAtencion;
    const filas = desgl(e, "hora");
    const total = filas.reduce((s, d) => s + (d.conversacionesIniciadas ?? 0), 0);
    if (total === 0) return null;
    return filas.filter((d) => Number(d.valor) < inicio || Number(d.valor) >= fin).reduce((s, d) => s + (d.conversacionesIniciadas ?? 0), 0) / total;
  },
};

/** Costo por resultado del mejor segmento de una dimensión (con k mínimo). */
function cpaMejorSegmento(e: EntradaResolver, dim: string): number | null {
  const filas = desgl(e, dim);
  const por = new Map<string, { gasto: number; resultados: number }>();
  for (const f of filas) {
    const a = por.get(f.valor) ?? { gasto: 0, resultados: 0 };
    a.gasto += f.gasto;
    a.resultados += f.resultados;
    por.set(f.valor, a);
  }
  const cpas = [...por.values()].map((a) => core.razon(a.gasto, a.resultados)).filter((x): x is number => x !== null);
  return cpas.length ? Math.min(...cpas) : null;
}

export function resolverMetrica(m: MetricaCatalogo, e: EntradaResolver): ValorMetrica {
  const base = { id: m.id, nombre: m.nombre, unidad: m.unidad, mejorEs: m.mejorEs, formula: m.formula, porQueImporta: m.porQueImporta };
  const agg = AGREGADAS[m.id];
  if (agg) {
    return { ...base, valor: agg(e.total), calculada: true, ...ventanas(agg, e) };
  }
  const esp = ESPECIALES[m.id];
  if (esp) {
    let valor: number | string | null = null;
    try {
      valor = esp(e);
    } catch {
      valor = null;
    }
    if (typeof valor === "number" && !Number.isFinite(valor)) valor = null;
    return { ...base, valor, valorPrevio: null, calculada: true };
  }
  return { ...base, valor: null, valorPrevio: null, calculada: false };
}

/** Para agregadas: valor de la ventana reciente y de la previa (mismo tamaño). */
function ventanas(fn: FnAgg, e: EntradaResolver): { valorReciente: number | null; valorPrevio: number | null } {
  return { valorReciente: fn(e.reciente), valorPrevio: fn(e.previa) };
}

export function resolverTodas(catalogo: ReadonlyArray<MetricaCatalogo>, e: EntradaResolver): ValorMetrica[] {
  return catalogo.map((m) => resolverMetrica(m, e));
}
