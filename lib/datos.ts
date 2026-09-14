/**
 * Capa de acceso única. La interfaz solo importa desde aquí.
 *
 * `fuenteActiva` elige demostración (seed) o archivo real por ORACULO_FUENTE.
 * `correrMotor` ejecuta todo el motor determinista sobre un lote y devuelve
 * un resultado listo para pintar. Sin I/O de red, sin llamadas a modelos.
 *
 * Cuentas publicitarias: el panel analiza UNA cuenta a la vez (cookie `cuenta`).
 * Nunca se suman cuentas por defecto; el radar de mercado es compartido.
 */
import type { BreakdownRow, EstadoFuente, FuenteDatos, LoteDatos } from "@/lib/adapters/types";
import { FuenteArchivo } from "@/lib/adapters/archivo.adapter";
import { FuenteMock } from "@/lib/adapters/mock.adapter";
import { benchmarks, type Benchmarks } from "@/config/benchmarks";
import { cliente as clientePorDefecto, type ConfigCliente, type CuentaPublicitaria as CuentaConfig } from "@/config/cliente";
import { construirContexto, ejecutarReglas, type ContextoDiagnostico, type ErrorRegla, type Hallazgo } from "@/lib/diagnostics/engine";
import { REGLAS } from "@/lib/diagnostics/rules";
import { fugaMasCara, type MetricasNegocio, type PasoEmbudo } from "@/lib/metrics/funnel";
import type { EvaluacionCreativo } from "@/lib/metrics/creative";
import { analizarRadar, puntuacionLongevidad, type ResultadoRadar } from "@/lib/competitive";
import { generarOportunidades, type Oportunidad } from "@/lib/opportunities";
import { aplicarLentes, type ResultadoLente } from "@/lib/frameworks";
import { CATALOGO, metricasMaestras, type MetricaCatalogo } from "@/lib/metrics/catalog";
import { AVISO_PANEL, K_MINIMO } from "@/lib/privacy";
import { hoyBogota, rangoDias, sumarDias } from "@/lib/format/fechas";
import { resolverMetrica, type ValorMetrica } from "@/lib/metrics/resolver";
import * as core from "@/lib/metrics/core";
import { compararCampanas, resumirCampanas, type ComparacionCampanas, type ResumenCampana } from "@/lib/metrics/campanas";
import { fusionarResultados, leerResultados, type RegistroPauta } from "@/lib/resultados";
import { compararVarias, creativosDeCampana, veredictoCampana, type ComparacionVarias, type CreativoDeCampana, type VeredictoCampana } from "@/lib/metrics/veredicto";

export { resolverMetrica, compararCampanas, compararVarias };
export type { ResumenCampana, ComparacionCampanas, ComparacionVarias, RegistroPauta, VeredictoCampana, CreativoDeCampana };

export type NombreFuente = "seed" | "archivo";

export function fuenteActiva(nombre: string | undefined = process.env.ORACULO_FUENTE): FuenteDatos {
  return nombre === "archivo" ? new FuenteArchivo() : new FuenteMock();
}

// ---------------------------------------------------------------------------
// Tipos de vista (derivados del motor; nada se calcula en la interfaz)
// ---------------------------------------------------------------------------

export interface CuentaPublicitaria extends CuentaConfig {
  /** false = sin pauta en el periodo (se muestra, pero se avisa). */
  activa: boolean;
  /** ISO con zona; null si nunca. */
  ultimaSincronizacion: string | null;
}

/** Agregado (sumas de crudos) + derivadas recalculadas desde las sumas. */
export type AgregadoVista = core.Agregado & {
  ctrEnlace: number | null;
  ctr: number | null;
  cpm: number | null;
  cpc: number | null;
  cpcEnlace: number | null;
  costoResultado: number | null;
  frecuencia: number | null;
  hookRate: number | null;
  holdRate: number | null;
  tasaConversacion: number | null;
  tasaRespuesta: number | null;
  costoConversacion: number | null;
  fugaAterrizaje: number | null;
};

export interface PuntoSerieVista {
  fecha: string;
  /** null en un día sin datos (hueco): la gráfica corta la línea. */
  agregado: AgregadoVista | null;
}

export type NegocioVista = MetricasNegocio & {
  /** Retorno que declara la plataforma (valor de conversión / gasto). No es la caja. */
  roasDeclarado: number | null;
};

/** Desglose visible (k ≥ 5) enriquecido para Audiencias. */
export type DesgloseVista = BreakdownRow & {
  costoResultado: number | null;
  fueraDeRadio: boolean;
  fueraDeHorario: boolean;
};

export function conDerivadas(a: core.Agregado): AgregadoVista {
  return {
    ...a,
    ctrEnlace: core.ctrEnlace(a),
    ctr: core.ctr(a),
    cpm: core.cpm(a),
    cpc: core.cpc(a),
    cpcEnlace: core.cpcEnlace(a),
    costoResultado: core.cpa(a),
    frecuencia: core.frecuencia(a),
    hookRate: core.hookRate(a),
    holdRate: core.holdRate(a),
    tasaConversacion: core.tasaConversacion(a),
    tasaRespuesta: core.tasaRespuesta(a),
    costoConversacion: core.costoConversacion(a),
    fugaAterrizaje: core.fugaAterrizaje(a),
  };
}

export interface ResultadoMotor {
  /** La cuenta analizada en esta petición y todas las disponibles (principal primero). */
  cuenta: CuentaPublicitaria;
  cuentas: CuentaPublicitaria[];
  lote: LoteDatos;
  hoy: string;
  contexto: ContextoDiagnostico;
  total: AgregadoVista;
  reciente: AgregadoVista;
  previa: AgregadoVista;
  serie: PuntoSerieVista[];
  embudo: PasoEmbudo[];
  fugaMasCara: PasoEmbudo | null;
  negocio: NegocioVista;
  creativos: EvaluacionCreativo[];
  hallazgos: Hallazgo[];
  erroresReglas: ErrorRegla[];
  plataEnRiesgoTotal: number | null;
  oportunidades: Oportunidad[];
  radar: ResultadoRadar;
  lentes: ResultadoLente[];
  catalogo: ReadonlyArray<MetricaCatalogo>;
  maestras: ValorMetrica[];
  desgloses: DesgloseVista[];
  /** Cada pauta con cara propia (viva, pausada o archivada) en todo el periodo del lote. */
  campanas: ResumenCampana[];
  /** Resultados que la clínica registró a mano por campaña (los de esta cuenta). */
  resultadosPauta: RegistroPauta[];
  privacidad: { segmentosOcultos: number; k: number; AVISO_PANEL: string };
  fuentes: EstadoFuente[];
  cliente: ConfigCliente;
  benchmarks: Benchmarks;
}

// ---------------------------------------------------------------------------
// Cuentas
// ---------------------------------------------------------------------------

function normalizarTexto(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

/** Filtra el lote a una cuenta. El radar (competidores/anuncios de competencia) es compartido. */
export function filtrarPorCuenta(lote: LoteDatos, cuentaId: string): LoteDatos {
  const insights = lote.insights.filter((i) => i.cuentaId === cuentaId);
  const campanas = new Set(insights.filter((i) => i.nivel === "campana").map((i) => i.id));
  const anuncios = new Set(insights.filter((i) => i.nivel === "anuncio").map((i) => i.id));
  // Si la fuente no trae nivel campaña, se deduce por padreId de conjuntos → campaña.
  for (const i of insights) if (i.nivel === "conjunto" && i.padreId) campanas.add(i.padreId);
  return {
    ...lote,
    insights,
    desgloses: lote.desgloses.filter((d) => d.cuentaId === cuentaId),
    creativos: lote.creativos.filter((c) => anuncios.has(c.anuncioId)),
    embudo: lote.embudo.filter((r) => r.campanaId === null || campanas.has(r.campanaId)),
  };
}

function resolverCuentas(lote: LoteDatos, cfg: ConfigCliente, fuentes: EstadoFuente[]): CuentaPublicitaria[] {
  const conPauta = new Set(lote.insights.filter((i) => i.gasto > 0).map((i) => i.cuentaId));
  const ultima = fuentes.find((f) => f.conectado)?.ultimaActualizacion ?? lote.meta.generadoEn ?? null;
  const configuradas: CuentaPublicitaria[] = cfg.cuentasPublicitarias.map((c) => ({ ...c, activa: conPauta.has(c.id), ultimaSincronizacion: ultima }));
  // Cuentas que aparecen en los datos y no están en la configuración: se muestran con su id.
  const extra = [...conPauta].filter((id) => !cfg.cuentasPublicitarias.some((c) => c.id === id)).map<CuentaPublicitaria>((id) => ({ id, nombre: id, plataforma: "meta", moneda: "COP", activa: true, ultimaSincronizacion: ultima }));
  return [...configuradas, ...extra];
}

async function cuentaDesdeCookie(): Promise<string | undefined> {
  try {
    const { cookies } = await import("next/headers");
    return (await cookies()).get("cuenta")?.value;
  } catch {
    return undefined; // fuera de una petición (scripts, tests, compilación)
  }
}

// ---------------------------------------------------------------------------
// Resultados por pauta (datos/resultados.json)
// ---------------------------------------------------------------------------

/** Un archivo dañado no tumba el panel: se ignora y la fuente lo dice. */
function leerResultadosSeguros(): RegistroPauta[] {
  try {
    return leerResultados();
  } catch {
    return [];
  }
}

function estadoResultados(registros: ReadonlyArray<RegistroPauta>): EstadoFuente {
  const ultimo = registros[0];
  return {
    id: "resultados",
    etiquetaPublica: "Resultados de la clínica por campaña (registrados en el panel)",
    conectado: registros.length > 0,
    ultimaActualizacion: ultimo?.registradoEn ?? null,
    detalle: ultimo ? `${registros.length} ${registros.length === 1 ? "campaña con resultados registrados" : "campañas con resultados registrados"}.` : "Todavía no se han registrado resultados. Se hace en la pantalla Campañas, campaña por campaña.",
  };
}

// ---------------------------------------------------------------------------
// Motor
// ---------------------------------------------------------------------------

export async function obtenerLote(fuente: FuenteDatos = fuenteActiva()): Promise<LoteDatos> {
  // El rango lo define el archivo: se pide "todo" y el adapter recorta a lo que tiene.
  return fuente.obtener({ desde: "2000-01-01", hasta: "2999-12-31" });
}

export interface OpcionesMotor {
  cliente?: ConfigCliente;
  benchmarks?: Benchmarks;
  fuente?: FuenteDatos;
  /** Id de la cuenta a analizar; desconocida o ausente → principal. */
  cuentaId?: string;
  /** Resultados por pauta; si no se pasan y no hay lote explícito, se leen de datos/resultados.json. */
  resultados?: RegistroPauta[];
}

/** Corre el motor completo sobre UNA cuenta. Puro salvo por la fecha de hoy (para datos reales). */
export async function correrMotor(lote?: LoteDatos, opciones: OpcionesMotor = {}): Promise<ResultadoMotor> {
  const fuente = opciones.fuente ?? fuenteActiva();
  const cfg = opciones.cliente ?? clientePorDefecto;
  const b = opciones.benchmarks ?? benchmarks;
  const resultadosTodos = opciones.resultados ?? (lote ? [] : leerResultadosSeguros());
  const datosCompletos = lote ?? (await obtenerLote(fuente));
  const fuentes = lote ? [] : [...(await fuente.estado()), estadoResultados(resultadosTodos)];

  const cuentas = resolverCuentas(datosCompletos, cfg, fuentes);
  const principal = cuentas[0] ?? { id: "sin_cuenta", nombre: "Sin cuenta", plataforma: "meta" as const, moneda: "COP" as const, activa: false, ultimaSincronizacion: null };
  const cuenta = cuentas.find((c) => c.id === opciones.cuentaId) ?? principal;
  // Los resultados son por cuenta y campaña: se mezclan DESPUÉS de filtrar la cuenta.
  const resultadosPauta = resultadosTodos.filter((s) => s.cuentaId === cuenta.id);
  const datos = fusionarResultados(filtrarPorCuenta(datosCompletos, cuenta.id), resultadosPauta);

  // Con demostración, "hoy" es el último día del seed: no se analiza más allá de los datos.
  const hoy = datos.meta.origen === "seed" ? datos.meta.hasta : hoyBogota();

  // Longevidad de competencia: siempre recalculada aquí, nunca confiada a la fuente.
  const anunciosCompetencia = datos.anunciosCompetencia.map((a) => ({ ...a, puntuacionLongevidad: puntuacionLongevidad(a) }));
  const loteMotor: LoteDatos = { ...datos, anunciosCompetencia };

  const ctx = construirContexto(loteMotor, cfg, b, hoy);
  const diag = ejecutarReglas(ctx, REGLAS);
  const radar = analizarRadar(anunciosCompetencia, loteMotor.creativos, cfg, b, hoy, loteMotor.competidores);
  const oportunidades = generarOportunidades({
    hallazgos: diag.hallazgos,
    espaciosVacios: radar.espaciosVacios,
    ganadores: radar.ganadores,
    experimentos: loteMotor.experimentos,
    cliente: cfg,
    gastoQuincenal: ctx.reciente.gasto,
  });
  const lentes = aplicarLentes({ creativos: ctx.creativos, negocio: ctx.negocio, radar, hallazgos: diag.hallazgos, cliente: cfg, benchmarks: b });

  // Serie diaria completa: los huecos van con agregado null para que la gráfica los muestre.
  const porFecha = new Map(ctx.serie.map((p) => [p.fecha, p.agregado]));
  const serie: PuntoSerieVista[] = rangoDias(loteMotor.meta.desde, loteMotor.meta.hasta).map((fecha) => {
    const a = porFecha.get(fecha);
    return { fecha, agregado: a ? conDerivadas(a) : null };
  });

  const zonas = new Set(cfg.zonasValidas.map(normalizarTexto));
  const { inicio, fin } = cfg.horarioAtencion;
  // Un segmento por dimensión × valor: se SUMAN los crudos de todos los días y se recalculan las
  // razones. nRegistros = máximo diario (cota inferior de personas distintas; nunca la suma).
  const porSegmento = new Map<string, DesgloseVista>();
  for (const d of ctx.desglosesVisibles) {
    const clave = `${d.dimension}|${d.valor}`;
    const acc = porSegmento.get(clave);
    if (!acc) {
      porSegmento.set(clave, { ...d, fecha: loteMotor.meta.hasta, costoResultado: null, fueraDeRadio: false, fueraDeHorario: false });
      continue;
    }
    acc.gasto += d.gasto;
    acc.impresiones += d.impresiones;
    acc.clics += d.clics;
    acc.clicsEnlace += d.clicsEnlace;
    acc.resultados += d.resultados;
    acc.alcance = core.sumaNullable([acc.alcance, d.alcance]);
    acc.conversacionesIniciadas = core.sumaNullable([acc.conversacionesIniciadas, d.conversacionesIniciadas]);
    acc.conversacionesRespondidas = core.sumaNullable([acc.conversacionesRespondidas, d.conversacionesRespondidas]);
    acc.nRegistros = Math.max(acc.nRegistros, d.nRegistros);
  }
  const desgloses: DesgloseVista[] = [...porSegmento.values()].map((d) => ({
    ...d,
    costoResultado: core.razon(d.gasto, d.resultados),
    fueraDeRadio: d.dimension === "ubicacion" && !zonas.has(normalizarTexto(d.valor)),
    fueraDeHorario: d.dimension === "hora" && (Number(d.valor) < inicio || Number(d.valor) >= fin),
  }));

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
    privacidad: { segmentosOcultos: ctx.desglosesOcultos, k: K_MINIMO, AVISO_PANEL },
    cliente: cfg,
    benchmarks: b,
  };
  const maestras = metricasMaestras().map((m) => resolverMetrica(m, parcial));

  return {
    ...parcial,
    cuenta,
    cuentas,
    total: conDerivadas(ctx.total),
    reciente: conDerivadas(ctx.reciente),
    previa: conDerivadas(ctx.previa),
    serie,
    negocio: { ...ctx.negocio, roasDeclarado: core.roas(ctx.total) },
    desgloses,
    campanas: resumirCampanas(loteMotor.insights, { desde: loteMotor.meta.desde, hasta: loteMotor.meta.hasta }, loteMotor.embudo),
    resultadosPauta,
    maestras,
    fuentes,
  };
}

/** Periodos que ofrece la pantalla de campañas. `todo` = todo lo que tiene el lote. */
export const PERIODOS_CAMPANAS = ["14", "30", "90", "todo"] as const;
export type PeriodoCampanas = (typeof PERIODOS_CAMPANAS)[number];

/** Las campañas de la cuenta analizada recortadas a un periodo (contado hacia atrás desde `hoy`). */
export function campanasEnPeriodo(r: Pick<ResultadoMotor, "lote" | "hoy" | "campanas">, periodo: string | undefined): { periodo: PeriodoCampanas; desde: string; hasta: string; campanas: ResumenCampana[] } {
  const p: PeriodoCampanas = (PERIODOS_CAMPANAS as ReadonlyArray<string>).includes(periodo ?? "") ? (periodo as PeriodoCampanas) : "todo";
  const hasta = r.lote.meta.hasta < r.hoy ? r.lote.meta.hasta : r.hoy;
  if (p === "todo") return { periodo: p, desde: r.lote.meta.desde, hasta, campanas: r.campanas };
  const desde = sumarDias(hasta, -(Number(p) - 1));
  return { periodo: p, desde, hasta, campanas: resumirCampanas(r.lote.insights, { desde, hasta }, r.lote.embudo) };
}

/**
 * Para las páginas (Server Components): lee la cuenta de la cookie. Caché por cuenta en producción,
 * con vencimiento: en la VPS los datos se renuevan cada mañana sin reiniciar el panel.
 */
const cache = new Map<string, { promesa: Promise<ResultadoMotor>; creadoEn: number }>();
const CACHE_SEG = Number(process.env.ORACULO_CACHE_SEG ?? 600);

/** Tras guardar una semana de agenda, el siguiente motor() vuelve a calcular. */
export function invalidarCache(): void {
  cache.clear();
}

export async function motor(cuentaId?: string): Promise<ResultadoMotor> {
  const fuente = fuenteActiva();
  const id = cuentaId ?? (await cuentaDesdeCookie()) ?? "";
  const clave = `${fuente.nombre}|${id}`;
  const enCache = cache.get(clave);
  const vigente = enCache && Date.now() - enCache.creadoEn < CACHE_SEG * 1000;
  if (vigente && process.env.NODE_ENV === "production") return enCache.promesa;
  const promesa = correrMotor(undefined, { fuente, cuentaId: id || undefined });
  cache.set(clave, { promesa, creadoEn: Date.now() });
  return promesa;
}

/** «¿Cómo nos fue con esta pauta?»: veredicto con razones y sus creativos con lectura. null si la campaña no es de la cuenta. */
export function comoNosFue(r: Pick<ResultadoMotor, "campanas" | "benchmarks" | "lote" | "creativos">, campanaId: string): { veredicto: VeredictoCampana; creativos: CreativoDeCampana[] } | null {
  const c = r.campanas.find((x) => x.id === campanaId);
  if (!c) return null;
  return { veredicto: veredictoCampana(c, r.campanas, r.benchmarks), creativos: creativosDeCampana(campanaId, r.lote.insights, r.creativos) };
}

/** Las campañas que uno escoja (ids), lado a lado, en el periodo elegido. */
export function compararSeleccion(r: Pick<ResultadoMotor, "lote" | "hoy" | "campanas">, ids: ReadonlyArray<string>, periodo: string | undefined): ComparacionVarias {
  const { campanas } = campanasEnPeriodo(r, periodo);
  const elegidas = ids.map((id) => campanas.find((c) => c.id === id)).filter((c): c is ResumenCampana => c !== undefined);
  return compararVarias(elegidas);
}
