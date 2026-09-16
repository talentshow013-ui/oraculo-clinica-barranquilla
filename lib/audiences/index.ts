/**
 * Públicos: a quién se le muestra la pauta y cuál de esos públicos rinde. Se juzga por conjunto
 * de anuncios (la unidad donde vive la segmentación en Meta) contra el costo por resultado de la
 * cuenta en el mismo rango. Nada se estima: un conjunto sin señal no se juzga.
 */
import type { Publico, TipoPublico } from "@/lib/adapters/types";
import type { Benchmarks } from "@/config/benchmarks";
import { razon } from "@/lib/metrics/core";

export type CuadrantePublico = "ganador" | "al_costo" | "caro" | "sin_senal";

export interface PublicoEvaluado extends Publico {
  costoResultado: number | null;
  ctrEnlace: number | null;
  frecuencia: number | null;
  /** Diferencia frente al costo de referencia de la cuenta (−0.3 = 30 % más barato). */
  diferencia: number | null;
  cuadrante: CuadrantePublico;
  puesto: number;
  /** La segmentación en una frase, para leerla de un vistazo. */
  resumen: string;
}

export interface GrupoPublico {
  clave: string;
  etiqueta: string;
  conjuntos: number;
  gasto: number;
  resultados: number;
  costoResultado: number | null;
  /** Mejor conjunto del grupo por costo con señal, si hay. */
  mejor: PublicoEvaluado | null;
}

export interface SegmentacionSugerida {
  titulo: string;
  porQue: string;
  /** Datos exactos en los que se apoya. */
  evidencia: string[];
  /** Conjunto del que se copia la segmentación, si aplica. */
  conjuntoId: string | null;
}

export interface ResultadoPublicos {
  sinDatos: boolean;
  desde: string | null;
  hasta: string | null;
  /** Costo por resultado de referencia: gasto ÷ resultados de todos los públicos del rango. */
  referencia: number | null;
  conjuntos: number;
  ganadores: PublicoEvaluado[];
  todos: PublicoEvaluado[];
  porTipo: GrupoPublico[];
  porEdad: GrupoPublico[];
  porGenero: GrupoPublico[];
  porRadio: GrupoPublico[];
  sugerencias: SegmentacionSugerida[];
}

export const NOMBRE_TIPO: Record<TipoPublico, string> = {
  advantage: "Advantage+ (Meta elige)",
  similar: "Similares (lookalike)",
  remarketing: "Remarketing (ya te conocen)",
  intereses: "Intereses",
  amplio: "Amplio (solo edad y lugar)",
};

const NOMBRE_GENERO = { todos: "Mujeres y hombres", mujeres: "Solo mujeres", hombres: "Solo hombres" } as const;

export function resumirSegmentacion(p: Publico): string {
  const s = p.segmentacion;
  const partes: string[] = [];
  partes.push(NOMBRE_TIPO[s.tipo]);
  if (s.edadMin !== null && s.edadMax !== null) partes.push(`${s.edadMin}–${s.edadMax} años`);
  partes.push(NOMBRE_GENERO[s.genero].toLowerCase());
  if (s.radioKm !== null) partes.push(`${s.radioKm} km alrededor de la clínica`);
  else if (s.lugares.length) partes.push(s.lugares.slice(0, 2).join(", "));
  if (s.similares.length) partes.push(`similar a: ${s.similares[0]!.replace(/^Público similar\s*/i, "")}`);
  if (s.personalizados.length) partes.push(`remarketing: ${s.personalizados.slice(0, 2).join(", ")}`);
  if (s.intereses.length) partes.push(`intereses: ${s.intereses.slice(0, 3).join(", ")}${s.intereses.length > 3 ? ` +${s.intereses.length - 3}` : ""}`);
  return partes.join(" · ");
}

function cuadrante(p: Publico, costo: number | null, referencia: number | null, b: Benchmarks): CuadrantePublico {
  if (p.impresiones < b.minimoImpresionesSenal.valor || p.resultados < b.minimoResultadosSenal.valor || costo === null || referencia === null) return "sin_senal";
  if (costo <= referencia * 0.9) return "ganador";
  if (costo <= referencia * 1.1) return "al_costo";
  return "caro";
}

const ORDEN: Record<CuadrantePublico, number> = { ganador: 0, al_costo: 1, caro: 2, sin_senal: 3 };

export function evaluarPublicos(publicos: ReadonlyArray<Publico>, b: Benchmarks): { evaluados: PublicoEvaluado[]; referencia: number | null } {
  const gasto = publicos.reduce((s, p) => s + p.gasto, 0);
  const resultados = publicos.reduce((s, p) => s + p.resultados, 0);
  const referencia = razon(gasto, resultados);
  const evaluados = publicos
    .map((p) => {
      const costo = razon(p.gasto, p.resultados);
      return {
        ...p,
        costoResultado: costo,
        ctrEnlace: razon(p.clicsEnlace, p.impresiones),
        frecuencia: p.alcance ? razon(p.impresiones, p.alcance) : null,
        diferencia: costo !== null && referencia ? costo / referencia - 1 : null,
        cuadrante: cuadrante(p, costo, referencia, b),
        puesto: 0,
        resumen: resumirSegmentacion(p),
      };
    })
    .sort((x, y) => {
      const d = ORDEN[x.cuadrante] - ORDEN[y.cuadrante];
      if (d !== 0) return d;
      if (x.cuadrante === "sin_senal") return y.gasto - x.gasto;
      return (x.costoResultado ?? Infinity) - (y.costoResultado ?? Infinity) || y.resultados - x.resultados;
    })
    .map((p, i) => ({ ...p, puesto: i + 1 }));
  return { evaluados, referencia };
}

function agrupar(evaluados: ReadonlyArray<PublicoEvaluado>, clave: (p: PublicoEvaluado) => string, etiqueta: (clave: string) => string): GrupoPublico[] {
  const m = new Map<string, GrupoPublico>();
  for (const p of evaluados) {
    const k = clave(p);
    const g = m.get(k) ?? { clave: k, etiqueta: etiqueta(k), conjuntos: 0, gasto: 0, resultados: 0, costoResultado: null, mejor: null };
    g.conjuntos++;
    g.gasto += p.gasto;
    g.resultados += p.resultados;
    if (p.cuadrante !== "sin_senal" && p.costoResultado !== null && (g.mejor === null || (g.mejor.costoResultado ?? Infinity) > p.costoResultado)) g.mejor = p;
    m.set(k, g);
  }
  return [...m.values()]
    .map((g) => ({ ...g, costoResultado: razon(g.gasto, g.resultados) }))
    .sort((a, b) => (a.costoResultado ?? Infinity) - (b.costoResultado ?? Infinity) || b.gasto - a.gasto);
}

function tramoEdad(p: PublicoEvaluado): string {
  const { edadMin, edadMax } = p.segmentacion;
  if (edadMin === null || edadMax === null) return "sin edad";
  return `${edadMin}–${edadMax}`;
}

function tramoRadio(p: PublicoEvaluado): string {
  const r = p.segmentacion.radioKm;
  if (r === null) return p.segmentacion.lugares.length ? "ciudad o región" : "sin lugar";
  if (r <= 5) return "hasta 5 km";
  if (r <= 15) return "6–15 km";
  if (r <= 30) return "16–30 km";
  return "más de 30 km";
}

/** Mínimo de resultados para que un grupo o un conjunto sirva de base a una sugerencia. */
const MINIMO_RESULTADOS_SUGERENCIA = 50;

function sugerir(res: Omit<ResultadoPublicos, "sugerencias">): SegmentacionSugerida[] {
  const s: SegmentacionSugerida[] = [];
  const ref = res.referencia;
  const cop = (v: number | null) => (v === null ? "—" : `$ ${Math.round(v).toLocaleString("es-CO")}`);
  const conSenal = (g: GrupoPublico) => g.resultados >= MINIMO_RESULTADOS_SUGERENCIA && g.costoResultado !== null;

  const tipo = res.porTipo.filter(conSenal)[0];
  if (tipo && ref && tipo.costoResultado! < ref) {
    s.push({
      titulo: `Priorizar públicos «${tipo.etiqueta}»`,
      porQue: `Es el tipo de público con menor costo por resultado con señal suficiente: ${cop(tipo.costoResultado)} frente a ${cop(ref)} de referencia, con ${tipo.resultados} resultados en ${tipo.conjuntos} conjuntos.`,
      evidencia: res.porTipo.filter(conSenal).slice(0, 4).map((g) => `${g.etiqueta}: ${cop(g.costoResultado)} (${g.resultados} resultados)`),
      conjuntoId: tipo.mejor?.conjuntoId ?? null,
    });
  }
  const edad = res.porEdad.filter(conSenal)[0];
  if (edad && ref && edad.costoResultado! < ref) {
    s.push({
      titulo: `Rango de edad ${edad.etiqueta} años`,
      porQue: `Los conjuntos que apuntan a ${edad.etiqueta} años convierten a ${cop(edad.costoResultado)}; los demás rangos con señal salen más caros.`,
      evidencia: res.porEdad.filter(conSenal).slice(0, 4).map((g) => `${g.etiqueta} años: ${cop(g.costoResultado)} (${g.resultados} resultados)`),
      conjuntoId: edad.mejor?.conjuntoId ?? null,
    });
  }
  const generos = res.porGenero.filter(conSenal);
  if (generos.length >= 2 && generos[0]!.costoResultado! < generos[1]!.costoResultado! * 0.85) {
    s.push({
      titulo: `Segmentar por género: ${generos[0]!.etiqueta.toLowerCase()}`,
      porQue: `${generos[0]!.etiqueta} convierte al menos 15 % más barato que ${generos[1]!.etiqueta.toLowerCase()} (${cop(generos[0]!.costoResultado)} vs ${cop(generos[1]!.costoResultado)}).`,
      evidencia: generos.map((g) => `${g.etiqueta}: ${cop(g.costoResultado)} (${g.resultados} resultados)`),
      conjuntoId: generos[0]!.mejor?.conjuntoId ?? null,
    });
  }
  const radio = res.porRadio.filter(conSenal)[0];
  if (radio && ref && radio.costoResultado! < ref) {
    s.push({
      titulo: `Radio geográfico: ${radio.etiqueta}`,
      porQue: `Los conjuntos con ${radio.etiqueta} alrededor de la clínica convierten a ${cop(radio.costoResultado)}, por debajo de la referencia.`,
      evidencia: res.porRadio.filter(conSenal).slice(0, 4).map((g) => `${g.etiqueta}: ${cop(g.costoResultado)} (${g.resultados} resultados)`),
      conjuntoId: radio.mejor?.conjuntoId ?? null,
    });
  }
  for (const g of res.ganadores.slice(0, 3)) {
    s.push({
      titulo: `Copiar la segmentación de «${g.nombre.slice(0, 60)}»`,
      porQue: `${g.resultados} resultados a ${cop(g.costoResultado)} (${Math.round(Math.abs(g.diferencia ?? 0) * 100)} % más barato que la cuenta). Segmentación: ${g.resumen}.`,
      evidencia: [`Gasto ${cop(g.gasto)}`, `Impresiones ${g.impresiones.toLocaleString("es-CO")}`, g.estado === "activo" ? "Sigue al aire" : "Está apagado: se puede volver a prender tal cual"],
      conjuntoId: g.conjuntoId,
    });
  }
  return s;
}

export function analizarPublicos(publicos: ReadonlyArray<Publico>, b: Benchmarks): ResultadoPublicos {
  if (!publicos.length) {
    return { sinDatos: true, desde: null, hasta: null, referencia: null, conjuntos: 0, ganadores: [], todos: [], porTipo: [], porEdad: [], porGenero: [], porRadio: [], sugerencias: [] };
  }
  const { evaluados, referencia } = evaluarPublicos(publicos, b);
  const base = {
    sinDatos: false,
    desde: publicos.map((p) => p.desde).sort()[0] ?? null,
    hasta: publicos.map((p) => p.hasta).sort().at(-1) ?? null,
    referencia,
    conjuntos: evaluados.length,
    ganadores: evaluados.filter((p) => p.cuadrante === "ganador"),
    todos: evaluados,
    porTipo: agrupar(evaluados, (p) => p.segmentacion.tipo, (k) => NOMBRE_TIPO[k as TipoPublico]),
    porEdad: agrupar(evaluados, tramoEdad, (k) => k),
    porGenero: agrupar(evaluados, (p) => p.segmentacion.genero, (k) => NOMBRE_GENERO[k as keyof typeof NOMBRE_GENERO]),
    porRadio: agrupar(evaluados, tramoRadio, (k) => k),
  };
  return { ...base, sugerencias: sugerir(base) };
}
