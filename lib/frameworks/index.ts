/**
 * Mesa de consultores: 7 lentes de auditoría. (§7.8)
 *
 * No simulan personas ni les ponen palabras en la boca: son marcos publicados,
 * con fuente citada, aplicados como lista de verificación sobre datos reales.
 * Cada criterio declara con qué dato del panel se responde y qué hacer si falla.
 */
import type { ConfigCliente } from "@/config/cliente";
import type { Benchmarks } from "@/config/benchmarks";
import type { Hallazgo } from "@/lib/diagnostics/engine";
import type { EvaluacionCreativo } from "@/lib/metrics/creative";
import type { MetricasNegocio } from "@/lib/metrics/funnel";
import type { ResultadoRadar } from "@/lib/competitive";

export interface EntradaLentes {
  creativos: ReadonlyArray<EvaluacionCreativo>;
  negocio: MetricasNegocio;
  radar: ResultadoRadar | null;
  hallazgos: ReadonlyArray<Hallazgo>;
  cliente: ConfigCliente;
  benchmarks: Benchmarks;
}

export interface CriterioLente {
  criterio: string;
  datoPanel: string;
  accionSiFalla: string;
  /** null = no hay dato para responder. */
  evaluar(e: EntradaLentes): boolean | null;
}

export interface Lente {
  id: string;
  nombre: string;
  fuente: string;
  paraQue: string;
  criterios: CriterioLente[];
}

export interface ResultadoCriterio {
  criterio: string;
  datoPanel: string;
  accionSiFalla: string;
  cumple: boolean | null;
}

export interface ResultadoLente {
  id: string;
  nombre: string;
  fuente: string;
  paraQue: string;
  criterios: ResultadoCriterio[];
  cumplidos: number;
  fallidos: number;
  sinDato: number;
}

const angulosActivos = (e: EntradaLentes) => new Set(e.creativos.map((c) => c.creativo.anguloDetectado));
const nivelesActivos = (e: EntradaLentes) => new Set(e.creativos.map((c) => c.creativo.nivelConsciencia));
const hay = (e: EntradaLentes) => e.creativos.length > 0;
const dispara = (e: EntradaLentes, id: string) => e.hallazgos.some((h) => h.reglaId === id);

export const LENTES: ReadonlyArray<Lente> = [
  {
    id: "valor",
    nombre: "Ecuación de valor",
    fuente: "Alex Hormozi, $100M Offers",
    paraQue: "¿La oferta sube valor (resultado soñado × probabilidad) o solo baja precio (tiempo × esfuerzo)?",
    criterios: [
      { criterio: "La oferta no depende del descuento", datoPanel: "Ángulos activos: promoción vs resto", accionSiFalla: "Construir la oferta con bonos y garantía de proceso antes que con descuento; el descuento se copia en una semana.", evaluar: (e) => (hay(e) ? !(angulosActivos(e).size === 1 && angulosActivos(e).has("promocion")) : null) },
      { criterio: "Se reduce el esfuerzo percibido (tiempo, dolor, recuperación)", datoPanel: "Ángulos de objeción de tiempo/dolor activos", accionSiFalla: "Producir al menos una pieza que responda a “¿duele?” y “¿cuánto tiempo pierdo?”.", evaluar: (e) => (hay(e) ? angulosActivos(e).has("objecion_tiempo") || angulosActivos(e).has("objecion_dolor") : null) },
      { criterio: "Se sube la probabilidad percibida de resultado", datoPanel: "Ángulos de autoridad médica, prueba social o testimonio", accionSiFalla: "Mostrar quién hace el procedimiento y cuántas veces lo ha hecho; testimonio sin imágenes comparativas.", evaluar: (e) => (hay(e) ? ["autoridad_medica", "prueba_social", "testimonio"].some((a) => angulosActivos(e).has(a as never)) : null) },
      { criterio: "El margen soporta la oferta", datoPanel: "CAC sobre margen", accionSiFalla: "Rediseñar la oferta como paquete de sesiones; una oferta que se vende a pérdida no es una oferta.", evaluar: (e) => (e.negocio.ratioCacMargen === null ? null : e.negocio.ratioCacMargen <= e.benchmarks.ratioCacMargenMaximo.valor) },
    ],
  },
  {
    id: "consciencia",
    nombre: "Niveles de consciencia",
    fuente: "Eugene Schwartz, Breakthrough Advertising",
    paraQue: "¿Le hablas solo a quien ya decidió (el segmento más caro y pequeño) o también a quien apenas reconoce el problema?",
    criterios: [
      { criterio: "Hay piezas para al menos 3 niveles de consciencia", datoPanel: "Cobertura de consciencia", accionSiFalla: "Producir una pieza educativa (nivel 2) y una de solución (nivel 3) por servicio principal.", evaluar: (e) => (hay(e) ? nivelesActivos(e).size >= 3 : null) },
      { criterio: "No todo el gasto va al nivel 5 (precio/urgencia)", datoPanel: "Ángulos activos: promoción y urgencia", accionSiFalla: "Limitar promoción/urgencia al 30 % de las piezas; el resto construye demanda.", evaluar: (e) => (hay(e) ? e.creativos.filter((c) => c.creativo.nivelConsciencia === 5).length / e.creativos.length <= 0.5 : null) },
      { criterio: "Existe contenido para quien no sabe que tiene el problema", datoPanel: "Piezas de nivel 1-2", accionSiFalla: "Una pieza que nombre el problema sin vender: “por qué aparecen las líneas de expresión”.", evaluar: (e) => (hay(e) ? nivelesActivos(e).has(1) || nivelesActivos(e).has(2) : null) },
    ],
  },
  {
    id: "influencia",
    nombre: "Principios de influencia",
    fuente: "Robert Cialdini, Influence",
    paraQue: "¿Qué palancas de persuasión (autoridad, prueba social, escasez, reciprocidad) se están dejando sobre la mesa?",
    criterios: [
      { criterio: "Autoridad visible", datoPanel: "Ángulo autoridad médica activo", accionSiFalla: "Nombre, credencial y cara del profesional en al menos una pieza.", evaluar: (e) => (hay(e) ? angulosActivos(e).has("autoridad_medica") : null) },
      { criterio: "Prueba social honesta", datoPanel: "Ángulos prueba social / testimonio activos", accionSiFalla: "Testimonio en video de paciente real con consentimiento, sin antes/después.", evaluar: (e) => (hay(e) ? angulosActivos(e).has("prueba_social") || angulosActivos(e).has("testimonio") : null) },
      { criterio: "Escasez real, no fabricada", datoPanel: "Ángulo urgencia vs ocupación de agenda", accionSiFalla: "Usar urgencia solo cuando la agenda esté realmente llena; la urgencia falsa destruye confianza.", evaluar: (e) => (hay(e) ? !(angulosActivos(e).has("urgencia") && e.negocio.showRate !== null && e.negocio.showRate < e.benchmarks.showRateMinimo.valor) : null) },
      { criterio: "Reciprocidad: se da algo antes de pedir", datoPanel: "Ángulo educativo activo", accionSiFalla: "Contenido útil sin llamada de venta: guía de cuidados, qué preguntar en una valoración.", evaluar: (e) => (hay(e) ? angulosActivos(e).has("educativo") : null) },
    ],
  },
  {
    id: "storybrand",
    nombre: "Marca como guía",
    fuente: "Donald Miller, Building a StoryBrand",
    paraQue: "¿La clínica se puso de héroe (nosotros, nuestra tecnología) en vez de guía del paciente (tu problema, tu plan)?",
    criterios: [
      { criterio: "El mensaje parte del problema del paciente", datoPanel: "Piezas de objeción y educativas vs aspiracionales de marca", accionSiFalla: "Reescribir: primera frase sobre lo que siente el paciente, no sobre la clínica.", evaluar: (e) => (hay(e) ? ["objecion_seguridad", "objecion_dolor", "objecion_tiempo", "objecion_precio", "educativo"].some((a) => angulosActivos(e).has(a as never)) : null) },
      { criterio: "Hay un plan claro de 3 pasos", datoPanel: "Tasa de conversación y agendamiento", accionSiFalla: "Anuncio y respuesta de chat con el mismo plan: escribe → valoración → procedimiento.", evaluar: (e) => (dispara(e, "R25") || dispara(e, "R14") ? false : hay(e) ? true : null) },
      { criterio: "La llamada a la acción es directa", datoPanel: "Clics que no llevan a ninguna parte (R25)", accionSiFalla: "Un solo botón, un solo verbo: “Escríbenos”.", evaluar: (e) => (hay(e) ? !dispara(e, "R25") : null) },
    ],
  },
  {
    id: "respuesta_directa",
    nombre: "Respuesta directa",
    fuente: "Ogilvy / Kennedy / Caples",
    paraQue: "Titular que promete, oferta concreta, razón para actuar hoy y mecanismo creíble.",
    criterios: [
      { criterio: "El gancho detiene", datoPanel: "Gancho (hook rate) de los videos activos", accionSiFalla: "Reescribir los primeros 3 segundos con el resultado o la pregunta, no con el logo.", evaluar: (e) => { const v = e.creativos.filter((c) => c.hookRate !== null); return v.length ? v.some((c) => (c.hookRate ?? 0) >= e.benchmarks.hookRateMinimo.valor) : null; } },
      { criterio: "Hay una oferta concreta, no “agenda tu cita”", datoPanel: "Piezas con oferta (promoción/objeción de precio) activas", accionSiFalla: "Definir una oferta de entrada con precio y qué incluye.", evaluar: (e) => (hay(e) ? angulosActivos(e).has("promocion") || angulosActivos(e).has("objecion_precio") : null) },
      { criterio: "Existe razón para actuar hoy", datoPanel: "Ángulo urgencia activo", accionSiFalla: "Cupos reales por semana o fecha de cierre de la oferta.", evaluar: (e) => (hay(e) ? angulosActivos(e).has("urgencia") : null) },
      { criterio: "El mecanismo es creíble (cómo funciona)", datoPanel: "Ángulos educativo / autoridad médica", accionSiFalla: "Una pieza que explique el procedimiento en 30 segundos.", evaluar: (e) => (hay(e) ? angulosActivos(e).has("educativo") || angulosActivos(e).has("autoridad_medica") : null) },
    ],
  },
  {
    id: "mejores",
    nombre: "Concentración en los mejores",
    fuente: "Chet Holmes, The Ultimate Sales Machine",
    paraQue: "Aliados locales y recompra: el crecimiento más barato viene de quien ya confía.",
    criterios: [
      { criterio: "La recompra pesa en los ingresos", datoPanel: "Tasa de recompra", accionSiFalla: "Programa de mantenimiento: recordatorio a los N meses según el servicio.", evaluar: (e) => (e.negocio.tasaRecompra === null ? null : e.negocio.tasaRecompra >= 0.15) },
      { criterio: "El valor de vida justifica el CAC", datoPanel: "Valor de vida sobre CAC", accionSiFalla: "Si LTV/CAC < 3, la pauta no se puede escalar: subir ticket o recurrencia primero.", evaluar: (e) => (e.negocio.ltvSobreCac === null ? null : e.negocio.ltvSobreCac >= 3) },
      { criterio: "Los pacientes que llegan sí compran", datoPanel: "Cierre en consultorio", accionSiFalla: "Guion de valoración con oferta de decisión el mismo día.", evaluar: (e) => (e.negocio.cierreEnConsultorio === null ? null : e.negocio.cierreEnConsultorio >= e.benchmarks.cierreConsultorioMinimo.valor) },
    ],
  },
  {
    id: "north_star",
    nombre: "Jerarquía de métricas",
    fuente: "North Star Metric / AARRR (Dave McClure)",
    paraQue: "¿La métrica que celebras paga nómina? Alcance y clics no; citas asistidas y ventas sí.",
    criterios: [
      { criterio: "El CAC está por debajo del margen", datoPanel: "CAC sobre margen", accionSiFalla: "Nada se escala hasta que cada paciente deje más de lo que costó.", evaluar: (e) => (e.negocio.ratioCacMargen === null ? null : e.negocio.ratioCacMargen <= e.benchmarks.ratioCacMargenMaximo.valor) },
      { criterio: "El retorno sobre margen (POAS) es mayor que 1", datoPanel: "POAS", accionSiFalla: "Un retorno declarado alto con POAS < 1 es pérdida; revisar margen y ticket.", evaluar: (e) => (e.negocio.poas === null ? null : e.negocio.poas > 1) },
      { criterio: "Se mide hasta la venta, no hasta el lead", datoPanel: "Cobertura de datos de venta (R22)", accionSiFalla: "Registrar citas asistidas y ventas cada semana; sin eso el panel mide humo.", evaluar: (e) => !dispara(e, "R22") },
      { criterio: "La asistencia está bajo control", datoPanel: "Asistencia a citas", accionSiFalla: "Confirmación 24 h + recordatorio 2 h + abono de separación.", evaluar: (e) => (e.negocio.showRate === null ? null : e.negocio.showRate >= e.benchmarks.showRateMinimo.valor) },
    ],
  },
];

export function aplicarLentes(e: EntradaLentes): ResultadoLente[] {
  return LENTES.map((l) => {
    const criterios = l.criterios.map((c) => {
      let cumple: boolean | null = null;
      try {
        cumple = c.evaluar(e);
      } catch {
        cumple = null;
      }
      return { criterio: c.criterio, datoPanel: c.datoPanel, accionSiFalla: c.accionSiFalla, cumple };
    });
    return {
      id: l.id,
      nombre: l.nombre,
      fuente: l.fuente,
      paraQue: l.paraQue,
      criterios,
      cumplidos: criterios.filter((c) => c.cumple === true).length,
      fallidos: criterios.filter((c) => c.cumple === false).length,
      sinDato: criterios.filter((c) => c.cumple === null).length,
    };
  });
}
