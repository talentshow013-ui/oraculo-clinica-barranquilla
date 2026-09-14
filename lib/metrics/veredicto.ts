/**
 * Dos preguntas que el equipo hace en la reunión de los quince:
 *  1. «¿Cómo nos fue con esta pauta?» → veredictoCampana: sirvió / no sirvió / a medias, con razones
 *     en pesos y porcentajes, comparando contra las demás campañas de la cuenta (mediana) y contra
 *     los umbrales calibrables. Y qué funcionó de lo que se subió: creativosDeCampana.
 *  2. «¿Cómo se ve esta contra aquellas?» → compararVarias: las campañas que uno escoja, lado a lado,
 *     con la mejor de cada métrica marcada y la diferencia de cada una frente a la mejor.
 * Solo razones y umbrales: ninguna cifra se inventa; sin dato → null y el veredicto lo dice.
 */
import type { Benchmarks } from "@/config/benchmarks";
import type { InsightRow } from "@/lib/adapters/types";
import { cop, pct } from "@/lib/format";
import { razon } from "./core";
import type { EvaluacionCreativo } from "./creative";
import { METRICAS_COMPARACION, type MetricaComparada, type ResumenCampana } from "./campanas";

// ---------------------------------------------------------------------------
// Varias campañas lado a lado
// ---------------------------------------------------------------------------

export interface MetricaVarias {
  id: string;
  nombre: string;
  unidad: MetricaComparada["unidad"];
  mejorEs: MetricaComparada["mejorEs"];
  /** Un valor por campaña, en el mismo orden que `campanas`. */
  valores: (number | null)[];
  /** Índice de la mejor campaña en esta métrica; null si es informativa o no hay valores. */
  mejorIndice: number | null;
  /** (valor − mejor) / mejor por campaña; 0 en la mejor; null sin dato. */
  deltasFrenteAlMejor: (number | null)[];
  comparable: boolean;
}

export interface ComparacionVarias {
  campanas: ResumenCampana[];
  diasDistintos: boolean;
  aviso: string | null;
  metricas: MetricaVarias[];
}

export function compararVarias(campanas: ReadonlyArray<ResumenCampana>): ComparacionVarias {
  const lista = [...campanas];
  if (lista.length < 2) return { campanas: lista, diasDistintos: false, aviso: null, metricas: [] };
  const dias = new Set(lista.map((c) => c.diasConGasto));
  const diasDistintos = dias.size > 1;
  return {
    campanas: lista,
    diasDistintos,
    aviso: diasDistintos ? "Corrieron distinto número de días: compara los costos y las tasas, no las sumas." : null,
    metricas: METRICAS_COMPARACION.map((m) => {
      const valores = lista.map((c) => m.f(c));
      let mejorIndice: number | null = null;
      if (m.mejorEs === "mayor" || m.mejorEs === "menor") {
        valores.forEach((v, i) => {
          if (v === null) return;
          const actual = mejorIndice === null ? null : valores[mejorIndice]!;
          if (actual === null || (m.mejorEs === "mayor" ? v > actual : v < actual)) mejorIndice = i;
        });
      }
      const mejor = mejorIndice === null ? null : valores[mejorIndice]!;
      return {
        id: m.id,
        nombre: m.nombre,
        unidad: m.unidad,
        mejorEs: m.mejorEs,
        valores,
        mejorIndice,
        deltasFrenteAlMejor: valores.map((v) => (v === null || mejor === null || mejor === 0 ? null : (v - mejor) / mejor)),
        comparable: !(m.suma && diasDistintos),
      };
    }),
  };
}

// ---------------------------------------------------------------------------
// Veredicto de una campaña
// ---------------------------------------------------------------------------

export type Veredicto = "sirvio" | "a_medias" | "no_sirvio" | "sin_resultados";

export interface VeredictoCampana {
  veredicto: Veredicto;
  titulo: string;
  razones: string[];
  /** Qué falta para un veredicto completo; null si no falta nada. */
  faltan: string | null;
}

function mediana(valores: ReadonlyArray<number>): number | null {
  if (!valores.length) return null;
  const s = [...valores].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
}

/** +1 buena señal, −1 mala, 0 neutra/sin dato. Cada señal deja su razón en palabras. */
function senalCosto(nombre: string, valor: number | null, otros: ReadonlyArray<number>, razones: string[]): number {
  if (valor === null) return 0;
  const ref = mediana(otros);
  if (ref === null || ref === 0) return 0;
  const d = (valor - ref) / ref;
  if (d <= -0.15) {
    razones.push(`${nombre}: ${cop(valor)}, ${pct(-d, 0)} más barata que las otras campañas (${cop(ref)}).`);
    return 1;
  }
  if (d >= 0.25) {
    razones.push(`${nombre}: ${cop(valor)}, ${pct(d, 0)} más cara que las otras campañas (${cop(ref)}).`);
    return -1;
  }
  razones.push(`${nombre}: ${cop(valor)}, parecida a las otras campañas (${cop(ref)}).`);
  return 0;
}

function senalTasa(nombre: string, valor: number | null, minimo: number, razones: string[]): number {
  if (valor === null) return 0;
  if (valor >= minimo) {
    razones.push(`${nombre}: ${pct(valor, 0)} (el mínimo sano es ${pct(minimo, 0)}).`);
    return 1;
  }
  razones.push(`${nombre}: ${pct(valor, 0)}, por debajo del mínimo sano de ${pct(minimo, 0)}.`);
  return -1;
}

export function veredictoCampana(c: ResumenCampana, todas: ReadonlyArray<ResumenCampana>, b: Benchmarks): VeredictoCampana {
  const otras = todas.filter((x) => x.id !== c.id);
  const razones: string[] = [];

  // Señal de pauta (siempre disponible con Meta)
  senalCosto("Costo por conversación", c.costoConversacion, otras.map((x) => x.costoConversacion).filter((v): v is number => v !== null), razones);

  const hayResultados = c.citasAsistidas !== null || c.ventas !== null;
  if (!hayResultados) {
    return {
      veredicto: "sin_resultados",
      titulo: "Todavía no se puede decir si sirvió",
      razones,
      faltan: "Registra los Resultados de esta campaña (citas y ventas) y el veredicto sale aquí mismo.",
    };
  }

  // Señales de negocio (con los resultados registrados)
  senalCosto("Costo por cita asistida", c.costoCitaAsistida, otras.map((x) => x.costoCitaAsistida).filter((v): v is number => v !== null), razones);
  senalTasa("Asistencia a citas", razon(c.citasAsistidas, c.citasAgendadas), b.showRateMinimo.valor, razones);
  senalTasa("Cierre en consultorio", razon(c.ventas, c.citasAsistidas), b.cierreConsultorioMinimo.valor, razones);

  const negativas = razones.filter((r) => /más cara|por debajo/.test(r)).length;
  const positivas = razones.filter((r) => /más barata|mínimo sano es/.test(r)).length;
  // Sin ninguna señal en contra → sirvió; sin ninguna a favor → no sirvió; mezcladas → a medias.
  let veredicto: Veredicto;
  if (positivas > 0 && negativas === 0) veredicto = "sirvio";
  else if (negativas > 0 && positivas === 0) veredicto = "no_sirvio";
  else veredicto = "a_medias";

  const titulo = veredicto === "sirvio" ? "Esta pauta sirvió" : veredicto === "no_sirvio" ? "Esta pauta no sirvió" : "Esta pauta sirvió a medias";
  const sinValor = c.valorVentasCOP === null ? "Falta el valor vendido para medir el retorno en pesos." : null;
  return { veredicto, titulo, razones, faltan: sinValor };
}

// ---------------------------------------------------------------------------
// Creativos de una campaña
// ---------------------------------------------------------------------------

export interface CreativoDeCampana {
  anuncioId: string;
  nombre: string;
  formato: string;
  cuadrante: EvaluacionCreativo["cuadrante"];
  /** Una frase: funcionó / se cansó / no se probó… */
  lectura: string;
  accion: string;
  gasto: number;
  costoResultado: number | null;
  ctrEnlace: number | null;
  urlMiniatura: string | null;
}

const LECTURA: Record<EvaluacionCreativo["cuadrante"], string> = {
  escalar: "Funcionó: trae resultados a buen costo.",
  arreglar_gancho: "A medias: convierte, pero pocos se detienen a verlo.",
  arreglar_oferta: "A medias: detiene el scroll, pero no convierte.",
  matar: "No funcionó: ni retiene ni convierte.",
  sin_senal: "No se probó lo suficiente: aún no hay señal.",
};

/** Anuncios de la campaña (anuncio → conjunto → campaña) con la lectura del laboratorio creativo. */
export function creativosDeCampana(campanaId: string, insights: ReadonlyArray<InsightRow>, evaluaciones: ReadonlyArray<EvaluacionCreativo>): CreativoDeCampana[] {
  const conjuntos = new Set(insights.filter((f) => f.nivel === "conjunto" && f.padreId === campanaId).map((f) => f.id));
  const anuncios = new Map<string, string>(); // anuncioId → nombre
  for (const f of insights) if (f.nivel === "anuncio" && f.padreId && conjuntos.has(f.padreId)) anuncios.set(f.id, f.nombre);
  return evaluaciones
    .filter((e) => anuncios.has(e.creativo.anuncioId))
    .map((e) => ({
      anuncioId: e.creativo.anuncioId,
      nombre: anuncios.get(e.creativo.anuncioId) ?? e.creativo.anuncioId,
      formato: e.creativo.formato,
      cuadrante: e.cuadrante,
      lectura: LECTURA[e.cuadrante],
      accion: e.accion,
      gasto: e.agregado.gasto,
      costoResultado: e.costoResultado,
      ctrEnlace: e.ctrEnlace,
      urlMiniatura: e.creativo.urlMiniatura,
    }))
    .sort((a, b) => b.gasto - a.gasto);
}
