/**
 * Umbrales con su origen declarado. NINGUNO va quemado como verdad: todos
 * arrancan `calibrado: false` y se ajustan contra la historia del cliente.
 * Las reglas leen de aquí; nunca constantes sueltas.
 */

export interface Umbral {
  valor: number;
  origen: string;
  calibrado: boolean;
}

const provisional = (valor: number, origen: string): Umbral => ({
  valor,
  origen: `${origen} — provisional, calibrar con la historia del cliente`,
  calibrado: false,
});

export const benchmarks = {
  /** Frecuencia por encima de la cual se sospecha saturación. */
  frecuenciaSaturacion: provisional(3, "práctica común en cuentas de servicios locales"),
  /** Caída relativa de CTR de enlace (ventana reciente vs mejor histórica) para hablar de fatiga. */
  caidaCtrFatiga: provisional(0.25, "criterio interno"),
  /** Hook rate mínimo para considerar que el gancho funciona. */
  hookRateMinimo: provisional(0.25, "referencia de video corto en redes sociales"),
  /** Hold rate mínimo: si el gancho es alto y esto es bajo, el cuerpo no cumple. */
  holdRateMinimo: provisional(0.1, "referencia de video corto"),
  /** Show rate (citas asistidas / agendadas) por debajo del cual la inasistencia es un problema. */
  showRateMinimo: provisional(0.7, "operación de clínicas ambulatorias"),
  /** Cierre en consultorio (ventas / citas asistidas) mínimo esperado. */
  cierreConsultorioMinimo: provisional(0.4, "operación de clínicas estéticas"),
  /** Tasa de respuesta del equipo por debajo de la cual se pierde plata de pauta. */
  tasaRespuestaMinima: provisional(0.85, "criterio interno"),
  /** Mínimo de impresiones para tomar una decisión sobre un creativo. */
  minimoImpresionesSenal: provisional(2000, "criterio estadístico mínimo"),
  /** Mínimo de resultados para tomar una decisión sobre un creativo. */
  minimoResultadosSenal: provisional(10, "criterio estadístico mínimo"),
  /** Días sin creativo nuevo a partir de los cuales la cuenta no está probando. */
  diasSinRenovar: provisional(21, "cadencia de prueba recomendada"),
  /** Creativos activos mínimos para que exista prueba real. */
  creativosActivosMinimo: provisional(3, "criterio interno"),
  /** Presupuesto diario mínimo por conjunto para salir de aprendizaje, COP. */
  presupuestoDiarioMinimoCOP: provisional(40_000, "estimación para CPA local"),
  /** Concentración (HHI) de inversión a partir de la cual todo depende de un creativo. */
  hhiConcentracion: provisional(0.5, "criterio interno"),
  /** Proporción de inversión fuera del radio tolerable. */
  fueraRadioMaximo: provisional(0.1, "criterio interno"),
  /** Caída semanal del embudo (ventanas iguales) que dispara alerta. */
  caidaSemanalAlerta: provisional(0.2, "criterio interno"),
  /** Subida de CPM con CTR estable que sugiere presión de subasta. */
  subidaCpmPresion: provisional(0.2, "criterio interno"),
  /** Segmento que consume ≥ esta fracción de inversión con 0 resultados. */
  segmentoConsumoSinResultado: provisional(0.1, "criterio interno"),
  /** Fracción de inversión fuera de horario de atención tolerable. */
  fueraHorarioMaximo: provisional(0.3, "criterio interno"),
  /** CAC / margen por encima del cual se pierde plata por paciente. */
  ratioCacMargenMaximo: provisional(1, "economía unitaria: el CAC no puede superar el margen"),
  /** Fuga de aterrizaje (clics que no cargan la página) tolerable. */
  fugaAterrizajeMaxima: provisional(0.3, "criterio interno"),
  /** Anuncios de competencia a partir de estos días se consideran ganadores probados. */
  diasGanadorProbado: provisional(60, "nadie sostiene 60 días una pieza que no deja plata"),
  /** Ocupación de agenda por debajo de la cual hay cupos muertos. */
  ocupacionAgendaMinima: provisional(0.7, "criterio interno"),
  /** Coeficiente de variación del CPA a partir del cual la cuenta es volátil. */
  volatilidadCpaMaxima: provisional(0.5, "criterio interno"),
  /** Conjuntos que comparten ≥ esta fracción de audiencia (por nombre/segmento) compiten entre sí. */
  solapamientoConjuntos: provisional(0.5, "criterio interno"),
  /** Citas agendadas / leads calificados por debajo de esto: cuello de botella en agenda o cierre en chat. */
  tasaAgendamientoMinima: provisional(0.5, "operación de clínicas estéticas"),
  /** Conversaciones / clics de enlace por debajo de esto: los clics no llevan a ninguna parte. */
  tasaConversacionMinima: provisional(0.1, "criterio interno"),
  /** Índice de fatiga a partir del cual se declara fatiga real. */
  indiceFatigaAlerta: provisional(0.4, "criterio interno"),
  /** Cobertura mínima de datos de agenda/ventas para hablar de retorno real. */
  coberturaVentasMinima: provisional(0.5, "criterio interno"),
} as const satisfies Record<string, Umbral>;

export type Benchmarks = typeof benchmarks;
