/**
 * Oportunidades con criterio de corte y memoria. (§7.7)
 *
 * Una idea sin criterio de corte no es una idea, es una corazonada. Cada
 * oportunidad nace con hipótesis (si X → entonces Y porque Z), el dato que la
 * sustenta y una prueba con presupuesto, duración, métrica y corte explícito.
 * Lo ya probado y perdido baja de confianza y queda marcado.
 */
import type { Angulo, AnuncioCompetidor, Experimento, TipoPrueba } from "@/lib/adapters/types";
import type { ConfigCliente } from "@/config/cliente";
import type { Hallazgo } from "@/lib/diagnostics/engine";
import type { EspacioVacio } from "@/lib/competitive";
import { cop } from "@/lib/format";

export type OrigenOportunidad = "hallazgo" | "espacio_vacio" | "ganador_mercado";

export interface PruebaOportunidad {
  presupuestoCOP: number | null;
  duracionDias: number;
  metricaExito: string;
  criterioCorte: string;
}

export interface Oportunidad {
  id: string;
  origen: OrigenOportunidad;
  titulo: string;
  hipotesis: string;
  basadaEn: string[];
  prueba: PruebaOportunidad;
  /** 1-10 */
  impacto: number;
  /** 0-1 */
  confianza: number;
  /** 1-10 (más = más difícil) */
  esfuerzo: number;
  ice: number;
  yaProbada: boolean;
  aprendizajePrevio: string | null;
  servicio: string | null;
  angulo: Angulo | null;
  tipoPrueba: TipoPrueba;
  reglaId: string | null;
}

const NOMBRE_ANGULO: Record<Angulo, string> = {
  autoridad_medica: "autoridad médica",
  prueba_social: "prueba social",
  aspiracional: "aspiracional",
  objecion_seguridad: "objeción de seguridad",
  objecion_dolor: "objeción de dolor",
  objecion_tiempo: "objeción de tiempo",
  objecion_precio: "objeción de precio",
  educativo: "educativo",
  promocion: "promoción",
  urgencia: "urgencia",
  antes_despues: "antes y después",
  testimonio: "testimonio",
  detras_de_camara: "detrás de cámara",
  sin_clasificar: "sin clasificar",
};

const NIVEL_TEXTO: Record<1 | 2 | 3 | 4 | 5, string> = {
  1: "quien todavía no sabe que tiene el problema",
  2: "quien reconoce el problema pero no la solución",
  3: "quien ya busca una solución",
  4: "quien ya compara procedimientos",
  5: "quien ya decidió y compara precio",
};

function nombreServicio(id: string | null, cliente: ConfigCliente): string {
  return cliente.servicios.find((s) => s.id === id)?.nombre ?? id ?? "el servicio";
}

/** Puntaje ICE con un decimal: es lo que se muestra como prioridad, sin colas de coma flotante. */
function calcularICE(impacto: number, confianza: number, esfuerzo: number): number {
  return Math.round(((impacto * confianza) / Math.max(1, esfuerzo)) * 10) / 10;
}

function crear(p: Omit<Oportunidad, "ice" | "yaProbada" | "aprendizajePrevio">): Oportunidad {
  return { ...p, ice: calcularICE(p.impacto, p.confianza, p.esfuerzo), yaProbada: false, aprendizajePrevio: null };
}

// ---------------------------------------------------------------------------
// Plantillas por regla: qué probar cuando dispara un hallazgo
// ---------------------------------------------------------------------------

interface PlantillaRegla {
  titulo: string;
  entonces: string;
  porque: string;
  tipoPrueba: TipoPrueba;
  metricaExito: string;
  duracionDias: number;
  criterioCorte: string;
  impacto: number;
  confianza: number;
  esfuerzo: number;
  presupuestoFraccion: number | null;
}

const PLANTILLAS: Record<string, PlantillaRegla> = {
  R01: { titulo: "Rotar el creativo saturado", entonces: "la respuesta al enlace vuelve al nivel de la quincena anterior", porque: "la caída viene de repetición, no de mercado", tipoPrueba: "creativo", metricaExito: "respuesta al enlace de la pieza nueva vs la saturada", duracionDias: 7, criterioCorte: "Si a los 7 días la pieza nueva no supera en 15 % la respuesta de la saturada con la misma audiencia, se descarta la hipótesis de saturación y se revisa audiencia.", impacto: 6, confianza: 0.7, esfuerzo: 3, presupuestoFraccion: 0.2 },
  R02: { titulo: "Mover la pauta a audiencias con menos competencia", entonces: "el costo por mil baja sin que baje la respuesta", porque: "el sobrecosto es de subasta, no de creativo", tipoPrueba: "audiencia", metricaExito: "costo por mil y costo por conversación", duracionDias: 10, criterioCorte: "Si a los 10 días el costo por conversación no baja al menos 10 % frente a la audiencia actual, se mantiene la audiencia original.", impacto: 5, confianza: 0.5, esfuerzo: 3, presupuestoFraccion: 0.25 },
  R03: { titulo: "Diversificar el portafolio con dos variantes", entonces: "ninguna pieza supera el 50 % del gasto y el costo se mantiene", porque: "la dependencia de una pieza es riesgo, no eficiencia", tipoPrueba: "creativo", metricaExito: "costo por resultado de las variantes vs la principal", duracionDias: 10, criterioCorte: "Si ninguna variante llega a la mitad del rendimiento de la principal en 10 días, se producen otras dos con distinto ángulo.", impacto: 5, confianza: 0.6, esfuerzo: 4, presupuestoFraccion: 0.2 },
  R05: { titulo: "Cambiar solo los primeros 3 segundos", entonces: "el gancho sube por encima del umbral con el mismo cuerpo del video", porque: "la oferta convierte a quien la ve; el problema es que pocos llegan", tipoPrueba: "creativo", metricaExito: "gancho (reproducciones de 3 s / impresiones)", duracionDias: 7, criterioCorte: "Si el gancho no sube al menos 30 % relativo en 7 días, el problema no es el arranque: se prueba otro formato.", impacto: 6, confianza: 0.7, esfuerzo: 2, presupuestoFraccion: 0.15 },
  R06: { titulo: "Cumplir la promesa del gancho en los primeros 5 segundos", entonces: "la retención sube y el costo por video visto baja", porque: "la gente se detiene pero se va cuando el video no entrega lo que prometió", tipoPrueba: "creativo", metricaExito: "retención (hold rate) y caída 25→50", duracionDias: 7, criterioCorte: "Si la retención no mejora en 7 días con el mismo gancho, el problema es el gancho: se reescribe.", impacto: 5, confianza: 0.6, esfuerzo: 3, presupuestoFraccion: 0.15 },
  R07: { titulo: "Reemplazar la pieza fatigada por una variante fresca", entonces: "el costo por resultado vuelve al nivel de la mejor semana", porque: "la fatiga es de la pieza, no del mensaje", tipoPrueba: "creativo", metricaExito: "costo por resultado de la variante vs la fatigada", duracionDias: 7, criterioCorte: "Si en 7 días la variante no mejora el costo por resultado en 20 %, se cambia también el mensaje, no solo la apertura.", impacto: 7, confianza: 0.75, esfuerzo: 3, presupuestoFraccion: 0.3 },
  R10: { titulo: "Restringir la geografía al área metropolitana", entonces: "el costo por cita asistida baja sin perder volumen de citas", porque: "la plata fuera del radio nunca llega a una cita", tipoPrueba: "audiencia", metricaExito: "costo por cita asistida", duracionDias: 14, criterioCorte: "Si en 14 días el número de citas baja más de 10 % con el mismo gasto, se revisa si había pacientes reales fuera del radio (raro) y se ajusta el radio.", impacto: 8, confianza: 0.9, esfuerzo: 1, presupuestoFraccion: null },
  R11: { titulo: "Excluir el segmento que no produce", entonces: "el costo por resultado baja con el mismo presupuesto", porque: "ese gasto se redistribuye a quien sí convierte", tipoPrueba: "audiencia", metricaExito: "costo por conversación", duracionDias: 10, criterioCorte: "Si el costo por conversación no baja en 10 días, la exclusión no era el problema: se revierte.", impacto: 6, confianza: 0.8, esfuerzo: 1, presupuestoFraccion: null },
  R12: { titulo: "Programar la pauta al horario de atención", entonces: "la tasa de respuesta sube y el costo por cita baja", porque: "las conversaciones que nacen cuando alguien contesta cierran más", tipoPrueba: "presupuesto", metricaExito: "tasa de respuesta y costo por cita agendada", duracionDias: 14, criterioCorte: "Si el volumen de conversaciones cae más de 20 % sin mejorar el costo por cita, se vuelve a 24 h con respuesta automática.", impacto: 6, confianza: 0.6, esfuerzo: 1, presupuestoFraccion: null },
  R14: { titulo: "Ofrecer dos horarios concretos en la primera respuesta", entonces: "la tasa de agendamiento sube", porque: "preguntar “¿cuándo puedes?” traslada el trabajo al paciente y lo pierde", tipoPrueba: "proceso", metricaExito: "citas agendadas / leads calificados", duracionDias: 14, criterioCorte: "Si en 14 días la tasa de agendamiento no sube al menos 10 puntos, el cuello está en la agenda (cupos), no en el chat.", impacto: 7, confianza: 0.7, esfuerzo: 2, presupuestoFraccion: null },
  R15: { titulo: "Confirmación 24 h + recordatorio 2 h + abono para separar cupo", entonces: "la asistencia sube por encima del umbral", porque: "la inasistencia es un problema de proceso, no de pauta", tipoPrueba: "proceso", metricaExito: "asistencia a citas (show rate)", duracionDias: 21, criterioCorte: "Si a los 21 días la asistencia no sube al menos 10 puntos, se prueba agendar a menos de 72 h del contacto.", impacto: 9, confianza: 0.8, esfuerzo: 2, presupuestoFraccion: null },
  R16: { titulo: "Guion de cierre con oferta de decisión el mismo día", entonces: "el cierre en consultorio sube", porque: "la gente llegó: falta una razón para decidir hoy", tipoPrueba: "oferta", metricaExito: "ventas / citas asistidas", duracionDias: 21, criterioCorte: "Si en 21 días el cierre no sube 10 puntos, se revisa precio y estructura de paquetes con el equipo médico.", impacto: 9, confianza: 0.6, esfuerzo: 4, presupuestoFraccion: null },
  R17: { titulo: "Responsable de chat con meta de 10 minutos", entonces: "la tasa de respuesta supera el umbral y las citas suben", porque: "el que responde primero se queda con el paciente", tipoPrueba: "proceso", metricaExito: "tasa de respuesta y citas agendadas", duracionDias: 14, criterioCorte: "Si con respuesta rápida las citas no suben, el problema está en el mensaje de respuesta, no en la velocidad.", impacto: 8, confianza: 0.85, esfuerzo: 2, presupuestoFraccion: null },
  R19: { titulo: "Paquetes de sesiones para subir el ticket", entonces: "el CAC cae por debajo del margen", porque: "subir ticket vale más que bajar el costo por lead", tipoPrueba: "oferta", metricaExito: "ticket promedio y CAC sobre margen", duracionDias: 30, criterioCorte: "Si en 30 días el ticket promedio no sube 15 % o el cierre cae más de 10 puntos, se replantea el paquete.", impacto: 9, confianza: 0.6, esfuerzo: 4, presupuestoFraccion: null },
  R25: { titulo: "Enviar el clic directo al chat con mensaje preescrito", entonces: "la tasa de conversación sube", porque: "los clics existen; se pierden entre el anuncio y la conversación", tipoPrueba: "creativo", metricaExito: "conversaciones / clics de enlace", duracionDias: 7, criterioCorte: "Si en 7 días la tasa de conversación no dobla, el problema es la intención del clic: se cambia el anuncio.", impacto: 6, confianza: 0.7, esfuerzo: 1, presupuestoFraccion: null },
  R26: { titulo: "Aligerar la página o saltarla", entonces: "la fuga de aterrizaje baja por debajo del umbral", porque: "los clics se pierden antes de que cargue la página", tipoPrueba: "proceso", metricaExito: "vistas de página / clics de enlace", duracionDias: 7, criterioCorte: "Si tras optimizar la página la fuga no baja a la mitad, se elimina la página y se enlaza directo al chat.", impacto: 6, confianza: 0.7, esfuerzo: 3, presupuestoFraccion: null },
};

export function desdeHallazgos(hallazgos: ReadonlyArray<Hallazgo>, cliente: ConfigCliente, gastoQuincenal = 0): Oportunidad[] {
  const salida: Oportunidad[] = [];
  for (const h of hallazgos) {
    const p = PLANTILLAS[h.reglaId];
    if (!p) continue;
    const presupuesto = p.presupuestoFraccion === null || gastoQuincenal === 0 ? null : Math.round(gastoQuincenal * p.presupuestoFraccion);
    salida.push(
      crear({
        id: `op_${h.reglaId.toLowerCase()}`,
        origen: "hallazgo",
        titulo: p.titulo,
        hipotesis: `Si ${p.titulo.toLowerCase()}, entonces ${p.entonces}, porque ${p.porque}.`,
        basadaEn: [h.titulo, ...h.evidencia.slice(0, 3).map((e) => `${e.etiqueta}: ${e.valor}`)],
        prueba: { presupuestoCOP: presupuesto, duracionDias: p.duracionDias, metricaExito: p.metricaExito, criterioCorte: p.criterioCorte },
        impacto: h.plataEnRiesgo !== null ? Math.min(10, Math.max(p.impacto, Math.round(Math.log10(Math.max(1, h.plataEnRiesgo)) + 2))) : p.impacto,
        confianza: p.confianza,
        esfuerzo: p.esfuerzo,
        servicio: null,
        angulo: null,
        tipoPrueba: p.tipoPrueba,
        reglaId: h.reglaId,
      }),
    );
  }
  void cliente;
  return salida;
}

export function desdeEspaciosVacios(espacios: ReadonlyArray<EspacioVacio>, cliente: ConfigCliente, maximo = 6): Oportunidad[] {
  return espacios.slice(0, maximo).map((e) =>
    crear({
      id: `op_vacio_${e.servicio}_${e.angulo}_${e.nivelConsciencia}`,
      origen: "espacio_vacio",
      titulo: `${nombreServicio(e.servicio, cliente)} con ángulo ${NOMBRE_ANGULO[e.angulo]} para ${NIVEL_TEXTO[e.nivelConsciencia]}`,
      hipotesis: `Si se lanza una pieza de ${nombreServicio(e.servicio, cliente)} con ángulo ${NOMBRE_ANGULO[e.angulo]} dirigida a ${NIVEL_TEXTO[e.nivelConsciencia]}, entonces el costo por conversación será menor que el promedio de la cuenta, porque ningún competidor observado está atacando esa combinación y la subasta es más barata.`,
      basadaEn: [`Radar: 0 competidores en ${e.servicio} × ${NOMBRE_ANGULO[e.angulo]} × nivel ${e.nivelConsciencia}`],
      prueba: {
        presupuestoCOP: null,
        duracionDias: 10,
        metricaExito: "costo por conversación vs promedio de la cuenta",
        criterioCorte: "Si a los 10 días, con señal suficiente, el costo por conversación no está por debajo del promedio de la cuenta, se apaga y se registra el aprendizaje.",
      },
      impacto: 5,
      confianza: 0.4,
      esfuerzo: 3,
      servicio: e.servicio,
      angulo: e.angulo,
      tipoPrueba: "creativo",
      reglaId: null,
    }),
  );
}

export function desdeGanadoresMercado(ganadores: ReadonlyArray<AnuncioCompetidor>, cliente: ConfigCliente, maximo = 4): Oportunidad[] {
  return ganadores.slice(0, maximo).map((g) =>
    crear({
      id: `op_ganador_${g.anuncioId}`,
      origen: "ganador_mercado",
      titulo: `Replicar la estructura del anuncio de ${g.nombreAnunciante} (${g.diasCorriendo} días al aire)`,
      hipotesis: `Si se produce una pieza propia con la misma estructura (${NOMBRE_ANGULO[g.anguloDetectado]}, ${g.tipoMedia}, ${g.usaPrecio ? "con precio" : "sin precio"}, ${g.usaTestimonio ? "con testimonio" : "sin testimonio"}) para ${nombreServicio(g.servicioDetectado, cliente)}, entonces obtendrá un costo por conversación competitivo, porque el mercado ya validó esa estructura sosteniéndola ${g.diasCorriendo} días. Se copia la estructura, nunca el texto.`,
      basadaEn: [`Radar: ${g.nombreAnunciante} · ${g.diasCorriendo} días · ${g.variantesDelConcepto} variantes`],
      prueba: {
        presupuestoCOP: null,
        duracionDias: 10,
        metricaExito: "costo por conversación y gancho",
        criterioCorte: "Si a los 10 días no iguala al mejor creativo propio en costo por conversación, se descarta la estructura para este servicio.",
      },
      impacto: 6,
      confianza: 0.5,
      esfuerzo: 3,
      servicio: g.servicioDetectado,
      angulo: g.anguloDetectado,
      tipoPrueba: "creativo",
      reglaId: null,
    }),
  );
}

export function priorizarICE(oportunidades: ReadonlyArray<Oportunidad>): Oportunidad[] {
  return [...oportunidades]
    .map((o) => ({ ...o, ice: calcularICE(o.impacto, o.confianza, o.esfuerzo) }))
    .sort((a, b) => b.ice - a.ice);
}

/** Equivalencia: mismo servicio, ángulo y tipo de prueba (o misma regla de origen). */
function equivalente(o: Oportunidad, e: Experimento): boolean {
  if (o.reglaId && e.origenOportunidadId === o.id) return true;
  if (o.tipoPrueba !== e.tipoPrueba) return false;
  if (o.servicio !== null && e.servicio !== null && o.servicio !== e.servicio) return false;
  if (o.angulo !== null && e.angulo !== null && o.angulo !== e.angulo) return false;
  if (o.servicio === null && o.angulo === null) return e.origenOportunidadId === o.id;
  return true;
}

/** La memoria que hace que el sistema mejore: lo que perdió baja de confianza y se marca. */
export function filtrarYaProbadas(oportunidades: ReadonlyArray<Oportunidad>, experimentos: ReadonlyArray<Experimento>): Oportunidad[] {
  return oportunidades.map((o) => {
    const perdidos = experimentos.filter((e) => e.resultado === "perdio" && equivalente(o, e));
    if (perdidos.length === 0) return o;
    const confianza = o.confianza * 0.4;
    return {
      ...o,
      yaProbada: true,
      confianza,
      ice: calcularICE(o.impacto, confianza, o.esfuerzo),
      aprendizajePrevio: perdidos.map((e) => `${e.inicio}: ${e.aprendizaje ?? "perdió sin aprendizaje registrado"}`).join(" · "),
    };
  });
}

export interface EntradaOportunidades {
  hallazgos: ReadonlyArray<Hallazgo>;
  espaciosVacios: ReadonlyArray<EspacioVacio>;
  ganadores: ReadonlyArray<AnuncioCompetidor>;
  experimentos: ReadonlyArray<Experimento>;
  cliente: ConfigCliente;
  gastoQuincenal?: number;
  maximo?: number;
}

export function generarOportunidades(e: EntradaOportunidades): Oportunidad[] {
  const todas = [
    ...desdeHallazgos(e.hallazgos, e.cliente, e.gastoQuincenal ?? 0),
    ...desdeEspaciosVacios(e.espaciosVacios, e.cliente),
    ...desdeGanadoresMercado(e.ganadores, e.cliente),
  ];
  const vistas = new Set<string>();
  const unicas = todas.filter((o) => (vistas.has(o.id) ? false : (vistas.add(o.id), true)));
  return priorizarICE(filtrarYaProbadas(unicas, e.experimentos)).slice(0, e.maximo ?? 12);
}

export function describirPresupuesto(o: Oportunidad): string {
  return o.prueba.presupuestoCOP === null ? "sin pauta adicional" : cop(o.prueba.presupuestoCOP);
}
