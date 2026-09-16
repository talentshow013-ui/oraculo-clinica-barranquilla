/**
 * Catálogo de métricas — 145 declaradas en 12 familias. (§7.4)
 *
 * Cada una dice qué decisión cambia. Si no cambia ninguna, no existe.
 * Ningún benchmark quemado: los umbrales viven en config/benchmarks.ts.
 */

export const FAMILIAS = [
  "entrega",
  "costo",
  "interaccion",
  "video",
  "mensajeria",
  "conversion",
  "negocio",
  "creativo",
  "audiencia",
  "competencia",
  "salud_cuenta",
  "operacion",
] as const;
export type Familia = (typeof FAMILIAS)[number];

export type Unidad = "cop" | "numero" | "porcentaje" | "ratio" | "segundos" | "dias" | "indice" | "texto";
export type MejorEs = "mayor" | "menor" | "rango" | "informativo";

export interface MetricaCatalogo {
  id: string;
  nombre: string;
  familia: Familia;
  unidad: Unidad;
  /** Legible, va en el tooltip. */
  formula: string;
  /** Qué decisión cambia. */
  porQueImporta: string;
  mejorEs: MejorEs;
  /** true si se calcula a partir de otras; false si viene cruda de la fuente. */
  derivada: boolean;
  fuentes: ReadonlyArray<"meta" | "tiktok" | "radar" | "clinica" | "motor">;
  /** Va al Centro de Mando. */
  maestra?: true;
}

type Def = [
  id: string,
  nombre: string,
  unidad: Unidad,
  formula: string,
  porQueImporta: string,
  mejorEs: MejorEs,
  derivada: boolean,
  fuentes: MetricaCatalogo["fuentes"],
  maestra?: true,
];

/**
 * Las cifras que mandan en el Centro de mando, en el orden en que se muestran: primero lo que se
 * paga y lo que se consigue, después la calidad del anuncio, al final el negocio. Las que no tienen
 * dato (la clínica aún no anota resultados) no se pintan: aparecen solas cuando llegan los datos.
 * La plata en riesgo no va aquí: ya es la cifra grande del centro de mando y de la cabecera.
 */
export const ORDEN_MAESTRAS = [
  "inversion",
  "conversaciones_iniciadas",
  "costo_conversacion",
  "cpc_enlace",
  "cpa",
  "cac",
  "costo_cita_asistida",
  "alcance",
  "ctr_enlace",
  "cpm",
  "frecuencia",
  "hook_rate",
  "hold_rate",
  "tasa_respuesta_equipo",
  "show_rate",
  "cierre_consultorio",
  "fuga_pesos",
  "roas_real",
  "poas",
] as const;
const MAESTRAS = new Set<string>(ORDEN_MAESTRAS);

function familia(f: Familia, defs: Def[]): MetricaCatalogo[] {
  return defs.map(([id, nombre, unidad, formula, porQueImporta, mejorEs, derivada, fuentes, _maestra]) => ({
    id,
    nombre,
    familia: f,
    unidad,
    formula,
    porQueImporta,
    mejorEs,
    derivada,
    fuentes,
    ...(MAESTRAS.has(id) ? { maestra: true as const } : {}),
  }));
}

const M = ["meta"] as const;
const MT = ["meta", "tiktok"] as const;
const C = ["clinica"] as const;
const MC = ["meta", "clinica"] as const;
const R = ["radar"] as const;
const MO = ["motor"] as const;

// ---------------------------------------------------------------------------
// ENTREGA — 13
// ---------------------------------------------------------------------------
const entrega = familia("entrega", [
  ["inversion", "Inversión", "cop", "Σ gasto", "Es el denominador de todo. Si no se sabe cuánto se gastó, ningún costo unitario tiene sentido.", "informativo", false, MT, true],
  ["impresiones", "Impresiones", "numero", "Σ impresiones", "Volumen de exposición. Sin impresiones suficientes no hay señal estadística para ninguna decisión.", "informativo", false, MT],
  ["alcance", "Personas alcanzadas", "numero", "Σ alcance (dedup por la fuente; — si no se entrega)", "Cuántas personas distintas vieron algo. Si el alcance se estanca mientras las impresiones suben, se está repitiendo a los mismos.", "mayor", false, MT],
  ["frecuencia", "Frecuencia", "ratio", "impresiones / alcance", "Cuántas veces vio el anuncio la misma persona. Por encima del umbral, cada impresión adicional vale menos y se debe rotar creativo o ampliar audiencia.", "rango", true, MT, true],
  ["penetracion_mercado", "Penetración del radio", "porcentaje", "alcance / población objetivo del área metropolitana", "Indica cuánto del mercado real ya se tocó. Si es alta, crecer exige nuevos ángulos, no más presupuesto.", "informativo", true, MO],
  ["ritmo_entrega", "Ritmo de entrega", "porcentaje", "gasto real / presupuesto planificado del periodo", "Si la pauta no gasta lo planeado, hay un problema de puja, audiencia o rechazo, no de creativo.", "rango", true, M],
  ["hhi_inversion", "Concentración de inversión", "indice", "Σ (cuota de gasto por creativo)²", "Si todo el gasto está en un creativo, la cuenta depende de una sola pieza que va a fatigar. Obliga a diversificar antes de que caiga.", "menor", true, MO],
  ["top1_inversion", "Cuota del creativo principal", "porcentaje", "gasto del creativo mayor / gasto total", "Versión legible de la concentración: cuánto pesa la pieza que más gasta.", "menor", true, MO],
  ["subastas_ganadas", "Subastas ganadas", "numero", "Σ subastas ganadas", "Sirve para ver si la pauta compite o si pierde subastas por puja o calidad.", "informativo", false, M],
  ["puja_promedio", "Puja promedio", "cop", "Σ (puja × impresiones) / Σ impresiones", "Si la puja sube sin que suba el resultado, el mercado se encareció y toca decidir si vale la pena competir.", "menor", true, M],
  ["entidades_activas", "Anuncios activos", "numero", "conteo de anuncios con gasto en el periodo", "Cuántas piezas están compitiendo. Menos de tres no es una prueba, es una apuesta.", "rango", true, MT],
  ["dias_con_datos", "Días con datos", "dias", "conteo de fechas con al menos una fila", "Cuántos días del periodo tienen información. Menos días que el rango significa huecos.", "informativo", true, MO],
  ["gasto_diario_promedio", "Gasto diario", "cop", "Σ gasto / días con datos", "Indica si el presupuesto diario alcanza para salir de la fase de aprendizaje.", "informativo", true, MT],
]);

// ---------------------------------------------------------------------------
// COSTO — 16
// ---------------------------------------------------------------------------
const costo = familia("costo", [
  ["cpm", "Costo por mil impresiones", "cop", "gasto / impresiones × 1000", "Precio de la atención. Si sube con CTR estable, es presión de subasta; si sube con CTR bajando, es el creativo.", "menor", true, MT],
  ["cpc", "Costo por clic", "cop", "gasto / clics", "Cuánto cuesta cada clic de cualquier tipo. Útil solo comparado con el costo por clic de enlace.", "menor", true, MT],
  ["cpc_enlace", "Costo por clic de enlace", "cop", "gasto / clics de enlace", "Cuánto cuesta un clic con intención real. Es el costo que alimenta el embudo.", "menor", true, MT, true],
  ["cpa", "Costo por resultado", "cop", "gasto / resultados", "El costo de lo que la campaña declara como resultado. Se compara con el costo por cita asistida para ver si la plataforma cuenta lo mismo que la clínica.", "menor", true, MT],
  ["costo_conversacion", "Costo por conversación", "cop", "gasto / conversaciones iniciadas", "Cuánto cuesta que alguien escriba. Si sube, el anuncio ya no genera intención.", "menor", true, M],
  ["costo_lead_calificado", "Costo por lead calificado", "cop", "gasto / leads calificados", "Separa curiosos de pacientes potenciales. Decide si el problema es el anuncio o la calificación.", "menor", true, MC],
  ["costo_cita_agendada", "Costo por cita agendada", "cop", "gasto / citas agendadas", "Lo que cuesta llenar un cupo en la agenda. Si sube, revisar el cierre en chat.", "menor", true, MC],
  ["costo_cita_asistida", "Costo por cita asistida", "cop", "gasto / citas asistidas", "El costo real de tener a alguien sentado frente al médico. Es la métrica de costo que más importa antes de la venta.", "menor", true, MC, true],
  ["cac", "Costo de adquisición (CAC)", "cop", "gasto / ventas", "Lo que cuesta un paciente nuevo que compró. Se compara contra el margen para saber si la pauta gana o pierde plata.", "menor", true, MC, true],
  ["cac_servicio", "CAC por servicio", "cop", "gasto atribuido al servicio / ventas del servicio", "Un servicio puede subsidiar a otro. Decide dónde concentrar y dónde parar.", "menor", true, MC],
  ["costo_mil_alcance", "Costo por mil personas", "cop", "gasto / alcance × 1000", "Precio de llegar a gente nueva, no de repetir. Si diverge del CPM, la frecuencia está subiendo.", "menor", true, MT],
  ["costo_vista_landing", "Costo por vista de página", "cop", "gasto / vistas de página", "Si es mucho mayor que el costo por clic, la página no carga o el clic era accidental.", "menor", true, M],
  ["costo_interaccion", "Costo por interacción", "cop", "gasto / interacciones", "Sirve para contenido de consciencia; no sirve para decidir venta.", "menor", true, MT],
  ["costo_3s", "Costo por gancho", "cop", "gasto / reproducciones de 3 s", "Cuánto cuesta que alguien se detenga. Si es alto, el primer segundo del video no funciona.", "menor", true, MT],
  ["costo_thruplay", "Costo por video visto", "cop", "gasto / reproducciones completas", "Cuánto cuesta que alguien vea el mensaje entero. Es el costo real de comunicar la oferta.", "menor", true, MT],
  ["costo_segundo_visto", "Costo por segundo visto", "cop", "gasto / tiempo total de reproducción", "Normaliza videos de distinta duración para comparar cuál compra atención más barata.", "menor", true, MT],
]);

// ---------------------------------------------------------------------------
// INTERACCIÓN — 11
// ---------------------------------------------------------------------------
const interaccion = familia("interaccion", [
  ["ctr", "Tasa de clics", "porcentaje", "clics / impresiones", "Cuánta gente reacciona al anuncio. Sola engaña: incluye clics en el perfil o en el texto.", "mayor", true, MT],
  ["ctr_enlace", "Tasa de clics de enlace", "porcentaje", "clics de enlace / impresiones", "Intención real de ir a hablar o a la página. Es el CTR que se usa para fatiga.", "mayor", true, MT, true],
  ["ctr_unico", "Tasa de clics única", "porcentaje", "clics únicos / alcance", "Cuántas personas distintas hicieron clic. Corrige el efecto de que una persona haga clic varias veces.", "mayor", true, MT],
  ["calidad_clic", "Calidad del clic", "porcentaje", "clics de enlace / clics totales", "Qué parte de los clics tenía intención. Si es baja, el anuncio genera curiosidad, no interés.", "mayor", true, MT],
  ["tasa_interaccion", "Tasa de interacción", "porcentaje", "interacciones / impresiones", "Termómetro de contenido. Alta interacción sin clics de enlace es entretenimiento, no venta.", "mayor", true, MT],
  ["tasa_guardado", "Tasa de guardado", "porcentaje", "guardados / impresiones", "Guardar es intención futura: la persona quiere volver. Predice mejor que el like.", "mayor", true, MT],
  ["tasa_compartido", "Tasa de compartido", "porcentaje", "compartidos / impresiones", "Alguien pensó en otra persona. Sirve para elegir qué contenido amplificar con pauta.", "mayor", true, MT],
  ["tasa_comentario", "Tasa de comentarios", "porcentaje", "comentarios / impresiones", "Los comentarios son preguntas y objeciones gratis. Alimentan la biblioteca de mensajes.", "mayor", true, MT],
  ["ratio_guardado_like", "Guardados por reacción", "ratio", "guardados / reacciones", "Mide intención sobre aprobación. Un contenido con muchos likes y pocos guardados agrada pero no mueve.", "mayor", true, MT],
  ["tasa_visita_perfil", "Tasa de visita al perfil", "porcentaje", "visitas al perfil / impresiones", "La gente quiere saber quién está detrás. Si es alta y el perfil no convierte, el problema está en el perfil.", "mayor", true, MT],
  ["fuga_aterrizaje", "Fuga de aterrizaje", "porcentaje", "1 − vistas de página / clics de enlace", "Clics que nunca llegaron a la página: plata perdida entre el anuncio y el destino. Si es alta, la página tarda o el enlace falla.", "menor", true, M],
]);

// ---------------------------------------------------------------------------
// VIDEO — 14
// ---------------------------------------------------------------------------
const video = familia("video", [
  ["hook_rate", "Gancho (hook rate)", "porcentaje", "reproducciones de 3 s / impresiones (2 s si la fuente no da 3 s; 25 % visto si no da ninguna)", "Cuánta gente se detiene en los primeros segundos. Decide si el problema es el arranque del video o lo que viene después.", "mayor", true, MT, true],
  ["hold_rate", "Retención (hold rate)", "porcentaje", "reproducciones completas / impresiones (6 s si no hay completas)", "Cuánta gente aguanta el mensaje. Gancho alto con retención baja: el video promete lo que no cumple.", "mayor", true, MT, true],
  ["tasa_finalizacion", "Tasa de finalización", "porcentaje", "vistas al 100 % / reproducciones", "Cuántos llegan al final donde suele estar la llamada a la acción.", "mayor", true, MT],
  ["retencion_25", "Retención al 25 %", "porcentaje", "vistas al 25 % / reproducciones", "Primer corte de atención. Indica si el gancho sostiene más allá de los 3 segundos.", "mayor", true, MT],
  ["retencion_50", "Retención al 50 %", "porcentaje", "vistas al 50 % / reproducciones", "Mitad del mensaje. Aquí suele estar la oferta.", "mayor", true, MT],
  ["retencion_75", "Retención al 75 %", "porcentaje", "vistas al 75 % / reproducciones", "Antes de la llamada a la acción. Si cae aquí, la llamada no se ve.", "mayor", true, MT],
  ["caida_25_50", "Caída 25 → 50", "porcentaje", "1 − vistas al 50 % / vistas al 25 %", "Dónde se pierde la gente. Una caída fuerte aquí señala el punto exacto del guion a cambiar.", "menor", true, MT],
  ["caida_50_75", "Caída 50 → 75", "porcentaje", "1 − vistas al 75 % / vistas al 50 %", "Si la gente se va en la segunda mitad, la oferta no engancha o el video es largo.", "menor", true, MT],
  ["tiempo_promedio", "Tiempo promedio visto", "segundos", "tiempo total de reproducción / reproducciones", "Segundos reales de atención. Se compara con la duración para saber si el video es demasiado largo.", "mayor", true, MT],
  ["pct_duracion_vista", "% de duración vista", "porcentaje", "tiempo promedio visto / duración del creativo", "Normaliza videos de distinta longitud. Bajo: recortar; alto: se puede alargar el mensaje.", "mayor", true, MT],
  ["eficiencia_segundo", "Segundos por peso", "ratio", "tiempo total de reproducción / gasto", "Cuánta atención compra cada peso. Compara creativos entre sí sin que la duración engañe.", "mayor", true, MT],
  ["ctr_post_hold", "CTR de audiencia retenida", "porcentaje", "clics de enlace / reproducciones completas", "De los que vieron todo, cuántos actuaron. Si es bajo, la llamada a la acción es débil aunque el video guste.", "mayor", true, MT],
  ["reproducciones", "Reproducciones", "numero", "Σ reproducciones", "Volumen bruto de video. Sirve de denominador; solo no decide nada.", "informativo", false, MT],
  ["duracion_creativo", "Duración del video", "segundos", "duración declarada del creativo", "Contexto para leer la retención. Un 40 % en un video de 15 s no es lo mismo que en uno de 60 s.", "informativo", false, MT],
]);

// ---------------------------------------------------------------------------
// MENSAJERÍA — 7
// ---------------------------------------------------------------------------
const mensajeria = familia("mensajeria", [
  ["conversaciones_iniciadas", "Conversaciones iniciadas", "numero", "Σ conversaciones iniciadas", "Es el lead real de una clínica: alguien escribió. Todo lo anterior es exposición.", "mayor", false, M, true],
  ["tasa_conversacion", "Tasa de conversación", "porcentaje", "conversaciones iniciadas / clics de enlace", "Cuántos clics se convierten en alguien escribiendo. Si es baja, el mensaje de bienvenida o el botón fallan.", "mayor", true, M],
  ["tasa_respuesta_equipo", "Tasa de respuesta del equipo", "porcentaje", "conversaciones respondidas / conversaciones iniciadas", "Cada conversación sin responder es pauta pagada y tirada. Es un problema de operación, no de campaña.", "mayor", true, M, true],
  ["tiempo_primera_respuesta", "Tiempo de primera respuesta", "segundos", "mediana del tiempo hasta la primera respuesta (— si la fuente no lo entrega)", "El que responde primero se queda con el paciente. Diez minutos sin contestar es plata en la basura.", "menor", false, C],
  ["conversaciones_fuera_horario", "Conversaciones fuera de horario", "porcentaje", "conversaciones iniciadas fuera del horario de atención / total", "Si mucha gente escribe cuando nadie contesta, se necesita respuesta automática o cambiar la programación de la pauta.", "menor", true, MO],
  ["costo_conversacion_respondida", "Costo por conversación atendida", "cop", "gasto / conversaciones respondidas", "El costo real de un lead que alguien atendió. Es el que debe compararse con el costo por cita.", "menor", true, M],
  ["conversaciones_por_dia", "Conversaciones por día", "numero", "conversaciones iniciadas / días con datos", "Carga de trabajo del equipo. Si supera lo que se puede atender, más pauta empeora la tasa de respuesta.", "informativo", true, MO],
]);

// ---------------------------------------------------------------------------
// CONVERSIÓN — 15
// ---------------------------------------------------------------------------
const conversion = familia("conversion", [
  ["paso_impresion", "Paso 1 · Impresiones", "numero", "cantidad del paso impresión", "Arranque del embudo: define el volumen de todo lo que sigue y el denominador de las tasas.", "informativo", false, MC],
  ["paso_clic", "Paso 2 · Clics", "numero", "cantidad del paso clic", "Primer acto de intención: separa a quien vio de quien hizo algo. Es la base del costo por clic.", "informativo", false, MC],
  ["paso_conversacion", "Paso 3 · Conversaciones", "numero", "cantidad del paso conversación", "El lead real de la clínica: alguien escribió. Aquí empieza la operación del equipo, no de la pauta.", "informativo", false, MC],
  ["paso_lead_calificado", "Paso 4 · Leads calificados", "numero", "cantidad del paso lead calificado", "Separa curiosos de pacientes potenciales. Si cae, la pauta atrae a quien no puede o no quiere comprar.", "informativo", false, C],
  ["paso_cita_agendada", "Paso 5 · Citas agendadas", "numero", "cantidad del paso cita agendada", "Cupos comprometidos en la agenda. Mide la capacidad de cierre en chat y la disponibilidad de la clínica.", "informativo", false, C],
  ["paso_cita_asistida", "Paso 6 · Citas asistidas", "numero", "cantidad del paso cita asistida", "Personas que llegaron. Aquí empieza la venta.", "informativo", false, C, true],
  ["paso_venta", "Paso 7 · Ventas", "numero", "cantidad del paso venta", "Procedimientos vendidos. Lo que paga la nómina.", "informativo", false, C, true],
  ["paso_recompra", "Paso 8 · Recompras", "numero", "cantidad del paso recompra", "Pacientes que volvieron. Es el crecimiento más barato que existe.", "informativo", false, C],
  ["show_rate", "Asistencia a citas (show rate)", "porcentaje", "citas asistidas / citas agendadas", "La fuga más cara y más ignorada. Una cita que no llega ya consumió toda la inversión y dejó un cupo muerto. Es proceso, no pauta.", "mayor", true, C, true],
  ["cierre_consultorio", "Cierre en consultorio", "porcentaje", "ventas / citas asistidas", "Si la gente llega y no compra, el problema está en la consulta, el precio o la propuesta, no en la publicidad.", "mayor", true, C, true],
  ["tasa_calificacion", "Tasa de calificación", "porcentaje", "leads calificados / conversaciones", "Cuántos de los que escriben son pacientes reales. Baja: la pauta atrae a quien no puede comprar.", "mayor", true, C],
  ["tasa_agendamiento", "Tasa de agendamiento", "porcentaje", "citas agendadas / leads calificados", "Cuántos calificados terminan con cita. Baja: el cierre en chat falla o la agenda no tiene cupos.", "mayor", true, C],
  ["fuga_pesos", "Fuga en pesos", "cop", "Σ perdidos × (costo del paso anterior antes de cita asistida; margen unitario desde cita asistida)", "Convierte cada porcentaje en plata. Un 10 % de fuga en el paso 6 puede valer 40 veces más que un 40 % en el paso 2. El panel ordena por esto.", "menor", true, MO, true],
  ["indice_discrepancia", "Discrepancia plataforma vs clínica", "porcentaje", "|resultados declarados por la plataforma − conversaciones registradas por la clínica| / registradas", "Si la plataforma cuenta el doble que la clínica, el retorno que muestra es humo. Define en qué números confiar.", "menor", true, MC],
  ["cobertura_datos_venta", "Cobertura de datos de venta", "porcentaje", "días con registros de agenda y ventas / días del periodo", "Sin datos de venta, el retorno que se ve es el que declara la plataforma, no el de la caja. Indica cuánto se puede confiar.", "mayor", true, C],
]);

// ---------------------------------------------------------------------------
// NEGOCIO — 17
// ---------------------------------------------------------------------------
const negocio = familia("negocio", [
  ["ingresos_caja", "Ingresos de caja", "cop", "Σ valor de ventas + recompras registradas por la clínica", "Lo único que paga la nómina. Todo retorno se mide contra esto, no contra lo que declara la plataforma.", "mayor", false, C],
  ["roas_plataforma", "Retorno declarado por la plataforma", "ratio", "valor de conversión declarado / gasto", "Lo que dice la plataforma. Se muestra para compararlo con el retorno real, no para decidir.", "informativo", true, MT],
  ["roas_real", "Retorno real (ROAS)", "ratio", "ingresos de caja / gasto", "Cuántos pesos entran por cada peso invertido, según la caja. Sin margen, todavía puede ser pérdida.", "mayor", true, MC, true],
  ["poas", "Retorno sobre margen (POAS)", "ratio", "retorno real × margen", "Un retorno de 4x con 20 % de margen es 0,8: pérdida. Es la cifra que decide si la pauta gana plata.", "mayor", true, MC, true],
  ["margen_unitario", "Margen por procedimiento", "cop", "ticket − costo directo (por servicio, desde la configuración)", "Sin margen real el CAC no significa nada. Si está en cero, media pantalla no puede calcularse y lo dice.", "informativo", false, C],
  ["ticket_promedio", "Ticket promedio", "cop", "ingresos de ventas / ventas", "Cambia el valor de cada paso del embudo. Subir ticket suele valer más que bajar el costo por lead.", "mayor", true, C],
  ["cac_margen", "CAC sobre margen", "ratio", "CAC / margen unitario", "Por encima de 1 cada paciente nuevo cuesta más de lo que deja. Es la alarma de economía unitaria.", "menor", true, MC],
  ["ltv", "Valor de vida del paciente", "cop", "margen × visitas esperadas en el horizonte (según recurrencia del servicio)", "Justifica pagar más por un paciente de un servicio recurrente. Cambia cuánto se puede invertir.", "mayor", true, C],
  ["ltv_cac", "Valor de vida sobre CAC", "ratio", "valor de vida / CAC", "Cuántas veces se recupera lo invertido a lo largo de la relación. Decide cuánto se puede escalar.", "mayor", true, MC],
  ["tasa_recompra", "Tasa de recompra", "porcentaje", "ingresos de recompra / ingresos totales", "Cuánto del ingreso viene de pacientes que ya existían. Es crecimiento sin pauta.", "mayor", true, C],
  ["ocupacion_agenda", "Ocupación de agenda", "porcentaje", "citas asistidas / cupos disponibles", "Cupos vacíos son costo fijo sin ingreso. Si hay cupos, la pauta puede subir; si no, subir pauta solo crea espera.", "rango", true, C],
  ["costo_cupo_vacio", "Costo del cupo vacío", "cop", "cupos no usados × margen promedio", "Valoriza la agenda vacía en pesos. Suele ser mayor que lo que se gasta en pauta.", "menor", true, MO],
  ["elasticidad_inversion", "Elasticidad de la inversión", "ratio", "Δ% citas asistidas / Δ% gasto (ventanas iguales)", "Si subir gasto no sube citas en la misma proporción, la cuenta está en rendimientos decrecientes y no toca subir presupuesto.", "mayor", true, MO],
  ["ingresos_por_servicio", "Ingresos por servicio", "cop", "Σ valor de ventas por servicio", "Muestra qué servicio sostiene la clínica y cuál se vende a pérdida.", "informativo", true, C],
  ["margen_bruto_pauta", "Ganancia neta de la pauta", "cop", "ingresos de caja × margen − gasto", "La cifra final: cuánta plata dejó la publicidad después de pagar procedimientos y pauta.", "mayor", true, MC],
  ["punto_equilibrio_cac", "CAC máximo permitido", "cop", "margen unitario × margen objetivo", "Hasta cuánto se puede pagar por un paciente sin perder plata. Es el techo para escalar.", "informativo", true, MO],
  ["payback_meses", "Meses para recuperar la inversión", "numero", "CAC / (margen mensual esperado por paciente)", "Cuánto tarda un paciente en pagar lo que costó traerlo. Define cuánta caja se necesita para crecer.", "menor", true, MO],
]);

// ---------------------------------------------------------------------------
// CREATIVO — 15 (12 del diseño + 3 rankings de Meta)
// ---------------------------------------------------------------------------
const creativo = familia("creativo", [
  ["indice_fatiga", "Índice de fatiga", "indice", "caída del CTR de enlace (ventana reciente vs mejor ventana) × (1 + alza de frecuencia)", "Dice cuándo un creativo se agotó de verdad y no por ruido. Decide cuándo rotar antes de que el costo lo delate.", "menor", true, MO],
  ["vida_util", "Vida útil del creativo", "dias", "días hasta que el CTR cae por debajo del umbral respecto a su mejor semana", "Cuánto dura una pieza. Define el ritmo de producción necesario para no quedarse sin creativos frescos.", "mayor", true, MO],
  ["ritmo_renovacion", "Ritmo de renovación", "numero", "creativos nuevos con gasto / semanas del periodo", "Si no entran piezas nuevas, no se prueba nada. El que prueba más rápido gana.", "mayor", true, MO],
  ["creativos_activos", "Creativos activos", "numero", "conteo de creativos con gasto en el periodo", "Menos de tres no es prueba. Sin volumen de prueba no hay aprendizaje.", "rango", true, MT],
  ["diversidad_angulos", "Diversidad de ángulos", "numero", "ángulos distintos entre creativos activos", "Si todos los anuncios dicen lo mismo, se habla a una sola parte del mercado.", "mayor", true, MO],
  ["cobertura_consciencia", "Cobertura de consciencia", "numero", "niveles de consciencia (1-5) cubiertos por creativos activos", "Si solo se habla al que ya decidió, se compite por el segmento más caro y pequeño.", "mayor", true, MO],
  ["riesgo_politica", "Riesgo de política de salud", "numero", "creativos con señales de antes/después, promesas absolutas o referencias al cuerpo", "Un rechazo reinicia el aprendizaje de la campaña. Se detecta antes de publicar.", "menor", true, MO],
  ["cuadrante_decision", "Cuadrante de decisión", "texto", "gancho × costo por resultado vs referencia de la cuenta", "Escalar, arreglar gancho, arreglar oferta, matar o esperar señal. Es la acción concreta por creativo.", "informativo", true, MO],
  ["creativos_sin_senal", "Creativos sin señal", "numero", "creativos por debajo del mínimo de impresiones o resultados", "No se decide sobre ellos. Matar un creativo bueno por ruido es más caro que esperar.", "informativo", true, MO],
  ["mejor_creativo_costo", "Mejor creativo por costo", "texto", "creativo con menor costo por resultado con señal suficiente", "Es la pieza a escalar y de la que se producen variantes.", "informativo", true, MO],
  ["dias_desde_ultimo_nuevo", "Días desde el último creativo nuevo", "dias", "hoy − fecha de primer gasto del creativo más reciente", "Si pasan semanas sin piezas nuevas, la cuenta va a fatigar sin reemplazo listo.", "menor", true, MO],
  ["fatiga_promedio_activos", "Fatiga promedio de activos", "indice", "índice de fatiga ponderado por gasto de creativos activos", "Salud general del portafolio creativo. Alta: toca producir ya.", "menor", true, MO],
  ["ranking_calidad", "Calidad frente a la competencia (Meta)", "texto", "tramo de calidad que Meta asigna al anuncio frente a los que compiten por el mismo público", "Es la única comparación con el mercado que entrega la plataforma. Abajo en calidad = impresiones más caras.", "informativo", true, MO],
  ["ranking_interaccion", "Interés frente a la competencia (Meta)", "texto", "tramo de tasa de interacción frente a anuncios que pelean el mismo público", "Si el mercado despierta más interés con la misma gente, el gancho no compite.", "informativo", true, MO],
  ["ranking_conversion", "Conversión frente a la competencia (Meta)", "texto", "tramo de tasa de conversión frente a anuncios que pelean el mismo público", "Si el mercado convierte más con el mismo público, la oferta o el destino no compiten.", "informativo", true, MO],
]);

// ---------------------------------------------------------------------------
// AUDIENCIA — 11
// ---------------------------------------------------------------------------
const audiencia = familia("audiencia", [
  ["cpa_edad", "Costo por resultado por edad", "cop", "gasto / resultados por rango de edad", "Muestra qué edades compran y cuáles solo consumen. Decide exclusiones.", "menor", true, MT],
  ["cpa_genero", "Costo por resultado por género", "cop", "gasto / resultados por género", "Igual que edad: decide dónde concentrar.", "menor", true, MT],
  ["cpa_zona", "Costo por resultado por zona", "cop", "gasto / resultados por municipio", "Fuera del radio el costo se dispara porque nadie viaja por un procedimiento. Decide la geografía de la pauta.", "menor", true, MT],
  ["cpa_plataforma", "Costo por resultado por plataforma", "cop", "gasto / resultados por plataforma y ubicación", "Cada ubicación tiene su precio. Decide dónde apagar.", "menor", true, MT],
  ["cpa_hora", "Costo por resultado por franja horaria", "cop", "gasto / resultados por hora del día", "Pauta que corre cuando nadie contesta produce leads fríos. Decide la programación.", "menor", true, MT],
  ["inversion_fuera_radio", "Inversión fuera del radio", "porcentaje", "gasto en zonas fuera del área metropolitana / gasto total", "Toda inversión fuera de ~40 km es pérdida directa. Es la fuga geográfica.", "menor", true, MO],
  ["inversion_fuera_horario", "Inversión fuera de horario", "porcentaje", "gasto en horas sin atención / gasto total", "Un mensaje sin contestar a los 10 minutos es plata en la basura. Decide programar la pauta o cubrir el horario.", "menor", true, MO],
  ["segmentos_sin_resultado", "Segmentos que gastan sin producir", "numero", "segmentos con ≥ umbral de gasto y 0 resultados", "Cada uno es una exclusión pendiente.", "menor", true, MO],
  ["solapamiento_conjuntos", "Solapamiento entre conjuntos", "porcentaje", "conjuntos que comparten audiencia sobre el total", "Conjuntos compitiendo entre sí suben el CPM de la propia cuenta.", "menor", true, MO],
  ["segmentos_enmascarados", "Segmentos ocultos por privacidad", "numero", "cruces con menos de 5 registros", "Se ocultan para que nadie pueda ser identificado. La UI dice cuántos.", "informativo", true, MO],
  ["concentracion_zona", "Concentración geográfica", "porcentaje", "gasto en el municipio principal / gasto total", "Si todo está en Barranquilla, hay municipios del radio sin cubrir.", "informativo", true, MO],
]);

// ---------------------------------------------------------------------------
// COMPETENCIA — 13
// ---------------------------------------------------------------------------
const competencia = familia("competencia", [
  ["puntuacion_longevidad", "Puntuación de longevidad", "indice", "f(días corriendo) × activo × variantes del concepto, saturante", "Nadie sostiene 60 días una pieza que no deja plata. Es lo único observable y honesto del competidor.", "mayor", true, R],
  ["anuncios_60_dias", "Anuncios de 60+ días", "numero", "anuncios de competencia activos con ≥ 60 días", "Ganadores probados del mercado. Se copia la estructura, nunca el copy.", "informativo", true, R],
  ["cadencia_competencia", "Cadencia de la competencia", "numero", "anuncios nuevos de competencia por semana", "Si el mercado prueba más rápido que la cuenta, el mercado aprende más rápido.", "informativo", true, R],
  ["brecha_cadencia", "Brecha de cadencia", "ratio", "cadencia propia / cadencia promedio de competencia", "Por debajo de 1 se está probando menos que el mercado.", "mayor", true, MO],
  ["entradas_competencia", "Entradas de anuncios", "numero", "anuncios de competencia nuevos en el periodo", "Qué está probando el mercado ahora.", "informativo", true, R],
  ["salidas_competencia", "Salidas de anuncios", "numero", "anuncios de competencia que dejaron de correr en el periodo", "Salidas rápidas significan que les fue mal: se aprende de su fracaso gratis.", "informativo", true, R],
  ["espacios_vacios", "Espacios vacíos", "numero", "combinaciones servicio × ángulo × consciencia sin ningún competidor", "Ahí la subasta es barata y el mensaje es nuevo. Es el entregable más valioso del radar.", "mayor", true, MO],
  ["angulos_saturados", "Ángulos saturados", "numero", "ángulos usados por más de la mitad de los competidores", "Entrar ahí es pagar más por decir lo mismo.", "informativo", true, MO],
  ["participacion_voz", "Participación de voz", "porcentaje", "anuncios propios activos / (propios + competencia activos)", "Cuánto del ruido del mercado es de la clínica. No mide plata: mide presencia.", "mayor", true, MO],
  ["competidores_activos", "Competidores activos", "numero", "competidores con al menos un anuncio activo", "Contexto del mercado: cuántos competidores están pautando ahora mismo en el radio de captación.", "informativo", true, R],
  ["uso_precio_competencia", "Competencia que muestra precio", "porcentaje", "anuncios de competencia con precio / total", "Si todos muestran precio, no mostrarlo pierde; si nadie lo muestra, es un espacio.", "informativo", true, R],
  ["uso_testimonio_competencia", "Competencia con testimonio", "porcentaje", "anuncios de competencia con testimonio / total", "Indica qué prueba social espera el mercado.", "informativo", true, R],
  ["variantes_por_concepto", "Variantes por concepto", "numero", "promedio de variantes de los anuncios de competencia", "Muchas variantes = el competidor está invirtiendo en escalar ese concepto.", "informativo", true, R],
]);

// ---------------------------------------------------------------------------
// SALUD DE CUENTA — 9
// ---------------------------------------------------------------------------
const saludCuenta = familia("salud_cuenta", [
  ["cobertura_periodo", "Cobertura del periodo", "porcentaje", "días con datos / días del rango", "Si la cobertura está incompleta, se advierte antes de mostrar conclusiones.", "mayor", true, MO],
  ["frescura_datos", "Frescura de los datos", "dias", "hoy − última fecha con datos", "Un diagnóstico de hace dos semanas ya es historia.", "menor", true, MO],
  ["huecos_datos", "Huecos en los datos", "numero", "días del rango sin filas", "Un hueco puede simular una caída que nunca ocurrió. Se muestra siempre.", "menor", true, MO],
  ["conjuntos_en_aprendizaje", "Conjuntos en aprendizaje", "numero", "conjuntos con menos resultados que el mínimo para salir de aprendizaje", "En aprendizaje el costo es inestable; no se juzga ni se escala.", "informativo", true, MO],
  ["anuncios_rechazados", "Anuncios rechazados", "numero", "anuncios en estado rechazado o en revisión", "Cada rechazo reinicia el aprendizaje. Es política de salud, no creatividad.", "menor", false, MT],
  ["volatilidad_cpa", "Volatilidad del costo por resultado", "indice", "desviación estándar / promedio del costo diario por resultado", "Alta volatilidad significa que no hay señal estable para decidir.", "menor", true, MO],
  ["senal_estadistica", "Señal estadística", "porcentaje", "creativos con señal suficiente / creativos activos", "Cuánto de la cuenta se puede juzgar con datos y cuánto es ruido.", "mayor", true, MO],
  ["puntaje_optimizacion", "Puntaje de optimización", "numero", "puntaje que entrega la plataforma (0-100; — si no se entrega)", "Contexto, no verdad: la plataforma recomienda gastar más.", "informativo", false, M],
  ["dias_sin_actualizar", "Días sin actualizar", "dias", "hoy − fecha de generación del lote", "Si el panel está viejo, las decisiones también.", "menor", true, MO],
]);

// ---------------------------------------------------------------------------
// OPERACIÓN — 7
// ---------------------------------------------------------------------------
const operacion = familia("operacion", [
  ["plata_en_riesgo", "Plata en riesgo", "cop", "Σ plata en riesgo de los hallazgos activos", "La cifra que resume el diagnóstico: cuánto se está perdiendo hoy por cosas arreglables.", "menor", true, MO, true],
  ["ahorro_capturado", "Ahorro capturado", "cop", "Σ plata en riesgo de hallazgos resueltos", "Lo que ya se dejó de perder. Justifica el trabajo.", "mayor", true, MO],
  ["experimentos_activos", "Experimentos activos", "numero", "experimentos en curso", "Sin experimentos no hay mejora. Uno o dos a la vez; más de eso es ruido.", "rango", true, C],
  ["experimentos_ganados", "Experimentos ganados", "porcentaje", "ganados / (ganados + perdidos)", "Tasa de acierto. Baja no es malo: significa que se prueba de verdad.", "informativo", true, C],
  ["tiempo_reaccion", "Tiempo de reacción", "dias", "días entre un hallazgo y su acción registrada", "Un hallazgo sin acción es un reporte. Mide si la cuenta ejecuta.", "menor", true, MO],
  ["indice_madurez", "Índice de madurez", "indice", "promedio de: cobertura de datos, calibración, experimentos, renovación creativa", "Qué tan preparada está la cuenta para escalar con criterio.", "mayor", true, MO],
  ["hallazgos_abiertos", "Hallazgos abiertos", "numero", "hallazgos activos ordenados por plata", "La lista de trabajo de la semana, ordenada por plata. Lo que no se cierra sigue costando.", "informativo", true, MO],
  ["cambios_estado_campana", "Prendidos y apagados por campaña", "numero", "cambios de estado (activa/inactiva) de una campaña en los últimos 14 días, del historial de Meta", "Cada cambio reinicia el aprendizaje: una campaña que se prende y apaga a diario nunca estabiliza su costo.", "menor", true, M],
  ["personas_operando", "Personas operando la cuenta", "numero", "personas distintas que hicieron cambios en la cuenta en los últimos 14 días, del historial de Meta", "Con varias manos en el interruptor nadie sabe qué está probando qué.", "menor", true, M],
]);

export const CATALOGO: ReadonlyArray<MetricaCatalogo> = [
  ...entrega,
  ...costo,
  ...interaccion,
  ...video,
  ...mensajeria,
  ...conversion,
  ...negocio,
  ...creativo,
  ...audiencia,
  ...competencia,
  ...saludCuenta,
  ...operacion,
];

const POR_ID = new Map(CATALOGO.map((m) => [m.id, m]));

export function metricaPorId(id: string): MetricaCatalogo | undefined {
  return POR_ID.get(id);
}

export function metricasPorFamilia(f: Familia): MetricaCatalogo[] {
  return CATALOGO.filter((m) => m.familia === f);
}

export function metricasMaestras(): MetricaCatalogo[] {
  return ORDEN_MAESTRAS.map((id) => metricaPorId(id)).filter((m): m is MetricaCatalogo => m !== undefined);
}

export const NOMBRE_FAMILIA: Record<Familia, string> = {
  entrega: "Entrega",
  costo: "Costos",
  interaccion: "Interacción",
  video: "Video",
  mensajeria: "Mensajería",
  conversion: "Conversión",
  negocio: "Negocio",
  creativo: "Creativo",
  audiencia: "Audiencia",
  competencia: "Radar de mercado",
  salud_cuenta: "Salud de la cuenta",
  operacion: "Operación",
};
