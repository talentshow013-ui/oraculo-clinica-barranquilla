/**
 * Barril de tipos para la interfaz. Reexporta los tipos REALES del motor y del contrato.
 * (El frontend se construyó contra tipos deducidos; este archivo los reemplaza sin tocar imports.)
 */
export type { ResultadoMotor, CuentaPublicitaria, AgregadoVista as Agregado, PuntoSerieVista, DesgloseVista, NegocioVista, PeriodoCampanas, PeriodoElegido } from "@/lib/datos";
export type { ResumenCampana, ComparacionCampanas, MetricaComparada } from "@/lib/metrics/campanas";
export type { RegistroPauta } from "@/lib/resultados";
export type { ComparacionVarias, MetricaVarias, VeredictoCampana, Veredicto, CreativoDeCampana } from "@/lib/metrics/veredicto";
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
export type { Comparativa, ColumnaPropia, MercadoMeta } from "@/lib/metrics/comparativa";
export type { RankingAnuncio, NivelRanking } from "@/lib/adapters/types";
export type { ResumenBitacora, Interruptor, ActorBitacora } from "@/lib/metrics/bitacora";
export type { CambioCuenta } from "@/lib/adapters/types";
export type { ResultadoPublicos, PublicoEvaluado, GrupoPublico, SegmentacionSugerida, CuadrantePublico } from "@/lib/audiences";
export type { EstudioReferencias, EstudioCiudad, AnuncioReferencia, SenalPublico } from "@/lib/audiences/referencias";
export type { Publico, Segmentacion, TipoPublico } from "@/lib/adapters/types";
export type { ResultadoOrganico, PublicacionEvaluada, ResumenRed, GrupoOrganico, CandidataPauta, Franja } from "@/lib/organico";
export type { PublicacionOrganica, CuentaOrganica, DiaOrganico, LoteOrganico, RedOrganico, FormatoOrganico } from "@/lib/adapters/types";
export type { ResultadoWeb, ResumenWeb, CanalWeb, FuenteWeb, PaginaResumen, CiudadResumen } from "@/lib/web";
export type { LoteWeb, SesionesWeb } from "@/lib/adapters/types";
export type { ResultadoPacientes, TotalesPacientes, FuentePacientes, SemanaPacientes } from "@/lib/pacientes";
