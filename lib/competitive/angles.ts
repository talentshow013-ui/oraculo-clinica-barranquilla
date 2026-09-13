/**
 * Clasificador determinista de ángulos por diccionario. (§7.6)
 *
 * Transparente y auditable: expone qué señales dispararon la clasificación,
 * no un veredicto opaco. Misma entrada, misma salida.
 */
import type { Angulo } from "@/lib/adapters/types";

function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

/** Palabras/expresiones por ángulo. Se buscan sobre texto normalizado sin acentos. */
export const DICCIONARIO_ANGULOS: Record<Exclude<Angulo, "sin_clasificar">, ReadonlyArray<string>> = {
  autoridad_medica: ["medico", "medica", "doctor", "doctora", "dr.", "dra.", "certificad", "especialista", "anos de experiencia", "dermatolog", "cirujano", "profesional de la salud", "avalado", "invima"],
  prueba_social: ["pacientes atendidos", "mas de", "miles de", "cientos de", "nos eligen", "recomendad", "calificacion", "estrellas", "resenas", "opiniones", "clientes felices"],
  aspiracional: ["rejuvenec", "luce", "radiante", "la mejor version", "sientete", "piel de porcelana", "cuerpo que", "confianza", "brilla", "renuev", "transforma"],
  objecion_seguridad: ["seguro", "segura", "sin riesgo", "aprobado", "esteril", "protocolo", "bioseguridad", "efectos secundarios", "sin cirugia", "no invasivo", "minimamente invasivo"],
  objecion_dolor: ["duele", "dolor", "sin dolor", "indoloro", "molestia", "anestesia", "sin agujas", "comodo", "suave"],
  objecion_tiempo: ["en minutos", "sin incapacidad", "vuelve a tu rutina", "mismo dia", "rapido", "sin tiempo de recuperacion", "en tu hora de almuerzo", "resultados inmediatos", "sesion de"],
  objecion_precio: ["cuotas", "financia", "desde $", "accesible", "economico", "sin intereses", "paga en", "plan de pago", "precio justo", "invierte en ti"],
  educativo: ["sabias que", "te explicamos", "que es", "como funciona", "mitos", "verdad", "aprende", "conoce", "diferencia entre", "por que", "cuando"],
  promocion: ["promocion", "promo", "descuento", "% de", "2x1", "oferta", "gratis", "bono", "regalo", "precio especial", "$"],
  urgencia: ["solo hoy", "cupos limitados", "ultimos cupos", "hasta el", "esta semana", "agenda ya", "no te lo pierdas", "termina", "quedan", "ultima oportunidad"],
  antes_despues: ["antes y despues", "antes/despues", "before", "after", "resultado real", "mira el cambio", "asi quedo"],
  testimonio: ["nos cuenta", "su experiencia", "testimonio", "me cambio", "volveria", "recomiendo", "\"", "'", "dice", "opinion de"],
  detras_de_camara: ["detras de camara", "asi trabajamos", "nuestro equipo", "un dia en", "conoce la clinica", "nuestras instalaciones", "en vivo", "backstage", "asi se hace"],
};

export interface ResultadoAngulo {
  angulo: Angulo;
  /** 0-1: proporción de señales del ángulo ganador sobre el total encontradas. */
  confianza: number;
  senales: string[];
  /** Conteo por ángulo, para mostrar por qué ganó uno y no otro. */
  puntajes: Partial<Record<Angulo, number>>;
}

export function clasificarAngulo(texto: string): ResultadoAngulo {
  const t = normalizar(texto);
  const puntajes: Partial<Record<Angulo, number>> = {};
  const senalesPor: Partial<Record<Angulo, string[]>> = {};
  let total = 0;

  for (const [angulo, terminos] of Object.entries(DICCIONARIO_ANGULOS) as [Angulo, ReadonlyArray<string>][]) {
    for (const termino of terminos) {
      if (t.includes(normalizar(termino))) {
        puntajes[angulo] = (puntajes[angulo] ?? 0) + 1;
        (senalesPor[angulo] ??= []).push(termino);
        total++;
      }
    }
  }

  if (total === 0) return { angulo: "sin_clasificar", confianza: 0, senales: [], puntajes };

  // Ganador: más señales; empate → orden del diccionario (determinista).
  let ganador: Angulo = "sin_clasificar";
  let mejor = 0;
  for (const angulo of Object.keys(DICCIONARIO_ANGULOS) as Angulo[]) {
    const p = puntajes[angulo] ?? 0;
    if (p > mejor) {
      mejor = p;
      ganador = angulo;
    }
  }

  return { angulo: ganador, confianza: mejor / total, senales: senalesPor[ganador] ?? [], puntajes };
}

/**
 * Nivel de consciencia (Schwartz) 1-5 aproximado desde el texto:
 * 1 inconsciente · 2 consciente del problema · 3 de la solución · 4 del producto · 5 más consciente (precio/oferta).
 */
export function nivelConscienciaTexto(texto: string): 1 | 2 | 3 | 4 | 5 {
  const t = normalizar(texto);
  const tiene = (...xs: string[]) => xs.some((x) => t.includes(normalizar(x)));
  if (tiene("$", "descuento", "promocion", "solo hoy", "agenda ya", "cupos")) return 5;
  if (tiene("toxina", "botox", "acido hialuronico", "laser", "criolipolisis", "radiofrecuencia", "plasma", "peeling")) return 4;
  if (tiene("tratamiento", "procedimiento", "solucion", "valoracion", "consulta")) return 3;
  if (tiene("sabias que", "te explicamos", "por que", "arrugas", "manchas", "flacidez", "lineas de expresion")) return 2;
  return 1;
}

export interface ResultadoRiesgo {
  riesgo: boolean;
  senales: string[];
}

const SENALES_RIESGO: ReadonlyArray<{ patron: RegExp; etiqueta: string }> = [
  { patron: /antes\s*(y|\/)\s*despues|before|after|asi quedo|mira el cambio/, etiqueta: "antes y después" },
  { patron: /garantizad|para siempre|100 ?%|definitiv|elimina (la|el|tus?) |cura|sin efectos/, etiqueta: "promesa absoluta" },
  { patron: /cansad[ao] de tu|tu papada|tu barriga|tu celulitis|tus arrugas|tu grasa|tus kilos|tu flacidez|odias tu/, etiqueta: "referencia negativa al cuerpo del espectador" },
  { patron: /baja(r)? de peso|adelgaz|pierde \d+ ?k|quema grasa/, etiqueta: "afirmación de pérdida de peso" },
  { patron: /milagr|el mejor del mundo|unico en colombia|numero 1/, etiqueta: "afirmación médica absoluta" },
];

/** Detecta antes/después, referencias negativas al cuerpo y promesas absolutas. */
export function riesgoPolitica(texto: string): ResultadoRiesgo {
  const t = normalizar(texto);
  const senales = SENALES_RIESGO.filter((s) => s.patron.test(t)).map((s) => s.etiqueta);
  return { riesgo: senales.length > 0, senales };
}
