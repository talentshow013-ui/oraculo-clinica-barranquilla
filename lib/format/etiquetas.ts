/**
 * Etiquetas visibles al cliente. Aquí NO existe "API", "MCP", "endpoint", "Zod" ni "LLM".
 * Se dice "Campañas y audiencias", "Video corto", "Radar de mercado", "Agenda y ventas".
 */
import type { Angulo, Paso } from "@/lib/adapters/types";
import type { Cuadrante } from "@/lib/metrics/creative";
import type { Area, Severidad } from "@/lib/diagnostics/engine";

export const NOMBRE_PRODUCTO = "Oráculo";

export const FUENTES_PUBLICAS = {
  meta: "Campañas y audiencias",
  tiktok: "Video corto",
  radar: "Radar de mercado",
  clinica: "Agenda y ventas",
} as const;

export const ETIQUETA_PASO: Record<Paso, string> = {
  impresion: "Personas que vieron el anuncio",
  clic: "Hicieron clic",
  conversacion: "Escribieron",
  lead_calificado: "Interesados reales",
  cita_agendada: "Agendaron valoración",
  cita_asistida: "Asistieron a valoración",
  venta: "Compraron un procedimiento",
  recompra: "Volvieron a comprar",
};

export const ETIQUETA_PASO_CORTA: Record<Paso, string> = {
  impresion: "Vieron",
  clic: "Clic",
  conversacion: "Escribieron",
  lead_calificado: "Calificados",
  cita_agendada: "Agendaron",
  cita_asistida: "Asistieron",
  venta: "Compraron",
  recompra: "Recompra",
};

export const ETIQUETA_CUADRANTE: Record<Cuadrante, string> = {
  escalar: "Escalar",
  arreglar_gancho: "Arreglar el gancho",
  arreglar_oferta: "Arreglar la oferta",
  matar: "Apagar",
  sin_senal: "Esperar señal",
};

export const ETIQUETA_ANGULO: Record<Angulo, string> = {
  autoridad_medica: "Autoridad médica",
  prueba_social: "Prueba social",
  aspiracional: "Aspiracional",
  objecion_seguridad: "Objeción: seguridad",
  objecion_dolor: "Objeción: dolor",
  objecion_tiempo: "Objeción: tiempo",
  objecion_precio: "Objeción: precio",
  educativo: "Educativo",
  promocion: "Promoción",
  urgencia: "Urgencia",
  antes_despues: "Antes y después",
  testimonio: "Testimonio",
  detras_de_camara: "Detrás de cámara",
  sin_clasificar: "Sin clasificar",
};

export const ETIQUETA_AREA: Record<Area, string> = {
  entrega: "Entrega de la pauta",
  creativo: "Anuncios",
  audiencia: "Audiencias",
  embudo: "Agenda y ventas",
  operacion: "Operación",
  economia: "Economía del negocio",
  datos: "Calidad de los datos",
  competencia: "Radar de mercado",
};

export const ETIQUETA_SEVERIDAD: Record<Severidad, string> = {
  alta: "Urgente",
  media: "Importante",
  baja: "Para revisar",
};

export const NIVEL_CONSCIENCIA: Record<1 | 2 | 3 | 4 | 5, string> = {
  1: "No sabe que tiene el problema",
  2: "Reconoce el problema",
  3: "Busca solución",
  4: "Compara procedimientos",
  5: "Ya decidió, compara precio",
};

export const METODO_VALORIZACION = {
  costo_paso_anterior: "Se valoriza a lo que costó traer a cada persona hasta el paso anterior.",
  margen_unitario: "Se valoriza al margen que dejó de ganar cada venta perdida.",
  no_aplica: "Este paso es exposición, no un contacto: no se valoriza como fuga.",
} as const;

export const AVISO_DESGLOSES =
  "Los desgloses por edad, zona, plataforma y hora no suman exactamente al total: una misma persona puede contarse en varios cruces.";

export const AVISO_VENTANA_ATRIBUCION = (ventana: string) =>
  `Ventana de atribución: ${ventana}. Cambiarla cambia los números.`;
