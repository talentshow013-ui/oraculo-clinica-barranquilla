/**
 * Públicos: la segmentación de cada conjunto de anuncios (a quién se le muestra) y lo que rindió
 * en el periodo. Viene de `ads_get_ad_entities` a nivel conjunto con el campo `targeting` y las
 * métricas agregadas del rango (sin `time_increment`). Meta devuelve los arreglos como objetos con
 * claves "0","1"…; aquí se normalizan a listas y a palabras de la clínica.
 */
import type { Publico, Segmentacion, TipoPublico } from "@/lib/adapters/types";
import { esFruto, estadoMeta, numeroMeta, pesosMeta, resultadoMeta, type ResultadoCrudo, type ValorCrudo } from "./meta.mcp";

type Crudo = Record<string, unknown>;

/** Meta serializa listas como {"0": a, "1": b}: aquí vuelven a ser listas. */
function lista(v: unknown): unknown[] {
  if (Array.isArray(v)) return v;
  if (v && typeof v === "object") return Object.values(v as Record<string, unknown>);
  return [];
}

const nombreDe = (x: unknown): string | null => (x && typeof x === "object" && typeof (x as Crudo).name === "string" ? ((x as Crudo).name as string) : null);

function generoDe(t: Crudo): Segmentacion["genero"] {
  const g = lista(t.genders).map(Number);
  if (g.length === 1 && g[0] === 2) return "mujeres";
  if (g.length === 1 && g[0] === 1) return "hombres";
  return "todos";
}

function lugaresDe(geo: Crudo | undefined): { lugares: string[]; radioKm: number | null } {
  if (!geo) return { lugares: [], radioKm: null };
  const lugares: string[] = [];
  let radioKm: number | null = null;
  for (const p of lista(geo.places) as Crudo[]) {
    const n = nombreDe(p);
    const r = typeof p.radius === "number" ? p.radius : null;
    if (n) lugares.push(r ? `${n} (${r} km)` : n);
    if (r !== null) radioKm = radioKm === null ? r : Math.max(radioKm, r);
  }
  for (const c of lista(geo.cities) as Crudo[]) {
    const n = nombreDe(c);
    if (n) lugares.push(n);
  }
  for (const r of lista(geo.regions) as Crudo[]) {
    const n = nombreDe(r);
    if (n) lugares.push(n);
  }
  for (const c of lista(geo.countries)) if (typeof c === "string") lugares.push(c);
  return { lugares, radioKm };
}

function excluidosDe(geo: Crudo | undefined): string[] {
  if (!geo) return [];
  const salida: string[] = [];
  for (const clave of ["regions", "cities", "places"]) for (const x of lista(geo[clave]) as Crudo[]) {
    const n = nombreDe(x);
    if (n) salida.push(n);
  }
  return salida;
}

function interesesDe(t: Crudo): string[] {
  const salida: string[] = [];
  for (const spec of lista(t.flexible_spec) as Crudo[]) {
    for (const clave of ["interests", "behaviors", "work_positions", "education_majors", "family_statuses", "life_events", "industries"]) {
      for (const x of lista(spec[clave]) as Crudo[]) {
        const n = nombreDe(x);
        if (n) salida.push(n.trim());
      }
    }
  }
  return salida;
}

function publicosDe(t: Crudo): { personalizados: string[]; similares: string[]; excluidos: string[] } {
  const personalizados: string[] = [];
  const similares: string[] = [];
  for (const c of lista(t.custom_audiences) as Crudo[]) {
    const n = nombreDe(c) ?? String(c.id ?? "");
    if (String(c.subtype ?? "").toUpperCase() === "LOOKALIKE" || /similar|lookalike|lal\b/i.test(n)) similares.push(n);
    else personalizados.push(n);
  }
  const excluidos = (lista(t.excluded_custom_audiences) as Crudo[]).map((c) => nombreDe(c) ?? String(c.id ?? "")).filter(Boolean);
  return { personalizados, similares, excluidos };
}

/** Del más automático al más manual: advantage → similar → remarketing (personalizado) → intereses → amplio. */
function tipoDe(advantage: boolean, similares: string[], personalizados: string[], intereses: string[]): TipoPublico {
  if (advantage) return "advantage";
  if (similares.length) return "similar";
  if (personalizados.length) return "remarketing";
  if (intereses.length) return "intereses";
  return "amplio";
}

export function perfilarSegmentacion(targeting: unknown): Segmentacion {
  const t = (targeting && typeof targeting === "object" ? targeting : {}) as Crudo;
  const { lugares, radioKm } = lugaresDe(t.geo_locations as Crudo | undefined);
  const { personalizados, similares, excluidos: publicosExcluidos } = publicosDe(t);
  const intereses = interesesDe(t);
  const auto = t.targeting_automation as Crudo | undefined;
  const advantage = Number(auto?.advantage_audience ?? 0) === 1;
  const plataformas = lista(t.effective_publisher_platforms ?? t.publisher_platforms).map(String);
  return {
    edadMin: typeof t.age_min === "number" ? t.age_min : null,
    edadMax: typeof t.age_max === "number" ? t.age_max : null,
    genero: generoDe(t),
    lugares,
    radioKm,
    excluidos: excluidosDe(t.excluded_geo_locations as Crudo | undefined),
    intereses,
    personalizados,
    similares,
    publicosExcluidos,
    advantage,
    plataformas,
    tipo: tipoDe(advantage, similares, personalizados, intereses),
  };
}

const texto = (v: unknown): string | null => (typeof v === "string" && v.trim() !== "" ? v.trim() : typeof v === "number" ? String(v) : null);

/** Archivo crudo: {ad_entities: "<json>", capturado?, desde?, hasta?}. */
export function parsearPublicosMeta(contenido: string, cuentaId: string): Publico[] {
  const obj = JSON.parse(contenido) as { ad_entities?: unknown; capturado?: unknown; desde?: unknown; hasta?: unknown };
  const filas = (typeof obj.ad_entities === "string" ? JSON.parse(obj.ad_entities) : obj.ad_entities) as Crudo[];
  if (!Array.isArray(filas)) return [];
  const capturado = texto(obj.capturado) ?? new Date().toISOString().slice(0, 10);
  const desde = texto(obj.desde) ?? capturado;
  const hasta = texto(obj.hasta) ?? capturado;
  return filas
    .filter((f) => texto(f.id))
    .map((f) => {
      const resultado = resultadoMeta(f.results as ResultadoCrudo | ValorCrudo);
      const aprendizaje = (f.learning_stage_info as Crudo | undefined)?.status;
      return {
        fuente: "meta" as const,
        cuentaId,
        conjuntoId: texto(f.id)!,
        nombre: texto(f.name) ?? texto(f.id)!,
        campanaId: texto(f.campaign_id),
        campanaNombre: texto(f.campaign_name),
        estado: estadoMeta(f.status as ValorCrudo, f.effective_status as ValorCrudo),
        objetivo: texto(f.optimization_goal),
        destino: texto(f.destination_type),
        presupuestoDiario: f.daily_budget !== undefined && f.daily_budget !== null ? pesosMeta(f.daily_budget as ValorCrudo) : null,
        creado: typeof f.created_time === "string" ? f.created_time.slice(0, 10) : null,
        aprendizaje: typeof aprendizaje === "string" ? aprendizaje : null,
        segmentacion: perfilarSegmentacion(f.targeting),
        desde,
        hasta,
        gasto: pesosMeta(f.amount_spent as ValorCrudo),
        impresiones: Math.round(numeroMeta(f.impressions as ValorCrudo) ?? 0),
        alcance: numeroMeta(f.reach as ValorCrudo) === null ? null : Math.round(numeroMeta(f.reach as ValorCrudo)!),
        clicsEnlace: Math.round(numeroMeta(f.link_click as ValorCrudo) ?? 0),
        resultados: esFruto(resultado.tipo) ? (resultado.valor ?? 0) : 0,
        tipoResultado: resultado.tipo,
      };
    });
}
