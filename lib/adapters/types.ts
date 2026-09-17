/**
 * CONTRATO DE DATOS — fuente única de verdad.
 *
 * Toda fuente (seed, archivo, conector) se mapea A este contrato; el contrato
 * nunca se modifica para acomodar una fuente. Ver PROMPT_ORACULO_v2 §6.
 *
 * Reglas:
 *  - `null` significa "la fuente no entregó el dato". Nunca se convierte en 0.
 *  - Fechas en YYYY-MM-DD, hora local de Bogotá.
 *  - Los esquemas agregados (embudo, desgloses) son estrictos: un campo extra
 *    rompe la carga. Es la barrera contra datos identificables de pacientes.
 */
import { z } from "zod";

// ---------------------------------------------------------------------------
// Enumeraciones
// ---------------------------------------------------------------------------

export const FUENTES = ["meta", "tiktok", "radar", "clinica"] as const;
export const NIVELES = ["cuenta", "campana", "conjunto", "anuncio"] as const;
export const ESTADOS = ["activo", "pausado", "archivado", "en_revision", "rechazado"] as const;

export const PASOS = [
  "impresion",
  "clic",
  "conversacion",
  "lead_calificado",
  "cita_agendada",
  "cita_asistida",
  "venta",
  "recompra",
] as const;

export const DIMENSIONES = [
  "edad",
  "genero",
  "edad_genero",
  "ubicacion",
  "pais",
  "plataforma",
  "ubicacion_anuncio",
  "dispositivo",
  "hora",
  "dia_semana",
] as const;

export const FORMATOS = ["imagen", "video", "carrusel", "coleccion"] as const;
export const TIPOS_MEDIA = ["imagen", "video", "carrusel", "desconocido"] as const;

export const ANGULOS = [
  "autoridad_medica",
  "prueba_social",
  "aspiracional",
  "objecion_seguridad",
  "objecion_dolor",
  "objecion_tiempo",
  "objecion_precio",
  "educativo",
  "promocion",
  "urgencia",
  "antes_despues",
  "testimonio",
  "detras_de_camara",
  "sin_clasificar",
] as const;

export const FUENTES_ATRIBUIDAS = [
  "meta",
  "tiktok",
  "organico",
  "referido",
  "directo",
  "desconocido",
] as const;

export const TIPOS_PRUEBA = ["creativo", "audiencia", "oferta", "proceso", "presupuesto"] as const;
export const RESULTADOS_EXPERIMENTO = ["gano", "perdio", "sin_senal", "en_curso"] as const;
export const ORIGENES_LOTE = ["seed", "archivo"] as const;

export type Fuente = (typeof FUENTES)[number];
export type Nivel = (typeof NIVELES)[number];
export type Estado = (typeof ESTADOS)[number];
export type Paso = (typeof PASOS)[number];
export type Dimension = (typeof DIMENSIONES)[number];
export type Formato = (typeof FORMATOS)[number];
export type Angulo = (typeof ANGULOS)[number];
export type FuenteAtribuida = (typeof FUENTES_ATRIBUIDAS)[number];
export type TipoPrueba = (typeof TIPOS_PRUEBA)[number];
export type ResultadoExperimento = (typeof RESULTADOS_EXPERIMENTO)[number];

// ---------------------------------------------------------------------------
// Primitivas
// ---------------------------------------------------------------------------

/** YYYY-MM-DD, hora local Bogotá. */
export const FechaSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "fecha YYYY-MM-DD");

const noNegativo = z.number().min(0);
const noNegativoNullable = z.number().min(0).nullable();
const numeroNullable = z.number().nullable();
const textoNullable = z.string().nullable();

// ---------------------------------------------------------------------------
// InsightRow — una entidad × un día
// ---------------------------------------------------------------------------

export const InsightRowSchema = z.object({
  // Identidad
  fuente: z.enum(FUENTES),
  fecha: FechaSchema,
  nivel: z.enum(NIVELES),
  id: z.string().min(1),
  nombre: z.string(),
  padreId: textoNullable,
  cuentaId: z.string().min(1),
  objetivo: textoNullable,
  estado: z.enum(ESTADOS),

  // Entrega — gasto e impresiones obligatorios
  gasto: noNegativo,
  impresiones: noNegativo,
  alcance: noNegativoNullable,
  frecuencia: noNegativoNullable,
  subastasGanadas: noNegativoNullable,
  pujaPromedio: noNegativoNullable,

  // Interacción — clics y clicsEnlace obligatorios
  clics: noNegativo,
  clicsEnlace: noNegativo,
  clicsUnicos: noNegativoNullable,
  interacciones: noNegativoNullable,
  reacciones: noNegativoNullable,
  comentarios: noNegativoNullable,
  compartidos: noNegativoNullable,
  guardados: noNegativoNullable,
  visitasPerfil: noNegativoNullable,
  seguidoresNuevos: numeroNullable,
  vistasLandingPage: noNegativoNullable,

  // Video
  reproducciones: noNegativoNullable,
  reproducciones2s: noNegativoNullable,
  reproducciones3s: noNegativoNullable,
  reproducciones6s: noNegativoNullable,
  reproduccionesThru: noNegativoNullable,
  p25: noNegativoNullable,
  p50: noNegativoNullable,
  p75: noNegativoNullable,
  p95: noNegativoNullable,
  p100: noNegativoNullable,
  tiempoReproduccionTotal: noNegativoNullable,
  duracionCreativoSeg: noNegativoNullable,

  // Mensajería
  conversacionesIniciadas: noNegativoNullable,
  conversacionesRespondidas: noNegativoNullable,

  // Resultado — resultados y ventana obligatorios
  resultados: noNegativo,
  tipoResultado: textoNullable,
  valorConversion: noNegativoNullable,
  ventanaAtribucion: z.string().min(1),
});
export type InsightRow = z.infer<typeof InsightRowSchema>;

// ---------------------------------------------------------------------------
// BreakdownRow — InsightRow + dimensión. nRegistros obligatorio (privacidad).
// ---------------------------------------------------------------------------

export const BreakdownRowSchema = InsightRowSchema.extend({
  dimension: z.enum(DIMENSIONES),
  valor: z.string(),
  nRegistros: noNegativo,
}).strict();
export type BreakdownRow = z.infer<typeof BreakdownRowSchema>;

// ---------------------------------------------------------------------------
// RegistroEmbudo — agregado. NO tiene ni puede tener datos de paciente.
// ---------------------------------------------------------------------------

export const RegistroEmbudoSchema = z
  .object({
    fecha: FechaSchema,
    campanaId: textoNullable,
    fuenteAtribuida: z.enum(FUENTES_ATRIBUIDAS),
    paso: z.enum(PASOS),
    cantidad: noNegativo,
    valorCOP: noNegativoNullable,
    servicio: textoNullable,
    sede: textoNullable,
    nRegistros: noNegativo,
  })
  .strict();
export type RegistroEmbudo = z.infer<typeof RegistroEmbudoSchema>;

// ---------------------------------------------------------------------------
// Creativo
// ---------------------------------------------------------------------------

export const CreativoSchema = z.object({
  id: z.string().min(1),
  anuncioId: z.string().min(1),
  formato: z.enum(FORMATOS),
  urlMiniatura: textoNullable,
  copyPrincipal: z.string(),
  titular: textoNullable,
  descripcion: textoNullable,
  cta: textoNullable,
  urlDestino: textoNullable,
  fechaPrimerGasto: FechaSchema,
  diasActivo: noNegativo,
  servicio: textoNullable,
  anguloDetectado: z.enum(ANGULOS),
  nivelConsciencia: z.number().int().min(1).max(5),
  confianzaClasificacion: z.number().min(0).max(1),
  senalesDeteccion: z.array(z.string()),
});
export type Creativo = z.infer<typeof CreativoSchema>;

// ---------------------------------------------------------------------------
// Competencia
// ---------------------------------------------------------------------------

export const CompetidorSchema = z.object({
  id: z.string().min(1),
  nombre: z.string(),
  ciudad: z.string(),
  serviciosConocidos: z.array(z.string()),
  urlPagina: textoNullable,
  /** Seguidores de la página, si la fuente los expone. Tamaño del competidor, no su gasto. */
  seguidoresPagina: z.number().min(0).nullable().default(null),
});
export type Competidor = z.infer<typeof CompetidorSchema>;

export const AnuncioCompetidorSchema = z.object({
  competidorId: z.string().min(1),
  nombreAnunciante: z.string(),
  anuncioId: z.string().min(1),
  primeraVez: FechaSchema,
  ultimaVez: FechaSchema,
  diasCorriendo: noNegativo,
  activo: z.boolean(),
  plataformas: z.array(z.string()),
  copy: z.string(),
  titular: textoNullable,
  cta: textoNullable,
  urlMedia: textoNullable,
  tipoMedia: z.enum(TIPOS_MEDIA),
  urlDestino: textoNullable,
  dominioDestino: textoNullable,
  /** Solo si la fuente lo expone. JAMÁS estimado. */
  alcanceRango: z.object({ min: noNegativo, max: noNegativo }).nullable(),
  variantesDelConcepto: z.number().int().min(1),
  servicioDetectado: textoNullable,
  anguloDetectado: z.enum(ANGULOS),
  nivelConsciencia: z.number().int().min(1).max(5),
  usaPrecio: z.boolean(),
  usaUrgencia: z.boolean(),
  usaProfesional: z.boolean(),
  usaTestimonio: z.boolean(),
  usaGarantia: z.boolean(),
  puntuacionLongevidad: z.number().min(0).max(1),
});
export type AnuncioCompetidor = z.infer<typeof AnuncioCompetidorSchema>;

// ---------------------------------------------------------------------------
// Experimento — la memoria que hace que la cuenta sepa más cada mes
// ---------------------------------------------------------------------------

export const ExperimentoSchema = z.object({
  id: z.string().min(1),
  hipotesis: z.string(),
  servicio: textoNullable,
  angulo: z.enum(ANGULOS).nullable(),
  tipoPrueba: z.enum(TIPOS_PRUEBA),
  inicio: FechaSchema,
  fin: FechaSchema.nullable(),
  resultado: z.enum(RESULTADOS_EXPERIMENTO),
  metricaExito: z.string(),
  aprendizaje: textoNullable,
  origenOportunidadId: textoNullable,
});
export type Experimento = z.infer<typeof ExperimentoSchema>;

// ---------------------------------------------------------------------------
// LoteDatos — lo que entrega una fuente
// ---------------------------------------------------------------------------

export const MetaLoteSchema = z.object({
  generadoEn: z.string(),
  desde: FechaSchema,
  hasta: FechaSchema,
  origen: z.enum(ORIGENES_LOTE),
  /** Días del rango sin datos. La UI DEBE mostrarlos. */
  huecos: z.array(FechaSchema),
  /** Texto para la UI, en lenguaje de cliente. */
  advertencias: z.array(z.string()),
});
export type MetaLote = z.infer<typeof MetaLoteSchema>;

// ---------------------------------------------------------------------------
// Ranking frente a la competencia en subasta (lo único externo que entrega Meta)
// ---------------------------------------------------------------------------

export const NIVELES_RANKING = ["superior", "promedio", "inferior_35", "inferior_20", "inferior_10", "sin_dato"] as const;
export type NivelRanking = (typeof NIVELES_RANKING)[number];

/** Cómo se ve un anuncio frente a los que compiten por el mismo público, según Meta. Se captura por sincronización. */
export const RankingAnuncioSchema = z.object({
  fuente: z.literal("meta"),
  cuentaId: z.string().min(1),
  anuncioId: z.string().min(1),
  nombre: z.string(),
  /** Día de la captura (el ranking es de los últimos 28 días a esa fecha). */
  fecha: FechaSchema,
  /** Con quién compara Meta, en palabras: «mensajes · públicos nuevos». */
  cohorte: z.string(),
  calidad: z.enum(NIVELES_RANKING),
  interaccion: z.enum(NIVELES_RANKING),
  conversion: z.enum(NIVELES_RANKING),
  /** Lo que dice Meta del anuncio, textual («The ad is not producing conversions»). */
  lecturaMeta: z.string(),
});
export type RankingAnuncio = z.infer<typeof RankingAnuncioSchema>;

// ---------------------------------------------------------------------------
// Bitácora de cambios de la cuenta (quién prendió y apagó qué)
// ---------------------------------------------------------------------------

export const OBJETOS_CAMBIO = ["campana", "conjunto", "anuncio", "cuenta", "otro"] as const;
export type ObjetoCambio = (typeof OBJETOS_CAMBIO)[number];
export const ACCIONES_CAMBIO = ["prender", "apagar", "revision", "persona_agregada", "persona_eliminada", "otro"] as const;
export type AccionCambio = (typeof ACCIONES_CAMBIO)[number];

/** Un cambio en la cuenta publicitaria. `actor` es quien lo hizo (operador o «Meta»), nunca un paciente. */
export const CambioCuentaSchema = z.object({
  fuente: z.literal("meta"),
  cuentaId: z.string().min(1),
  fecha: FechaSchema,
  /** HH:mm, hora de Bogotá tal como la muestra Meta. */
  hora: z.string().regex(/^\d{2}:\d{2}$/),
  actor: z.string(),
  /** Texto original del tipo de evento («Estado de la campaña actualizado»). */
  tipo: z.string(),
  objetoTipo: z.enum(OBJETOS_CAMBIO),
  objetoId: z.string(),
  objetoNombre: z.string(),
  /** Campaña a la que pertenece el objeto, si Meta la indica. */
  campanaId: textoNullable,
  accion: z.enum(ACCIONES_CAMBIO),
  de: textoNullable,
  a: textoNullable,
});
export type CambioCuenta = z.infer<typeof CambioCuentaSchema>;

// ---------------------------------------------------------------------------
// Públicos: a quién se le muestra cada conjunto y qué rindió
// ---------------------------------------------------------------------------

export const TIPOS_PUBLICO = ["advantage", "similar", "remarketing", "intereses", "amplio"] as const;
export type TipoPublico = (typeof TIPOS_PUBLICO)[number];

export const SegmentacionSchema = z.object({
  edadMin: z.number().int().nullable(),
  edadMax: z.number().int().nullable(),
  genero: z.enum(["todos", "mujeres", "hombres"]),
  /** Lugares incluidos en palabras («Vivante Medicina Estética (10 km)», «Barranquilla»). */
  lugares: z.array(z.string()),
  radioKm: z.number().nullable(),
  /** Zonas excluidas (regiones/ciudades). */
  excluidos: z.array(z.string()),
  /** Intereses, comportamientos, cargos… que Meta usa para segmentar. */
  intereses: z.array(z.string()),
  /** Públicos personalizados (remarketing: interacción, visitantes, listas). */
  personalizados: z.array(z.string()),
  /** Públicos similares (lookalike). */
  similares: z.array(z.string()),
  publicosExcluidos: z.array(z.string()),
  /** Público Advantage+ activado (Meta decide a quién). */
  advantage: z.boolean(),
  plataformas: z.array(z.string()),
  tipo: z.enum(TIPOS_PUBLICO),
});
export type Segmentacion = z.infer<typeof SegmentacionSchema>;

/** Un conjunto de anuncios visto como público: su segmentación y lo que rindió en el rango. Nada de personas. */
export const PublicoSchema = z.object({
  fuente: z.literal("meta"),
  cuentaId: z.string().min(1),
  conjuntoId: z.string().min(1),
  nombre: z.string(),
  campanaId: textoNullable,
  campanaNombre: textoNullable,
  estado: z.enum(ESTADOS),
  /** Objetivo de optimización del conjunto (CONVERSATIONS, LEAD_GENERATION…). */
  objetivo: textoNullable,
  destino: textoNullable,
  presupuestoDiario: noNegativoNullable,
  creado: textoNullable,
  aprendizaje: textoNullable,
  segmentacion: SegmentacionSchema,
  desde: FechaSchema,
  hasta: FechaSchema,
  gasto: noNegativo,
  impresiones: noNegativo,
  alcance: noNegativoNullable,
  clicsEnlace: noNegativo,
  resultados: noNegativo,
  tipoResultado: textoNullable,
});
export type Publico = z.infer<typeof PublicoSchema>;

export const LoteDatosSchema = z.object({
  insights: z.array(InsightRowSchema),
  desgloses: z.array(BreakdownRowSchema),
  creativos: z.array(CreativoSchema),
  embudo: z.array(RegistroEmbudoSchema),
  competidores: z.array(CompetidorSchema),
  anunciosCompetencia: z.array(AnuncioCompetidorSchema),
  experimentos: z.array(ExperimentoSchema),
  /** Opcional: lotes anteriores a la captura de rankings siguen siendo válidos. */
  rankings: z.array(RankingAnuncioSchema).optional(),
  /** Opcional: bitácora de cambios de la cuenta (quién prendió/apagó qué). */
  bitacora: z.array(CambioCuentaSchema).optional(),
  /** Opcional: públicos (segmentación y rendimiento por conjunto en el rango). */
  publicos: z.array(PublicoSchema).optional(),
  meta: MetaLoteSchema,
});
export type LoteDatos = z.infer<typeof LoteDatosSchema>;

// ---------------------------------------------------------------------------
// FuenteDatos — interfaz que implementa cada adapter
// ---------------------------------------------------------------------------

export const EstadoFuenteSchema = z.object({
  id: z.string(),
  /** Lo que ve el cliente. Nunca "MCP" ni "API". */
  etiquetaPublica: z.string(),
  conectado: z.boolean(),
  ultimaActualizacion: z.string().nullable(),
  detalle: z.string().nullable(),
});
export type EstadoFuente = z.infer<typeof EstadoFuenteSchema>;

export interface Rango {
  desde: string;
  hasta: string;
}

export interface FuenteDatos {
  readonly nombre: string;
  obtener(rango: Rango): Promise<LoteDatos>;
  estado(): Promise<EstadoFuente[]>;
}

// ---------------------------------------------------------------------------
// Orgánico — lo que la clínica publica sin pagar en Instagram y Facebook
// (archivo aparte: datos/organico.json; la pauta no se toca)
// ---------------------------------------------------------------------------

export const REDES_ORGANICO = ["instagram", "facebook", "tiktok"] as const;
export type RedOrganico = (typeof REDES_ORGANICO)[number];
export const FORMATOS_ORGANICO = ["reel", "video", "imagen", "carrusel", "historia", "texto", "enlace"] as const;
export type FormatoOrganico = (typeof FORMATOS_ORGANICO)[number];

/** Una publicación con lo que Meta entrega de ella. `null` = la métrica no existe para ese formato o Meta la retiró. */
export const PublicacionOrganicaSchema = z.object({
  id: z.string().min(1),
  red: z.enum(REDES_ORGANICO),
  formato: z.enum(FORMATOS_ORGANICO),
  /** Fecha y hora de publicación en Bogotá (YYYY-MM-DDTHH:mm). */
  publicadoEn: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, "fecha YYYY-MM-DDTHH:mm"),
  /** Primeras líneas del texto de la publicación (público). */
  texto: z.string(),
  enlace: z.string(),
  urlMiniatura: textoNullable,
  alcance: noNegativoNullable,
  vistas: noNegativoNullable,
  meGusta: noNegativoNullable,
  comentarios: noNegativoNullable,
  compartidos: noNegativoNullable,
  guardados: noNegativoNullable,
  interacciones: noNegativoNullable,
  visitasPerfil: noNegativoNullable,
  seguidoresGanados: noNegativoNullable,
  clics: noNegativoNullable,
  /** Reels: segundos promedio de reproducción. */
  segundosPromedio: noNegativoNullable,
  /** Historias: respuestas. */
  respuestas: noNegativoNullable,
});
export type PublicacionOrganica = z.infer<typeof PublicacionOrganicaSchema>;

export const CuentaOrganicaSchema = z.object({
  red: z.enum(REDES_ORGANICO),
  id: z.string().min(1),
  /** Usuario de Instagram o nombre de la página (entidad pública, no persona). */
  alias: z.string(),
  seguidores: noNegativoNullable,
  publicaciones: noNegativoNullable,
});
export type CuentaOrganica = z.infer<typeof CuentaOrganicaSchema>;

/** Un día de una cuenta: lo que Meta da por día (seguidores nuevos, alcance, vistas, interacciones). */
export const DiaOrganicoSchema = z.object({
  red: z.enum(REDES_ORGANICO),
  fecha: FechaSchema,
  seguidoresNuevos: noNegativoNullable,
  seguidoresTotal: noNegativoNullable,
  alcance: noNegativoNullable,
  vistas: noNegativoNullable,
  interacciones: noNegativoNullable,
});
export type DiaOrganico = z.infer<typeof DiaOrganicoSchema>;

export const LoteOrganicoSchema = z.object({
  cuentas: z.array(CuentaOrganicaSchema),
  publicaciones: z.array(PublicacionOrganicaSchema),
  dias: z.array(DiaOrganicoSchema),
  meta: z.object({
    capturadoEn: z.string(),
    desde: FechaSchema,
    hasta: FechaSchema,
    origen: z.literal("graph"),
    /** Métricas que Meta no entregó (retiradas o sin permiso), en lenguaje de cliente. */
    avisos: z.array(z.string()),
  }),
});
export type LoteOrganico = z.infer<typeof LoteOrganicoSchema>;

// ---------------------------------------------------------------------------
// Sitio web — Google Analytics 4 (archivo aparte: datos/web.json)
// ---------------------------------------------------------------------------

/** Un día × canal × fuente/medio de tráfico del sitio. */
export const SesionesWebSchema = z.object({
  fecha: FechaSchema,
  /** Grupo de canal de Google: Paid Social, Organic Social, Organic Search, Direct, Referral, Paid Search… */
  canal: z.string(),
  fuente: z.string(),
  medio: z.string(),
  sesiones: noNegativo,
  usuarios: noNegativoNullable,
  usuariosNuevos: noNegativoNullable,
  sesionesComprometidas: noNegativoNullable,
  /** Segundos promedio por sesión. */
  duracionMedia: noNegativoNullable,
  /** Eventos clave (conversiones) que Google atribuye a ese tráfico. */
  eventosClave: noNegativoNullable,
});
export type SesionesWeb = z.infer<typeof SesionesWebSchema>;

export const PaginaWebSchema = z.object({
  fecha: FechaSchema,
  pagina: z.string(),
  sesiones: noNegativo,
  sesionesComprometidas: noNegativoNullable,
  eventosClave: noNegativoNullable,
});
export type PaginaWeb = z.infer<typeof PaginaWebSchema>;

export const EventoWebSchema = z.object({
  fecha: FechaSchema,
  evento: z.string(),
  veces: noNegativo,
  esClave: z.boolean(),
});
export type EventoWeb = z.infer<typeof EventoWebSchema>;

export const CiudadWebSchema = z.object({
  fecha: FechaSchema,
  ciudad: z.string(),
  sesiones: noNegativo,
  eventosClave: noNegativoNullable,
});
export type CiudadWeb = z.infer<typeof CiudadWebSchema>;

export const LoteWebSchema = z.object({
  propiedadId: z.string().min(1),
  sesiones: z.array(SesionesWebSchema),
  paginas: z.array(PaginaWebSchema),
  eventos: z.array(EventoWebSchema),
  ciudades: z.array(CiudadWebSchema),
  meta: z.object({
    capturadoEn: z.string(),
    desde: FechaSchema,
    hasta: FechaSchema,
    origen: z.literal("ga4"),
    avisos: z.array(z.string()),
  }),
});
export type LoteWeb = z.infer<typeof LoteWebSchema>;
