/**
 * Capa de acceso única. La interfaz solo importa desde aquí.
 *
 * `fuenteActiva` elige demostración (seed) o archivo real por ORACULO_FUENTE.
 * `correrMotor` ejecuta todo el motor determinista sobre un lote y devuelve
 * un resultado listo para pintar. Sin I/O de red, sin llamadas a modelos.
 */
import type { EstadoFuente, FuenteDatos, LoteDatos } from "@/lib/adapters/types";
import { FuenteArchivo } from "@/lib/adapters/archivo.adapter";
import { FuenteMock } from "@/lib/adapters/mock.adapter";
import { benchmarks, type Benchmarks } from "@/config/benchmarks";
import { cliente as clientePorDefecto, type ConfigCliente } from "@/config/cliente";
import { construirContexto, ejecutarReglas, type ContextoDiagnostico, type ErrorRegla, type Hallazgo } from "@/lib/diagnostics/engine";
import { REGLAS } from "@/lib/diagnostics/rules";
import { fugaMasCara, type MetricasNegocio, type PasoEmbudo } from "@/lib/metrics/funnel";
import type { EvaluacionCreativo } from "@/lib/metrics/creative";
import { analizarRadar, puntuacionLongevidad, type ResultadoRadar } from "@/lib/competitive";
import { generarOportunidades, type Oportunidad } from "@/lib/opportunities";
import { aplicarLentes, type ResultadoLente } from "@/lib/frameworks";
import { CATALOGO, metricasMaestras, type MetricaCatalogo } from "@/lib/metrics/catalog";
import { K_MINIMO } from "@/lib/privacy";
import { hoyBogota } from "@/lib/format/fechas";
import { resolverMetrica, type ValorMetrica } from "@/lib/metrics/resolver";
import type { Agregado, PuntoSerie } from "@/lib/metrics/core";

export type NombreFuente = "seed" | "archivo";

export function fuenteActiva(nombre: string | undefined = process.env.ORACULO_FUENTE): FuenteDatos {
  return nombre === "archivo" ? new FuenteArchivo() : new FuenteMock();
}

export interface ResultadoMotor {
  lote: LoteDatos;
  hoy: string;
  contexto: ContextoDiagnostico;
  total: Agregado;
  reciente: Agregado;
  previa: Agregado;
  serie: PuntoSerie[];
  embudo: PasoEmbudo[];
  fugaMasCara: PasoEmbudo | null;
  negocio: MetricasNegocio;
  creativos: EvaluacionCreativo[];
  hallazgos: Hallazgo[];
  erroresReglas: ErrorRegla[];
  plataEnRiesgoTotal: number | null;
  oportunidades: Oportunidad[];
  radar: ResultadoRadar;
  lentes: ResultadoLente[];
  catalogo: ReadonlyArray<MetricaCatalogo>;
  maestras: ValorMetrica[];
  privacidad: { segmentosOcultos: number; k: number };
  fuentes: EstadoFuente[];
  cliente: ConfigCliente;
  benchmarks: Benchmarks;
}

let cache: { clave: string; resultado: Promise<ResultadoMotor> } | null = null;

export async function obtenerLote(fuente: FuenteDatos = fuenteActiva()): Promise<LoteDatos> {
  // El rango lo define el archivo: se pide "todo" y el adapter recorta a lo que tiene.
  return fuente.obtener({ desde: "2000-01-01", hasta: "2999-12-31" });
}

/** Corre el motor completo. Puro salvo por la fecha de hoy (para datos reales). */
export async function correrMotor(
  lote?: LoteDatos,
  opciones: { cliente?: ConfigCliente; benchmarks?: Benchmarks; fuente?: FuenteDatos } = {},
): Promise<ResultadoMotor> {
  const fuente = opciones.fuente ?? fuenteActiva();
  const cfg = opciones.cliente ?? clientePorDefecto;
  const b = opciones.benchmarks ?? benchmarks;
  const datos = lote ?? (await obtenerLote(fuente));

  // Con demostración, "hoy" es el último día del seed: no se analiza más allá de los datos.
  const hoy = datos.meta.origen === "seed" ? datos.meta.hasta : hoyBogota();

  // Longevidad de competencia: siempre recalculada aquí, nunca confiada a la fuente.
  const anunciosCompetencia = datos.anunciosCompetencia.map((a) => ({ ...a, puntuacionLongevidad: puntuacionLongevidad(a) }));
  const loteMotor: LoteDatos = { ...datos, anunciosCompetencia };

  const ctx = construirContexto(loteMotor, cfg, b, hoy);
  const diag = ejecutarReglas(ctx, REGLAS);
  const radar = analizarRadar(anunciosCompetencia, loteMotor.creativos, cfg, b, hoy);
  const oportunidades = generarOportunidades({
    hallazgos: diag.hallazgos,
    espaciosVacios: radar.espaciosVacios,
    ganadores: radar.ganadores,
    experimentos: loteMotor.experimentos,
    cliente: cfg,
    gastoQuincenal: ctx.reciente.gasto,
  });
  const lentes = aplicarLentes({ creativos: ctx.creativos, negocio: ctx.negocio, radar, hallazgos: diag.hallazgos, cliente: cfg, benchmarks: b });

  const parcial = {
    lote: loteMotor,
    hoy,
    contexto: ctx,
    total: ctx.total,
    reciente: ctx.reciente,
    previa: ctx.previa,
    serie: ctx.serie,
    embudo: ctx.embudo,
    fugaMasCara: fugaMasCara(ctx.embudo),
    negocio: ctx.negocio,
    creativos: ctx.creativos,
    hallazgos: diag.hallazgos,
    erroresReglas: diag.errores,
    plataEnRiesgoTotal: diag.plataEnRiesgoTotal,
    oportunidades,
    radar,
    lentes,
    catalogo: CATALOGO,
    privacidad: { segmentosOcultos: ctx.desglosesOcultos, k: K_MINIMO },
    cliente: cfg,
    benchmarks: b,
  };
  const maestras = metricasMaestras().map((m) => resolverMetrica(m, parcial));
  const fuentes = lote ? [] : await fuente.estado();
  return { ...parcial, maestras, fuentes };
}

/** Versión con caché por proceso para las páginas (Server Components). */
export async function motor(): Promise<ResultadoMotor> {
  const fuente = fuenteActiva();
  const clave = `${fuente.nombre}`;
  if (cache && cache.clave === clave && process.env.NODE_ENV === "production") return cache.resultado;
  const resultado = correrMotor(undefined, { fuente });
  cache = { clave, resultado };
  return resultado;
}
