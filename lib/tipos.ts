/**
 * Barril de tipos para la interfaz. Reexporta los tipos REALES del motor y del contrato.
 * (El frontend se construyó contra tipos deducidos; este archivo los reemplaza sin tocar imports.)
 */
export type { ResultadoMotor, CuentaPublicitaria, AgregadoVista as Agregado, PuntoSerieVista, DesgloseVista, NegocioVista, PeriodoCampanas } from "@/lib/datos";
export type { ResumenCampana, ComparacionCampanas, MetricaComparada } from "@/lib/metrics/campanas";
export type { RegistroSemanal, Semana } from "@/lib/agenda";
export type { Estado as EstadoCampana } from "@/lib/adapters/types";
export type { AnuncioCompetidor, BreakdownRow, Competidor, Creativo, Angulo, Paso, Dimension, Formato, EstadoFuente, LoteDatos } from "@/lib/adapters/types";
export type { PuntoSerie } from "@/lib/metrics/core";
export type { PasoEmbudo, MetricasNegocio } from "@/lib/metrics/funnel";
export type { EvaluacionCreativo, Cuadrante, ResultadoFatiga } from "@/lib/metrics/creative";
export type { MetricaCatalogo, Unidad, MejorEs, Familia } from "@/lib/metrics/catalog";
export type { ValorMetrica } from "@/lib/metrics/resolver";
export type { Hallazgo, Area, Severidad, Evidencia, ErrorRegla } from "@/lib/diagnostics/engine";
export type { ResultadoRadar, PerfilCompetidor, DensidadAngulo, EspacioVacio } from "@/lib/competitive";
export type { Oportunidad } from "@/lib/opportunities";
export type { ResultadoLente, ResultadoCriterio } from "@/lib/frameworks";
