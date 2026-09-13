/**
 * Laboratorio creativo: fatiga, matriz de decisión y vida útil. (§7.3)
 *
 * `sin_senal` no es un caso borde, es una salida de primera clase: matar un
 * creativo bueno por ruido estadístico es más caro que esperar tres días.
 */
import type { Creativo, InsightRow } from "@/lib/adapters/types";
import type { Benchmarks } from "@/config/benchmarks";
import { agregar, ctrEnlace, frecuencia, hookRate, holdRate, cpa, razon, serieDiaria, type Agregado } from "@/lib/metrics/core";

export type Cuadrante = "escalar" | "arreglar_gancho" | "arreglar_oferta" | "matar" | "sin_senal";

export interface ResultadoFatiga {
  /** 0 = fresco, 1 = agotado. null si no hay ventanas suficientes. */
  indice: number | null;
  ctrMejorVentana: number | null;
  ctrReciente: number | null;
  frecuenciaMejorVentana: number | null;
  frecuenciaReciente: number | null;
  caidaCtr: number | null;
  alzaFrecuencia: number | null;
  formulaVisible: string;
}

const VENTANA_DIAS = 7;

export const FORMULA_FATIGA =
  "Fatiga = caída del CTR de enlace (ventana reciente de 7 días vs la mejor ventana móvil de 7 días) " +
  "× (1 + alza de frecuencia en el mismo periodo), acotado a 0–1. Una caída de CTR con frecuencia " +
  "estable es ruido; con frecuencia subiendo es agotamiento real.";

/**
 * Índice de fatiga de un creativo a partir de sus filas diarias.
 * Ventanas móviles de 7 días; se compara la última contra la mejor.
 */
export function indiceFatiga(filas: ReadonlyArray<InsightRow>): ResultadoFatiga {
  const serie = serieDiaria(filas);
  const vacio: ResultadoFatiga = {
    indice: null,
    ctrMejorVentana: null,
    ctrReciente: null,
    frecuenciaMejorVentana: null,
    frecuenciaReciente: null,
    caidaCtr: null,
    alzaFrecuencia: null,
    formulaVisible: FORMULA_FATIGA,
  };
  if (serie.length < VENTANA_DIAS * 2) return vacio;

  // Ventanas móviles: agregamos crudos por ventana y recalculamos las razones.
  const ventanas: { ctr: number | null; frec: number | null }[] = [];
  for (let fin = VENTANA_DIAS; fin <= serie.length; fin++) {
    const filasVentana = filas.filter((f) => {
      const desde = serie[fin - VENTANA_DIAS]?.fecha ?? "";
      const hasta = serie[fin - 1]?.fecha ?? "";
      return f.fecha >= desde && f.fecha <= hasta;
    });
    const a = agregar(filasVentana);
    ventanas.push({ ctr: ctrEnlace(a), frec: frecuencia(a) });
  }

  const reciente = ventanas[ventanas.length - 1];
  if (!reciente || reciente.ctr === null) return vacio;

  // La mejor ventana histórica, excluyendo la reciente.
  let mejor: { ctr: number; frec: number | null } | null = null;
  for (const v of ventanas.slice(0, -1)) {
    if (v.ctr === null) continue;
    if (mejor === null || v.ctr > mejor.ctr) mejor = { ctr: v.ctr, frec: v.frec };
  }
  if (mejor === null || mejor.ctr === 0) return vacio;

  const caidaCtr = Math.max(0, 1 - reciente.ctr / mejor.ctr);
  const alza =
    mejor.frec !== null && reciente.frec !== null && mejor.frec > 0
      ? Math.max(0, reciente.frec / mejor.frec - 1)
      : 0;
  const indice = Math.min(1, caidaCtr * (1 + alza));

  return {
    indice,
    ctrMejorVentana: mejor.ctr,
    ctrReciente: reciente.ctr,
    frecuenciaMejorVentana: mejor.frec,
    frecuenciaReciente: reciente.frec,
    caidaCtr,
    alzaFrecuencia: alza,
    formulaVisible: FORMULA_FATIGA,
  };
}

// ---------------------------------------------------------------------------
// Matriz de decisión: atención (hook rate) × costo por resultado
// ---------------------------------------------------------------------------

export interface SenalesCreativo {
  hookRate: number | null;
  /** Proxy de atención para formatos sin video. */
  ctrEnlace?: number | null;
  costoResultado: number | null;
  impresiones: number;
  resultados: number;
}

/** CTR de enlace considerado "atención suficiente" en formatos sin video. */
const CTR_ENLACE_ATENCION = 0.015;

/**
 * Clasifica contra el costo por resultado de referencia de la cuenta
 * (mediana o promedio de la cuenta): más barato que la referencia = convierte.
 */
export function clasificarCuadrante(s: SenalesCreativo, costoReferencia: number | null, b: Benchmarks): Cuadrante {
  if (s.impresiones < b.minimoImpresionesSenal.valor || s.resultados < b.minimoResultadosSenal.valor) {
    return "sin_senal";
  }
  if (costoReferencia === null || s.costoResultado === null) return "sin_senal";

  const atencion =
    s.hookRate !== null
      ? s.hookRate >= b.hookRateMinimo.valor
      : s.ctrEnlace !== null && s.ctrEnlace !== undefined
        ? s.ctrEnlace >= CTR_ENLACE_ATENCION
        : null;
  if (atencion === null) return "sin_senal";

  const convierte = s.costoResultado <= costoReferencia;

  if (atencion && convierte) return "escalar";
  if (!atencion && convierte) return "arreglar_gancho";
  if (atencion && !convierte) return "arreglar_oferta";
  return "matar";
}

export const ACCION_CUADRANTE: Record<Cuadrante, string> = {
  escalar: "Sube presupuesto por tramos y produce 3 variantes antes de que fatigue.",
  arreglar_gancho: "La oferta convierte pero pocos se detienen. Cambia solo los primeros 3 segundos.",
  arreglar_oferta: "Detiene el scroll pero no vende. El problema está en la oferta o en la página.",
  matar: "No retiene ni convierte. Apágalo.",
  sin_senal: "Datos insuficientes. No se decide: espera a tener señal.",
};

// ---------------------------------------------------------------------------
// Vida útil y evaluación
// ---------------------------------------------------------------------------

/**
 * Días desde el primer gasto hasta que el CTR diario cae por debajo de
 * (1 − caidaCtrFatiga) × el mejor CTR de sus primeros 7 días. null si no cae.
 */
export function vidaUtil(filas: ReadonlyArray<InsightRow>, b: Benchmarks): number | null {
  const serie = serieDiaria(filas);
  if (serie.length < VENTANA_DIAS + 1) return null;
  const inicial = agregar(filas.filter((f) => f.fecha <= (serie[VENTANA_DIAS - 1]?.fecha ?? "")));
  const ctrInicial = ctrEnlace(inicial);
  if (ctrInicial === null || ctrInicial === 0) return null;
  const umbral = ctrInicial * (1 - b.caidaCtrFatiga.valor);
  for (let i = VENTANA_DIAS; i < serie.length; i++) {
    const c = ctrEnlace(serie[i]!.agregado);
    if (c !== null && c < umbral) return i;
  }
  return null;
}

export interface EvaluacionCreativo {
  creativo: Creativo;
  agregado: Agregado;
  hookRate: number | null;
  holdRate: number | null;
  ctrEnlace: number | null;
  costoResultado: number | null;
  cuadrante: Cuadrante;
  accion: string;
  fatiga: ResultadoFatiga;
  vidaUtilDias: number | null;
  diasActivo: number;
}

/** Costo por resultado de referencia: el de toda la cuenta (sumas, no promedios). */
export function costoReferenciaCuenta(filas: ReadonlyArray<InsightRow>): number | null {
  return cpa(agregar(filas));
}

export function evaluarCreativos(
  creativos: ReadonlyArray<Creativo>,
  filas: ReadonlyArray<InsightRow>,
  b: Benchmarks,
): EvaluacionCreativo[] {
  const referencia = costoReferenciaCuenta(filas);
  const porAnuncio = new Map<string, InsightRow[]>();
  for (const f of filas) {
    const lista = porAnuncio.get(f.id);
    if (lista) lista.push(f);
    else porAnuncio.set(f.id, [f]);
  }

  return creativos.map((c) => {
    const propias = porAnuncio.get(c.anuncioId) ?? [];
    const a = agregar(propias);
    const hr = hookRate(a);
    const ctrL = ctrEnlace(a);
    const costo = cpa(a);
    const cuadrante = clasificarCuadrante(
      { hookRate: hr, ctrEnlace: ctrL, costoResultado: costo, impresiones: a.impresiones, resultados: a.resultados },
      referencia,
      b,
    );
    return {
      creativo: c,
      agregado: a,
      hookRate: hr,
      holdRate: holdRate(a),
      ctrEnlace: ctrL,
      costoResultado: costo,
      cuadrante,
      accion: ACCION_CUADRANTE[cuadrante],
      fatiga: indiceFatiga(propias),
      vidaUtilDias: vidaUtil(propias, b),
      diasActivo: a.dias || c.diasActivo,
    };
  });
}

/** Creativos nuevos (primer gasto) por semana: ritmo de renovación. */
export function ritmoRenovacion(creativos: ReadonlyArray<Creativo>, desde: string, hasta: string): number | null {
  const nuevos = creativos.filter((c) => c.fechaPrimerGasto >= desde && c.fechaPrimerGasto <= hasta).length;
  const semanas = razon(
    (Date.parse(`${hasta}T00:00:00Z`) - Date.parse(`${desde}T00:00:00Z`)) / 86_400_000 + 1,
    7,
  );
  return razon(nuevos, semanas);
}
