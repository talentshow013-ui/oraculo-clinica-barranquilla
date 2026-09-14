/**
 * Motor de diagnóstico — determinista, no generativo. (§7.5)
 *
 * Un panel que dice "estás perdiendo 130 millones" tiene que poder responder
 * POR QUÉ con precisión y dar la misma respuesta mañana. Cada regla es código
 * que se audita línea por línea. Cada hallazgo responde: qué pasa, cómo lo
 * sabemos, qué hago, cuánta plata. Se ordena por plata, no por severidad.
 */
import type { BreakdownRow, Creativo, InsightRow, LoteDatos, Rango, RegistroEmbudo } from "@/lib/adapters/types";
import type { ConfigCliente } from "@/config/cliente";
import type { Benchmarks } from "@/config/benchmarks";
import { agregar, filtrarRango, serieDiaria, type Agregado, type PuntoSerie } from "@/lib/metrics/core";
import { construirEmbudo, metricasNegocio, type MetricasNegocio, type PasoEmbudo } from "@/lib/metrics/funnel";
import { evaluarCreativos, type EvaluacionCreativo } from "@/lib/metrics/creative";
import { filtrarPorK } from "@/lib/privacy";
import { listarHuecos, sumarDias } from "@/lib/format/fechas";

export type Area =
  | "entrega"
  | "creativo"
  | "audiencia"
  | "embudo"
  | "operacion"
  | "economia"
  | "datos"
  | "competencia";

export type Severidad = "alta" | "media" | "baja";

export interface Evidencia {
  etiqueta: string;
  valor: string;
}

export interface Hallazgo {
  reglaId: string;
  area: Area;
  severidad: Severidad;
  /** Lenguaje de dueño de clínica, cero jerga. */
  titulo: string;
  explicacion: string;
  /** Los datos exactos que dispararon la regla. */
  evidencia: Evidencia[];
  /** Concretas, no consejos genéricos. */
  acciones: string[];
  /** COP. null si no se puede valorizar con honestidad. */
  plataEnRiesgo: number | null;
  /** Ids del catálogo que sustentan el hallazgo. */
  metricas: string[];
  /** Nota cuando el umbral usado no está calibrado. */
  nota?: string;
}

export interface ContextoDiagnostico {
  lote: LoteDatos;
  cliente: ConfigCliente;
  benchmarks: Benchmarks;
  hoy: string;
  rango: Rango;
  ventanas: { reciente: Rango; previa: Rango };
  /** Solo anuncios (nivel = anuncio) para no contar doble. */
  filasAnuncio: InsightRow[];
  filasConjunto: InsightRow[];
  filasCampana: InsightRow[];
  total: Agregado;
  reciente: Agregado;
  previa: Agregado;
  serie: PuntoSerie[];
  embudo: PasoEmbudo[];
  embudoReciente: PasoEmbudo[];
  embudoPrevio: PasoEmbudo[];
  negocio: MetricasNegocio;
  creativos: EvaluacionCreativo[];
  desglosesVisibles: BreakdownRow[];
  desglosesOcultos: number;
  huecos: string[];
}

export interface Regla {
  id: string;
  area: Area;
  evaluar(ctx: ContextoDiagnostico): Hallazgo | null;
}

export interface ErrorRegla {
  reglaId: string;
  mensaje: string;
}

export interface ResultadoDiagnostico {
  hallazgos: Hallazgo[];
  errores: ErrorRegla[];
  plataEnRiesgoTotal: number | null;
}

const DIAS_VENTANA = 14;

/** Filas del nivel más granular disponible, para no sumar campaña + anuncio. */
function filasPorNivel(filas: ReadonlyArray<InsightRow>, nivel: InsightRow["nivel"]): InsightRow[] {
  return filas.filter((f) => f.nivel === nivel);
}

const diasCubiertos = (filas: ReadonlyArray<InsightRow>) => new Set(filas.map((f) => f.fecha)).size;

function nivelBase(anuncio: InsightRow[], conjunto: InsightRow[], campana: InsightRow[], todas: ReadonlyArray<InsightRow>): InsightRow[] {
  const candidatos = [anuncio, conjunto, campana].filter((n) => n.length);
  if (!candidatos.length) return [...todas];
  let mejor = candidatos[0]!;
  for (const c of candidatos.slice(1)) if (diasCubiertos(c) > diasCubiertos(mejor)) mejor = c;
  return mejor;
}

function registrosEnRango(r: ReadonlyArray<RegistroEmbudo>, rango: Rango): RegistroEmbudo[] {
  return r.filter((x) => x.fecha >= rango.desde && x.fecha <= rango.hasta);
}

export function construirContexto(
  lote: LoteDatos,
  cliente: ConfigCliente,
  benchmarks: Benchmarks,
  hoy: string,
): ContextoDiagnostico {
  const rango = { desde: lote.meta.desde, hasta: lote.meta.hasta };
  const hasta = lote.meta.hasta < hoy ? lote.meta.hasta : hoy;
  const reciente: Rango = { desde: sumarDias(hasta, -(DIAS_VENTANA - 1)), hasta };
  const previa: Rango = { desde: sumarDias(reciente.desde, -DIAS_VENTANA), hasta: sumarDias(reciente.desde, -1) };

  const filasAnuncio = filasPorNivel(lote.insights, "anuncio");
  const filasConjunto = filasPorNivel(lote.insights, "conjunto");
  const filasCampana = filasPorNivel(lote.insights, "campana");
  // Un solo nivel para sumar (nunca campaña + anuncio). Manda el nivel que cubre MÁS DÍAS; a igual
  // cobertura, el más fino. Así una fuente con campañas a 90 días y anuncios a 28 no pierde 62 días.
  const base = nivelBase(filasAnuncio, filasConjunto, filasCampana, lote.insights);

  const total = agregar(base);
  const recienteAgg = agregar(filtrarRango(base, reciente));
  const previaAgg = agregar(filtrarRango(base, previa));

  const creativos: Creativo[] = lote.creativos;
  const { visibles, ocultas } = filtrarPorK(lote.desgloses);

  const presentes = new Set(base.map((f) => f.fecha));
  const huecos = lote.meta.huecos.length ? lote.meta.huecos : listarHuecos(rango.desde, rango.hasta, presentes);

  return {
    lote,
    cliente,
    benchmarks,
    hoy,
    rango,
    ventanas: { reciente, previa },
    filasAnuncio: filasAnuncio.length ? filasAnuncio : base,
    filasConjunto,
    filasCampana,
    total,
    reciente: recienteAgg,
    previa: previaAgg,
    serie: serieDiaria(base),
    embudo: construirEmbudo(lote.embudo, total.gasto, cliente),
    embudoReciente: construirEmbudo(registrosEnRango(lote.embudo, reciente), recienteAgg.gasto, cliente),
    embudoPrevio: construirEmbudo(registrosEnRango(lote.embudo, previa), previaAgg.gasto, cliente),
    negocio: metricasNegocio(lote.embudo, total.gasto, cliente),
    creativos: evaluarCreativos(creativos, filasAnuncio.length ? filasAnuncio : base, benchmarks),
    desglosesVisibles: visibles,
    desglosesOcultos: ocultas.length,
    huecos,
  };
}

/** Evalúa todas las reglas; una que falla no tumba el panel. Ordena por plata. */
export function ejecutarReglas(ctx: ContextoDiagnostico, reglas: ReadonlyArray<Regla>): ResultadoDiagnostico {
  const hallazgos: Hallazgo[] = [];
  const errores: ErrorRegla[] = [];

  for (const regla of reglas) {
    try {
      const h = regla.evaluar(ctx);
      if (h) hallazgos.push(h);
    } catch (e) {
      errores.push({ reglaId: regla.id, mensaje: e instanceof Error ? e.message : String(e) });
    }
  }

  hallazgos.sort((a, b) => {
    if (a.plataEnRiesgo === null && b.plataEnRiesgo === null) return 0;
    if (a.plataEnRiesgo === null) return 1;
    if (b.plataEnRiesgo === null) return -1;
    return b.plataEnRiesgo - a.plataEnRiesgo;
  });

  const conocidos = hallazgos.map((h) => h.plataEnRiesgo).filter((p): p is number => p !== null);
  const plataEnRiesgoTotal = conocidos.length ? conocidos.reduce((s, p) => s + p, 0) : null;

  return { hallazgos, errores, plataEnRiesgoTotal };
}
