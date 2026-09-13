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

export const LoteDatosSchema = z.object({
  insights: z.array(InsightRowSchema),
  desgloses: z.array(BreakdownRowSchema),
  creativos: z.array(CreativoSchema),
  embudo: z.array(RegistroEmbudoSchema),
  competidores: z.array(CompetidorSchema),
  anunciosCompetencia: z.array(AnuncioCompetidorSchema),
  experimentos: z.array(ExperimentoSchema),
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
