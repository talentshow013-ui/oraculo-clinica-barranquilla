/**
 * Radar de mercado. (§7.6)
 *
 * No existe forma pública de ver el presupuesto ni el retorno de un competidor.
 * Lo único observable y honesto es cuánto tiempo lleva un anuncio al aire.
 * Nadie sostiene 60 días una pieza que no le deja plata. Todo se ordena por
 * longevidad; nunca por métricas estimadas.
 */
import type { Angulo, AnuncioCompetidor, Competidor, Creativo } from "@/lib/adapters/types";
import { ANGULOS } from "@/lib/adapters/types";
import type { ConfigCliente } from "@/config/cliente";
import type { Benchmarks } from "@/config/benchmarks";
import { sumarDias } from "@/lib/format/fechas";
import { razon } from "@/lib/metrics/core";

// ---------------------------------------------------------------------------
// Longevidad
// ---------------------------------------------------------------------------

/**
 * f(días) saturante × activo × variantes. 0-1.
 * 60 días ≈ 0,63 del máximo por tiempo; las variantes suman hasta +50 %.
 */
export function puntuacionLongevidad(a: Pick<AnuncioCompetidor, "diasCorriendo" | "activo" | "variantesDelConcepto">): number {
  const tiempo = 1 - Math.exp(-a.diasCorriendo / 60);
  const variantes = 1 + Math.min(0.5, (Math.max(1, a.variantesDelConcepto) - 1) * 0.125);
  const actividad = a.activo ? 1 : 0.6;
  return Math.min(1, (tiempo * variantes * actividad) / 1.5);
}

/** Anuncios de 60+ días (umbral configurable), ordenados por longevidad. */
export function ganadoresProbados(anuncios: ReadonlyArray<AnuncioCompetidor>, b: Benchmarks): AnuncioCompetidor[] {
  return anuncios
    .filter((a) => a.diasCorriendo >= b.diasGanadorProbado.valor)
    .sort((x, y) => puntuacionLongevidad(y) - puntuacionLongevidad(x));
}

// ---------------------------------------------------------------------------
// Cadencia, entradas y salidas
// ---------------------------------------------------------------------------

const SEMANAS = 4;

export function cadenciaSemanal(anuncios: ReadonlyArray<AnuncioCompetidor>, hoy: string) {
  const desde = sumarDias(hoy, -(SEMANAS * 7 - 1));
  const nuevos = anuncios.filter((a) => a.primeraVez >= desde);
  const porCompetidor = new Map<string, number>();
  for (const a of nuevos) porCompetidor.set(a.competidorId, (porCompetidor.get(a.competidorId) ?? 0) + 1 / SEMANAS);
  return { total: nuevos.length / SEMANAS, porCompetidor, semanas: SEMANAS };
}

export function entradasYSalidas(anuncios: ReadonlyArray<AnuncioCompetidor>, hoy: string) {
  const desde = sumarDias(hoy, -(SEMANAS * 7 - 1));
  const entradas = anuncios.filter((a) => a.primeraVez >= desde);
  const salidas = anuncios.filter((a) => !a.activo && a.ultimaVez >= desde);
  /** Salieron en menos de 14 días: aprendes de su fracaso gratis. */
  const salidasRapidas = salidas.filter((a) => a.diasCorriendo < 14);
  return { entradas, salidas, salidasRapidas };
}

// ---------------------------------------------------------------------------
// Mapa de ángulos y espacios vacíos
// ---------------------------------------------------------------------------

export interface DensidadAngulo {
  angulo: Angulo;
  anuncios: number;
  competidores: number;
  /** Usado por más de la mitad de los competidores observados. */
  saturado: boolean;
}

export function mapaAngulos(anuncios: ReadonlyArray<AnuncioCompetidor>): DensidadAngulo[] {
  const totalCompetidores = new Set(anuncios.map((a) => a.competidorId)).size;
  return ANGULOS.filter((a) => a !== "sin_clasificar").map((angulo) => {
    const propios = anuncios.filter((a) => a.anguloDetectado === angulo);
    const competidores = new Set(propios.map((a) => a.competidorId)).size;
    return {
      angulo,
      anuncios: propios.length,
      competidores,
      saturado: totalCompetidores > 0 && competidores > totalCompetidores / 2,
    };
  });
}

export interface EspacioVacio {
  servicio: string;
  angulo: Angulo;
  nivelConsciencia: 1 | 2 | 3 | 4 | 5;
  competidoresQueLoAtacan: number;
  /** Explicación en lenguaje de dueño para la interfaz. */
  porQue: string;
}

/** Ángulos que nunca se proponen: riesgo de política. */
const ANGULOS_EXCLUIDOS: ReadonlySet<Angulo> = new Set(["antes_despues", "sin_clasificar"]);

/** Nivel de consciencia natural de cada ángulo (para no proponer combinaciones absurdas). */
const NIVELES_POR_ANGULO: Record<Angulo, ReadonlyArray<1 | 2 | 3 | 4 | 5>> = {
  educativo: [1, 2],
  aspiracional: [1, 2, 3],
  detras_de_camara: [2, 3],
  autoridad_medica: [3, 4],
  prueba_social: [3, 4],
  testimonio: [3, 4],
  objecion_seguridad: [3, 4],
  objecion_dolor: [3, 4],
  objecion_tiempo: [3, 4],
  objecion_precio: [4, 5],
  promocion: [5],
  urgencia: [5],
  antes_despues: [],
  sin_clasificar: [],
};

/**
 * Cruza servicio × ángulo × nivel de consciencia y devuelve lo que nadie ataca.
 * Ahí la subasta es barata y el mensaje es nuevo.
 */
export function espaciosVacios(anuncios: ReadonlyArray<AnuncioCompetidor>, cliente: ConfigCliente): EspacioVacio[] {
  const atacados = new Map<string, Set<string>>();
  for (const a of anuncios) {
    if (!a.servicioDetectado) continue;
    const clave = `${a.servicioDetectado}|${a.anguloDetectado}|${a.nivelConsciencia}`;
    (atacados.get(clave) ?? atacados.set(clave, new Set()).get(clave)!).add(a.competidorId);
  }
  const salida: EspacioVacio[] = [];
  for (const s of cliente.servicios) {
    for (const angulo of ANGULOS) {
      if (ANGULOS_EXCLUIDOS.has(angulo)) continue;
      for (const nivel of NIVELES_POR_ANGULO[angulo]) {
        const n = atacados.get(`${s.id}|${angulo}|${nivel}`)?.size ?? 0;
        if (n === 0) {
          salida.push({
            servicio: s.id,
            angulo,
            nivelConsciencia: nivel,
            competidoresQueLoAtacan: 0,
            porQue: `Ningún competidor observado habla de ${s.nombre.toLowerCase()} con este ángulo a este nivel de consciencia: la subasta es más barata y el mensaje, nuevo.`,
          });
        }
      }
    }
  }
  return salida;
}

// ---------------------------------------------------------------------------
// Participación y perfiles
// ---------------------------------------------------------------------------

export function participacionVoz(propiosActivos: number, anuncios: ReadonlyArray<AnuncioCompetidor>): number | null {
  const competencia = anuncios.filter((a) => a.activo).length;
  return razon(propiosActivos, propiosActivos + competencia);
}

export interface PerfilCompetidor {
  competidorId: string;
  /** Alias de competidorId para la interfaz. */
  id: string;
  nombre: string;
  anunciosActivos: number;
  anunciosTotales: number;
  ganadores: number;
  /** Alias de ganadores (anuncios de 60+ días) para la interfaz. */
  anuncios60: number;
  seguidoresPagina: number | null;
  urlPagina: string | null;
  angulos: Angulo[];
  servicios: string[];
  usaPrecio: number;
  usaTestimonio: number;
  longevidadPromedio: number | null;
  diasMaximo: number;
}

export function perfilar(competidorId: string, anuncios: ReadonlyArray<AnuncioCompetidor>, b: Benchmarks, ficha?: Competidor): PerfilCompetidor {
  const propios = anuncios.filter((a) => a.competidorId === competidorId);
  const activos = propios.filter((a) => a.activo);
  const ganadores = propios.filter((a) => a.diasCorriendo >= b.diasGanadorProbado.valor).length;
  return {
    competidorId,
    id: competidorId,
    nombre: ficha?.nombre ?? propios[0]?.nombreAnunciante ?? competidorId,
    anunciosActivos: activos.length,
    anunciosTotales: propios.length,
    ganadores,
    anuncios60: ganadores,
    seguidoresPagina: ficha?.seguidoresPagina ?? null,
    urlPagina: ficha?.urlPagina ?? null,
    angulos: [...new Set(propios.map((a) => a.anguloDetectado))],
    servicios: [...new Set(propios.map((a) => a.servicioDetectado).filter((s): s is string => s !== null))],
    usaPrecio: propios.filter((a) => a.usaPrecio).length,
    usaTestimonio: propios.filter((a) => a.usaTestimonio).length,
    longevidadPromedio: propios.length ? propios.reduce((s, a) => s + puntuacionLongevidad(a), 0) / propios.length : null,
    diasMaximo: propios.reduce((m, a) => Math.max(m, a.diasCorriendo), 0),
  };
}

// ---------------------------------------------------------------------------
// Resultado completo
// ---------------------------------------------------------------------------

export interface CadenciaCompetidor {
  competidorId: string;
  nombre: string;
  porSemana: number;
}
export interface VozCompetidor {
  competidorId: string;
  nombre: string;
  porcentaje: number;
}
export interface MovimientoSemanal {
  /** Lunes de la semana (YYYY-MM-DD). */
  semana: string;
  entradas: number;
  salidas: number;
}

export interface ResultadoRadar {
  competidoresActivos: number;
  anunciosActivos: number;
  ganadores: AnuncioCompetidor[];
  cadencia: ReturnType<typeof cadenciaSemanal>;
  cadenciaPropia: number;
  /** Cadencia por competidor (últimas 4 semanas), serializable para la interfaz. */
  cadenciaPorCompetidor: CadenciaCompetidor[];
  /** Participación de voz por competidor: anuncios activos / total activos de la competencia. Suma 1. */
  vozPorCompetidor: VozCompetidor[];
  /** Entradas y salidas por semana, últimas 8 semanas. */
  movimientosSemanales: MovimientoSemanal[];
  movimientos: ReturnType<typeof entradasYSalidas>;
  mapaAngulos: DensidadAngulo[];
  espaciosVacios: EspacioVacio[];
  participacionVoz: number | null;
  perfiles: PerfilCompetidor[];
  usoPrecio: number | null;
  usoTestimonio: number | null;
  variantesPromedio: number | null;
}

/** Lunes de la semana de una fecha. */
function lunesDe(fecha: string): string {
  const d = new Date(`${fecha}T12:00:00Z`).getUTCDay();
  return sumarDias(fecha, -((d + 6) % 7));
}

export function movimientosSemanales(anuncios: ReadonlyArray<AnuncioCompetidor>, hoy: string, semanas = 8): MovimientoSemanal[] {
  const inicio = lunesDe(sumarDias(hoy, -(semanas * 7 - 1)));
  const salida: MovimientoSemanal[] = [];
  for (let i = 0; i < semanas; i++) {
    const semana = sumarDias(inicio, i * 7);
    const fin = sumarDias(semana, 6);
    salida.push({
      semana,
      entradas: anuncios.filter((a) => a.primeraVez >= semana && a.primeraVez <= fin).length,
      salidas: anuncios.filter((a) => !a.activo && a.ultimaVez >= semana && a.ultimaVez <= fin).length,
    });
  }
  return salida;
}

export function analizarRadar(
  anuncios: ReadonlyArray<AnuncioCompetidor>,
  creativosPropios: ReadonlyArray<Creativo>,
  cliente: ConfigCliente,
  b: Benchmarks,
  hoy: string,
  fichas: ReadonlyArray<Competidor> = [],
): ResultadoRadar {
  const competidores = [...new Set(anuncios.map((a) => a.competidorId))];
  const desde = sumarDias(hoy, -(SEMANAS * 7 - 1));
  const activosPropios = creativosPropios.filter((c) => c.diasActivo > 0).length;
  const fichaDe = (id: string) => fichas.find((f) => f.id === id);
  const nombreDe = (id: string) => fichaDe(id)?.nombre ?? anuncios.find((a) => a.competidorId === id)?.nombreAnunciante ?? id;
  const cadencia = cadenciaSemanal(anuncios, hoy);
  const activosCompetencia = anuncios.filter((a) => a.activo);
  return {
    competidoresActivos: new Set(anuncios.filter((a) => a.activo).map((a) => a.competidorId)).size,
    anunciosActivos: anuncios.filter((a) => a.activo).length,
    ganadores: ganadoresProbados(anuncios, b),
    cadencia,
    cadenciaPropia: creativosPropios.filter((c) => c.fechaPrimerGasto >= desde).length / SEMANAS,
    cadenciaPorCompetidor: competidores.map((id) => ({ competidorId: id, nombre: nombreDe(id), porSemana: cadencia.porCompetidor.get(id) ?? 0 })).sort((x, y) => y.porSemana - x.porSemana),
    vozPorCompetidor: competidores
      .map((id) => ({ competidorId: id, nombre: nombreDe(id), porcentaje: activosCompetencia.length ? activosCompetencia.filter((a) => a.competidorId === id).length / activosCompetencia.length : 0 }))
      .sort((x, y) => y.porcentaje - x.porcentaje),
    movimientosSemanales: movimientosSemanales(anuncios, hoy),
    movimientos: entradasYSalidas(anuncios, hoy),
    mapaAngulos: mapaAngulos(anuncios),
    espaciosVacios: espaciosVacios(anuncios, cliente),
    participacionVoz: participacionVoz(activosPropios, anuncios),
    perfiles: competidores.map((id) => perfilar(id, anuncios, b, fichaDe(id))),
    usoPrecio: razon(anuncios.filter((a) => a.usaPrecio).length, anuncios.length),
    usoTestimonio: razon(anuncios.filter((a) => a.usaTestimonio).length, anuncios.length),
    variantesPromedio: razon(anuncios.reduce((s, a) => s + a.variantesDelConcepto, 0), anuncios.length),
  };
}
