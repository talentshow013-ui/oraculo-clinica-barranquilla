/**
 * Seed determinista: 180 días con la MISMA forma que entregan las fuentes reales. (§11)
 *
 * Misma semilla, mismos datos: los tests dependen de eso. Patrones plantados:
 *  - un creativo que fatiga después del día 90
 *  - ~22 % de inversión fugándose a Cartagena, Santa Marta y Bogotá
 *  - caída de asistencia a citas en los últimos 25 días
 *  - segmento 65+ que gasta y no convierte
 *  - CPM con tendencia creciente (presión de subasta)
 *  - ~50 % de la pauta fuera del horario de atención
 *  - 2 días de hueco
 *  - 6 competidores con ~50 anuncios, algunos de 60+ días
 *
 * Ejecutar: `npm run seed` → escribe datos/seed.json y lo valida contra el contrato.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import type {
  Angulo,
  AnuncioCompetidor,
  BreakdownRow,
  Competidor,
  Creativo,
  Experimento,
  InsightRow,
  LoteDatos,
  RegistroEmbudo,
} from "@/lib/adapters/types";
import { LoteDatosSchema } from "@/lib/adapters/types";
import { diaSemana, rangoDias, sumarDias } from "@/lib/format/fechas";
import { validarSinPII } from "@/lib/privacy";
import { clasificarAngulo, nivelConscienciaTexto } from "@/lib/competitive/angles";

export const SEMILLA = 20260913;
export const DIAS = 180;
export const HASTA = "2026-09-12";
export const DESDE = sumarDias(HASTA, -(DIAS - 1));
const HUECOS = ["2026-07-04", "2026-07-05"];

// ---------------------------------------------------------------------------
// PRNG
// ---------------------------------------------------------------------------

function mulberry32(a: number) {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Rng = () => number;
const entre = (r: Rng, a: number, b: number) => a + r() * (b - a);
const entero = (r: Rng, a: number, b: number) => Math.floor(entre(r, a, b + 1));
const ruido = (r: Rng, amplitud: number) => 1 + entre(r, -amplitud, amplitud);
const elegir = <T>(r: Rng, xs: ReadonlyArray<T>): T => xs[Math.floor(r() * xs.length)]!;

// ---------------------------------------------------------------------------
// Estructura de la cuenta
// ---------------------------------------------------------------------------

interface AdDef {
  id: string;
  nombre: string;
  conjuntoId: string;
  campanaId: string;
  servicio: string;
  formato: Creativo["formato"];
  copy: string;
  titular: string | null;
  cta: string;
  angulo: Angulo;
  /** Fracción del presupuesto diario de la cuenta. */
  peso: number;
  /** Calidad relativa del creativo (1 = promedio). */
  calidad: number;
  primerDia: number;
  /** Día a partir del cual fatiga (null = no fatiga). */
  fatigaDesde: number | null;
  duracionSeg: number | null;
}

/** Tres cuentas publicitarias (config/cliente.ts): Riomar lleva facial, Norte láser y corporal, Médicos sin pauta. */
const CUENTA_POR_CAMPANA: Record<string, string> = {
  camp_facial: "act_1048227",
  camp_laser: "act_2213904",
  camp_corporal: "act_2213904",
};
const cuentaDe = (campanaId: string) => CUENTA_POR_CAMPANA[campanaId] ?? "act_1048227";

const CAMPANAS = [
  { id: "camp_facial", nombre: "Facial · Toxina y ácido" },
  { id: "camp_laser", nombre: "Láser · Facial y depilación" },
  { id: "camp_corporal", nombre: "Corporal · Criolipólisis y radiofrecuencia" },
] as const;

const CONJUNTOS = [
  { id: "adset_facial_mujeres_25_45", nombre: "Facial · Mujeres 25-45 · Área metropolitana", campanaId: "camp_facial" },
  { id: "adset_facial_amplio", nombre: "Facial · Amplio · Atlántico y Bolívar", campanaId: "camp_facial" },
  { id: "adset_laser_mujeres", nombre: "Láser · Mujeres 20-40 · Barranquilla", campanaId: "camp_laser" },
  { id: "adset_laser_retargeting", nombre: "Láser · Retargeting 30 días", campanaId: "camp_laser" },
  { id: "adset_corporal_amplio", nombre: "Corporal · Amplio · Costa", campanaId: "camp_corporal" },
  { id: "adset_corporal_intereses", nombre: "Corporal · Intereses gimnasio y nutrición", campanaId: "camp_corporal" },
] as const;

const ANUNCIOS: AdDef[] = [
  { id: "ad_toxina_medico", nombre: "Toxina · Médico explica", conjuntoId: "adset_facial_mujeres_25_45", campanaId: "camp_facial", servicio: "toxina", formato: "video", copy: "La Dra. explica en 40 segundos cómo funciona la toxina botulínica y qué esperar de la valoración. Médico estético certificado, 12 años de experiencia.", titular: "Toxina botulínica con médico", cta: "Escríbenos", angulo: "autoridad_medica", peso: 0.28, calidad: 1.35, primerDia: 0, fatigaDesde: 90, duracionSeg: 40 },
  { id: "ad_toxina_promo", nombre: "Toxina · Promoción septiembre", conjuntoId: "adset_facial_mujeres_25_45", campanaId: "camp_facial", servicio: "toxina", formato: "imagen", copy: "Toxina botulínica desde $350.000. Promoción de septiembre: valoración sin costo. Cupos limitados esta semana.", titular: "Promo toxina", cta: "Agenda", angulo: "promocion", peso: 0.12, calidad: 0.95, primerDia: 150, fatigaDesde: null, duracionSeg: null },
  { id: "ad_acido_labios", nombre: "Ácido · Labios naturales", conjuntoId: "adset_facial_amplio", campanaId: "camp_facial", servicio: "acido", formato: "video", copy: "¿Te da miedo quedar exagerada? Así logramos labios naturales con ácido hialurónico. Sin dolor, resultado inmediato.", titular: "Labios naturales", cta: "Escríbenos", angulo: "objecion_dolor", peso: 0.1, calidad: 1.05, primerDia: 20, fatigaDesde: null, duracionSeg: 25 },
  { id: "ad_limpieza_educativo", nombre: "Limpieza · ¿Sabías que?", conjuntoId: "adset_facial_amplio", campanaId: "camp_facial", servicio: "limpieza", formato: "carrusel", copy: "¿Sabías que una limpieza facial profunda cada mes previene manchas y poros abiertos? Te explicamos qué incluye.", titular: null, cta: "Más información", angulo: "educativo", peso: 0.05, calidad: 0.8, primerDia: 0, fatigaDesde: null, duracionSeg: null },
  { id: "ad_laser_testimonio", nombre: "Láser · Testimonio Laura", conjuntoId: "adset_laser_mujeres", campanaId: "camp_laser", servicio: "laser_facial", formato: "video", copy: "Laura nos cuenta su experiencia con láser facial: 'volvería mil veces'. Sin incapacidad, vuelve a tu rutina el mismo día.", titular: "Lo que dicen nuestras pacientes", cta: "Escríbenos", angulo: "testimonio", peso: 0.12, calidad: 1.15, primerDia: 10, fatigaDesde: null, duracionSeg: 30 },
  { id: "ad_depilacion_precio", nombre: "Depilación · Paquete 6 sesiones", conjuntoId: "adset_laser_mujeres", campanaId: "camp_laser", servicio: "depilacion", formato: "imagen", copy: "Depilación láser: paquete de 6 sesiones en cuotas sin intereses. Invierte en ti.", titular: "Paquete 6 sesiones", cta: "Agenda", angulo: "objecion_precio", peso: 0.08, calidad: 1.0, primerDia: 40, fatigaDesde: null, duracionSeg: null },
  { id: "ad_laser_retarget", nombre: "Láser · Retargeting cupos", conjuntoId: "adset_laser_retargeting", campanaId: "camp_laser", servicio: "laser_facial", formato: "imagen", copy: "Últimos cupos de valoración esta semana. Agenda ya.", titular: "Últimos cupos", cta: "Agenda", angulo: "urgencia", peso: 0.04, calidad: 1.1, primerDia: 30, fatigaDesde: null, duracionSeg: null },
  { id: "ad_crio_antes_despues", nombre: "Criolipólisis · Resultado real", conjuntoId: "adset_corporal_amplio", campanaId: "camp_corporal", servicio: "criolipolisis", formato: "video", copy: "Mira el antes y después de criolipólisis en 8 semanas. Elimina la grasa localizada para siempre.", titular: "Resultado real", cta: "Escríbenos", angulo: "antes_despues", peso: 0.09, calidad: 0.9, primerDia: 60, fatigaDesde: null, duracionSeg: 20 },
  { id: "ad_radio_detras", nombre: "Radiofrecuencia · Así trabajamos", conjuntoId: "adset_corporal_intereses", campanaId: "camp_corporal", servicio: "radiofrecuencia", formato: "video", copy: "Así trabajamos: un día en la clínica con nuestro equipo. Conoce la clínica y la radiofrecuencia corporal.", titular: null, cta: "Más información", angulo: "detras_de_camara", peso: 0.06, calidad: 0.85, primerDia: 5, fatigaDesde: null, duracionSeg: 45 },
  { id: "ad_prp_seguridad", nombre: "Plasma · Seguro y sin cirugía", conjuntoId: "adset_corporal_intereses", campanaId: "camp_corporal", servicio: "prp", formato: "carrusel", copy: "Plasma rico en plaquetas: procedimiento seguro, no invasivo, con protocolo de bioseguridad. Aprobado y realizado por especialista.", titular: "Seguro y sin cirugía", cta: "Escríbenos", angulo: "objecion_seguridad", peso: 0.06, calidad: 1.0, primerDia: 70, fatigaDesde: null, duracionSeg: null },
];

// ---------------------------------------------------------------------------
// Generación
// ---------------------------------------------------------------------------

const GASTO_DIARIO_BASE = 420_000; // COP
const VENTANA = "7d_click_1d_view";

function vacioInsight(): Omit<InsightRow, "fuente" | "fecha" | "nivel" | "id" | "nombre" | "padreId" | "cuentaId" | "objetivo" | "estado" | "gasto" | "impresiones" | "clics" | "clicsEnlace" | "resultados" | "ventanaAtribucion"> {
  return {
    alcance: null,
    frecuencia: null,
    subastasGanadas: null,
    pujaPromedio: null,
    clicsUnicos: null,
    interacciones: null,
    reacciones: null,
    comentarios: null,
    compartidos: null,
    guardados: null,
    visitasPerfil: null,
    seguidoresNuevos: null,
    vistasLandingPage: null,
    reproducciones: null,
    reproducciones2s: null,
    reproducciones3s: null,
    reproducciones6s: null,
    reproduccionesThru: null,
    p25: null,
    p50: null,
    p75: null,
    p95: null,
    p100: null,
    tiempoReproduccionTotal: null,
    duracionCreativoSeg: null,
    conversacionesIniciadas: null,
    conversacionesRespondidas: null,
    tipoResultado: null,
    valorConversion: null,
  };
}

function filaAnuncio(r: Rng, ad: AdDef, fecha: string, d: number): InsightRow | null {
  if (d < ad.primerDia) return null;
  const estacional = 1 + 0.08 * Math.sin((d / 30) * Math.PI); // ciclo mensual suave
  const finDeSemana = diaSemana(fecha) === 0 ? 0.6 : 1;
  const gasto = Math.round(GASTO_DIARIO_BASE * ad.peso * estacional * finDeSemana * ruido(r, 0.12));

  // CPM crece a lo largo del periodo y da un salto en las últimas 3 semanas (presión de subasta).
  const salto = d >= DIAS - 21 ? 1.28 : 1;
  const cpm = 9_500 * (1 + 0.2 * (d / DIAS)) * salto * ruido(r, 0.06);
  const impresiones = Math.round((gasto / cpm) * 1000);

  // Fatiga: CTR de enlace decae y frecuencia sube después de fatigaDesde.
  let ctrEnlace = 0.014 * ad.calidad;
  let frecuencia = 1.3;
  if (ad.fatigaDesde !== null && d >= ad.fatigaDesde) {
    const avance = Math.min(1, (d - ad.fatigaDesde) / 45);
    ctrEnlace *= 1 - 0.55 * avance;
    frecuencia += 2.6 * avance;
  }
  frecuencia *= ruido(r, 0.05);
  const alcance = Math.round(impresiones / frecuencia);
  const clicsEnlace = Math.round(impresiones * ctrEnlace * ruido(r, 0.15));
  const clics = Math.round(clicsEnlace * entre(r, 1.3, 1.6));
  const conversaciones = Math.round(clicsEnlace * entre(r, 0.1, 0.15) * ad.calidad);
  const respondidas = Math.round(conversaciones * entre(r, 0.82, 0.95));
  const resultados = conversaciones;

  const esVideo = ad.formato === "video";
  const reproducciones = esVideo ? Math.round(impresiones * entre(r, 0.55, 0.7)) : null;
  const hook = esVideo ? entre(r, 0.22, 0.34) * ad.calidad : null;
  const rep3 = esVideo ? Math.round(impresiones * (hook ?? 0)) : null;
  const thru = esVideo ? Math.round((rep3 ?? 0) * entre(r, 0.3, 0.45)) : null;
  const p25 = esVideo ? Math.round((reproducciones ?? 0) * entre(r, 0.55, 0.65)) : null;
  const p50 = esVideo ? Math.round((p25 ?? 0) * entre(r, 0.6, 0.7)) : null;
  const p75 = esVideo ? Math.round((p50 ?? 0) * entre(r, 0.65, 0.75)) : null;
  const p100 = esVideo ? Math.round((p75 ?? 0) * entre(r, 0.6, 0.7)) : null;

  return {
    ...vacioInsight(),
    fuente: "meta",
    fecha,
    nivel: "anuncio",
    id: ad.id,
    nombre: ad.nombre,
    padreId: ad.conjuntoId,
    cuentaId: cuentaDe(ad.campanaId),
    objetivo: "mensajes",
    estado: "activo",
    gasto,
    impresiones,
    alcance,
    frecuencia: Number(frecuencia.toFixed(2)),
    clics,
    clicsEnlace,
    clicsUnicos: Math.round(clics * 0.9),
    interacciones: Math.round(impresiones * entre(r, 0.012, 0.02)),
    reacciones: Math.round(impresiones * entre(r, 0.008, 0.014)),
    comentarios: Math.round(impresiones * entre(r, 0.0006, 0.0012)),
    compartidos: Math.round(impresiones * entre(r, 0.0004, 0.0009)),
    guardados: Math.round(impresiones * entre(r, 0.001, 0.002)),
    vistasLandingPage: Math.round(clicsEnlace * entre(r, 0.8, 0.92)),
    reproducciones,
    reproducciones3s: rep3,
    reproduccionesThru: thru,
    p25,
    p50,
    p75,
    p95: esVideo ? Math.round((p100 ?? 0) * 1.1) : null,
    p100,
    tiempoReproduccionTotal: esVideo && reproducciones ? Math.round(reproducciones * (ad.duracionSeg ?? 20) * entre(r, 0.3, 0.45)) : null,
    duracionCreativoSeg: ad.duracionSeg,
    conversacionesIniciadas: conversaciones,
    conversacionesRespondidas: respondidas,
    resultados,
    tipoResultado: "conversacion",
    ventanaAtribucion: VENTANA,
  };
}

/** Suma filas de anuncio en su padre: solo crudos; frecuencia ponderada. */
function agregarNivel(filas: InsightRow[], nivel: "conjunto" | "campana", id: string, nombre: string, padreId: string | null, fecha: string): InsightRow {
  const base: InsightRow = {
    ...vacioInsight(),
    fuente: "meta",
    fecha,
    nivel,
    id,
    nombre,
    padreId,
    cuentaId: filas[0]?.cuentaId ?? "act_1048227",
    objetivo: "mensajes",
    estado: "activo",
    gasto: 0,
    impresiones: 0,
    clics: 0,
    clicsEnlace: 0,
    resultados: 0,
    ventanaAtribucion: VENTANA,
  };
  const sumables = ["gasto", "impresiones", "alcance", "clics", "clicsEnlace", "clicsUnicos", "interacciones", "reacciones", "comentarios", "compartidos", "guardados", "vistasLandingPage", "reproducciones", "reproducciones3s", "reproduccionesThru", "p25", "p50", "p75", "p95", "p100", "tiempoReproduccionTotal", "conversacionesIniciadas", "conversacionesRespondidas", "resultados"] as const;
  let frecPond = 0;
  for (const f of filas) {
    for (const k of sumables) {
      const v = f[k];
      if (v !== null) (base as unknown as Record<string, number | null>)[k] = ((base[k] as number | null) ?? 0) + v;
    }
    frecPond += (f.frecuencia ?? 0) * f.impresiones;
  }
  base.frecuencia = base.impresiones > 0 ? Number((frecPond / base.impresiones).toFixed(2)) : null;
  base.tipoResultado = "conversacion";
  return base;
}

function generarInsights(r: Rng, fechas: string[]): InsightRow[] {
  const salida: InsightRow[] = [];
  fechas.forEach((fecha, d) => {
    const deAnuncio: InsightRow[] = [];
    for (const ad of ANUNCIOS) {
      const f = filaAnuncio(r, ad, fecha, d);
      if (f) deAnuncio.push(f);
    }
    salida.push(...deAnuncio);
    for (const c of CONJUNTOS) {
      const propias = deAnuncio.filter((f) => f.padreId === c.id);
      if (propias.length) salida.push(agregarNivel(propias, "conjunto", c.id, c.nombre, c.campanaId, fecha));
    }
    for (const c of CAMPANAS) {
      const propias = deAnuncio.filter((f) => ANUNCIOS.find((a) => a.id === f.id)?.campanaId === c.id);
      if (propias.length) salida.push(agregarNivel(propias, "campana", c.id, c.nombre, null, fecha));
    }
  });
  return salida;
}

// ---------------------------------------------------------------------------
// Desgloses (nivel cuenta)
// ---------------------------------------------------------------------------

const ZONAS: [string, number, number][] = [
  // [zona, fracción del gasto, factor de conversión]
  ["Barranquilla", 0.46, 1.1],
  ["Soledad", 0.14, 1.0],
  ["Puerto Colombia", 0.07, 1.2],
  ["Malambo", 0.05, 0.9],
  ["Galapa", 0.03, 0.9],
  ["Sabanagrande", 0.03, 0.8],
  ["Cartagena", 0.11, 0.05],
  ["Santa Marta", 0.07, 0.04],
  ["Bogotá", 0.04, 0.02],
];
const EDADES: [string, number, number][] = [
  ["18-24", 0.12, 0.7],
  ["25-34", 0.34, 1.3],
  ["35-44", 0.26, 1.2],
  ["45-54", 0.12, 0.9],
  ["55-64", 0.04, 0.5],
  ["65+", 0.12, 0],
];
const GENEROS: [string, number, number][] = [
  ["mujer", 0.82, 1.1],
  ["hombre", 0.18, 0.6],
];
const PLATAFORMAS: [string, number, number][] = [
  ["instagram_reels", 0.42, 1.15],
  ["instagram_feed", 0.2, 1.0],
  ["facebook_feed", 0.26, 0.9],
  ["instagram_stories", 0.12, 0.85],
];

function desgloseDia(r: Rng, fecha: string, dimension: BreakdownRow["dimension"], valor: string, gasto: number, impresiones: number, clicsEnlace: number, resultados: number, nRegistros: number, cuentaId: string): BreakdownRow {
  return {
    ...vacioInsight(),
    fuente: "meta",
    fecha,
    nivel: "cuenta",
    id: cuentaId,
    nombre: "Cuenta",
    padreId: null,
    cuentaId,
    objetivo: null,
    estado: "activo",
    gasto: Math.round(gasto),
    impresiones: Math.round(impresiones),
    alcance: null,
    clics: Math.round(clicsEnlace * 1.45),
    clicsEnlace: Math.round(clicsEnlace),
    conversacionesIniciadas: Math.round(resultados),
    resultados: Math.round(resultados),
    tipoResultado: "conversacion",
    ventanaAtribucion: VENTANA,
    dimension,
    valor,
    // Personas del segmento (no resultados): es lo que protege el k-anonimato.
    nRegistros: Math.max(0, Math.round(nRegistros * ruido(r, 0.1))),
  };
}

function generarDesgloses(r: Rng, insights: InsightRow[], fechas: string[]): BreakdownRow[] {
  const salida: BreakdownRow[] = [];
  const cuentas = [...new Set(insights.filter((f) => f.nivel === "anuncio").map((f) => f.cuentaId))];
  const porClave = new Map<string, InsightRow[]>();
  for (const f of insights) if (f.nivel === "anuncio") (porClave.get(`${f.cuentaId}|${f.fecha}`) ?? porClave.set(`${f.cuentaId}|${f.fecha}`, []).get(`${f.cuentaId}|${f.fecha}`)!).push(f);

  const ultimos28 = new Set(fechas.slice(-28));
  for (const cuentaId of cuentas) for (const fecha of fechas) {
    const filas = porClave.get(`${cuentaId}|${fecha}`);
    if (!filas) continue;
    const gasto = filas.reduce((s, f) => s + f.gasto, 0);
    const impr = filas.reduce((s, f) => s + f.impresiones, 0);
    const clics = filas.reduce((s, f) => s + f.clicsEnlace, 0);
    const res = filas.reduce((s, f) => s + f.resultados, 0);

    const emitir = (dimension: BreakdownRow["dimension"], defs: [string, number, number][]) => {
      // Los desgloses no suman al total (deduplicación): se emite ~96 % con ruido.
      const factorTotal = entre(r, 0.93, 0.99);
      const sumaConv = defs.reduce((s, [, f, k]) => s + f * k, 0);
      for (const [valor, fraccion, conv] of defs) {
        const frac = fraccion * ruido(r, 0.08);
        const resSeg = res * factorTotal * ((fraccion * conv) / sumaConv);
        const imprSeg = impr * frac * factorTotal;
        salida.push(desgloseDia(r, fecha, dimension, valor, gasto * frac * factorTotal, imprSeg, clics * frac * factorTotal * (conv === 0 ? 0.5 : 1), conv === 0 ? 0 : resSeg, imprSeg / 1.4, cuentaId));
      }
    };
    emitir("ubicacion", ZONAS);
    emitir("edad", EDADES);
    emitir("genero", GENEROS);
    emitir("plataforma", PLATAFORMAS);

    if (ultimos28.has(fecha)) {
      // ~50 % fuera de 8-18. Perfil: pico 19-23 y madrugada baja.
      const perfil = Array.from({ length: 24 }, (_, h) => (h >= 8 && h < 18 ? 1.0 : h >= 18 && h <= 23 ? 1.55 : 0.28));
      const total = perfil.reduce((s, x) => s + x, 0);
      perfil.forEach((p, h) => {
        const frac = (p / total) * ruido(r, 0.1);
        const enHorario = h >= 8 && h < 18;
        const resH = res * frac * (enHorario ? 1.25 : 0.75) * 0.95;
        salida.push(desgloseDia(r, fecha, "hora", String(h), gasto * frac * 0.96, impr * frac * 0.96, clics * frac * 0.96, resH, (impr * frac * 0.96) / 1.4, cuentaId));
      });
    }
  }
  return salida;
}

// ---------------------------------------------------------------------------
// Embudo (agregado, sin pacientes)
// ---------------------------------------------------------------------------

const TICKETS: Record<string, [number, number]> = {
  toxina: [650_000, 950_000],
  acido: [900_000, 1_400_000],
  limpieza: [120_000, 180_000],
  peeling: [200_000, 320_000],
  laser_facial: [400_000, 700_000],
  depilacion: [250_000, 600_000],
  criolipolisis: [1_200_000, 2_500_000],
  radiofrecuencia: [300_000, 600_000],
  prp: [500_000, 800_000],
};

function generarEmbudo(r: Rng, insights: InsightRow[], fechas: string[]): RegistroEmbudo[] {
  const salida: RegistroEmbudo[] = [];
  const inicioCaida = sumarDias(HASTA, -24);
  const porFecha = new Map<string, InsightRow[]>();
  for (const f of insights) if (f.nivel === "anuncio") (porFecha.get(f.fecha) ?? porFecha.set(f.fecha, []).get(f.fecha)!).push(f);

  for (const fecha of fechas) {
    const filas = porFecha.get(fecha);
    if (!filas) continue;
    // Por campaña, para que campanaId tenga sentido.
    for (const camp of CAMPANAS) {
      const propias = filas.filter((f) => ANUNCIOS.find((a) => a.id === f.id)?.campanaId === camp.id);
      if (!propias.length) continue;
      const impresiones = propias.reduce((s, f) => s + f.impresiones, 0);
      const clics = propias.reduce((s, f) => s + f.clicsEnlace, 0);
      const conversaciones = propias.reduce((s, f) => s + (f.conversacionesIniciadas ?? 0), 0);
      const servicios = [...new Set(propias.map((f) => ANUNCIOS.find((a) => a.id === f.id)!.servicio))];
      const servicio = elegir(r, servicios);

      // Capacidad real: ~12 cupos/día en toda la clínica, repartidos en 3 campañas.
      const leads = Math.round(conversaciones * entre(r, 0.3, 0.4));
      const agendadas = Math.round(leads * entre(r, 0.45, 0.6));
      const showRate = fecha >= inicioCaida ? entre(r, 0.5, 0.6) : entre(r, 0.74, 0.84);
      const asistidas = Math.round(agendadas * showRate);
      const ventas = Math.round(asistidas * entre(r, 0.42, 0.55));
      const recompras = Math.round(ventas * entre(r, 0.12, 0.22));
      const [tMin, tMax] = TICKETS[servicio] ?? [400_000, 800_000];
      const ticket = entre(r, tMin, tMax);

      const reg = (paso: RegistroEmbudo["paso"], cantidad: number, valorCOP: number | null) => {
        salida.push({ fecha, campanaId: camp.id, fuenteAtribuida: "meta", paso, cantidad, valorCOP: valorCOP === null ? null : Math.round(valorCOP), servicio, sede: null, nRegistros: cantidad });
      };
      reg("impresion", impresiones, null);
      reg("clic", clics, null);
      reg("conversacion", conversaciones, null);
      reg("lead_calificado", leads, null);
      reg("cita_agendada", agendadas, null);
      reg("cita_asistida", asistidas, null);
      reg("venta", ventas, ventas * ticket);
      reg("recompra", recompras, recompras * ticket * 0.8);
    }
  }
  return salida;
}

// ---------------------------------------------------------------------------
// Creativos, competencia, experimentos
// ---------------------------------------------------------------------------

function generarCreativos(fechas: string[]): Creativo[] {
  return ANUNCIOS.map((ad) => {
    const texto = `${ad.copy} ${ad.titular ?? ""}`;
    const c = clasificarAngulo(texto);
    return {
      id: `cr_${ad.id}`,
      anuncioId: ad.id,
      formato: ad.formato,
      urlMiniatura: null,
      copyPrincipal: ad.copy,
      titular: ad.titular,
      descripcion: null,
      cta: ad.cta,
      urlDestino: ad.cta === "Escríbenos" ? "https://wa.me/57300000000" : null,
      fechaPrimerGasto: fechas[ad.primerDia] ?? DESDE,
      diasActivo: DIAS - ad.primerDia,
      servicio: ad.servicio,
      anguloDetectado: c.angulo === "sin_clasificar" ? ad.angulo : c.angulo,
      nivelConsciencia: nivelConscienciaTexto(texto),
      confianzaClasificacion: c.confianza,
      senalesDeteccion: c.senales,
    };
  });
}

const COMPETIDORES: Competidor[] = [
  { id: "comp_dermalux", nombre: "Dermalux Estética", ciudad: "Barranquilla", serviciosConocidos: ["toxina", "acido", "laser_facial"], urlPagina: null, seguidoresPagina: null },
  { id: "comp_bellavista", nombre: "Clínica Bellavista", ciudad: "Barranquilla", serviciosConocidos: ["criolipolisis", "radiofrecuencia", "depilacion"], urlPagina: null, seguidoresPagina: null },
  { id: "comp_nordskin", nombre: "NordSkin Medical", ciudad: "Puerto Colombia", serviciosConocidos: ["toxina", "prp", "peeling"], urlPagina: null, seguidoresPagina: null },
  { id: "comp_essenza", nombre: "Essenza Spa Médico", ciudad: "Barranquilla", serviciosConocidos: ["limpieza", "peeling", "radiofrecuencia"], urlPagina: null, seguidoresPagina: null },
  { id: "comp_laserline", nombre: "LaserLine Caribe", ciudad: "Soledad", serviciosConocidos: ["depilacion", "laser_facial"], urlPagina: null, seguidoresPagina: null },
  { id: "comp_drvargas", nombre: "Dr. Vargas Medicina Estética", ciudad: "Barranquilla", serviciosConocidos: ["toxina", "acido", "criolipolisis"], urlPagina: null, seguidoresPagina: null },
];

const COPIES_COMPETENCIA: [string, Angulo, string][] = [
  ["Toxina botulínica aplicada por médico dermatólogo. Agenda tu valoración.", "autoridad_medica", "toxina"],
  ["Promoción del mes: toxina desde $320.000. Cupos limitados.", "promocion", "toxina"],
  ["Más de 3.000 pacientes atendidos nos recomiendan. Conoce por qué.", "prueba_social", "acido"],
  ["Rejuvenece tu piel y luce radiante con láser facial.", "aspiracional", "laser_facial"],
  ["¿Duele la depilación láser? Nuestra tecnología es indolora.", "objecion_dolor", "depilacion"],
  ["Criolipólisis: elimina la grasa localizada sin cirugía. Resultado real en 8 semanas.", "objecion_seguridad", "criolipolisis"],
  ["Depilación láser en cuotas sin intereses. Paga en 6 meses.", "objecion_precio", "depilacion"],
  ["Últimos cupos de septiembre para radiofrecuencia. Agenda ya.", "urgencia", "radiofrecuencia"],
  ["Mira el antes y después de nuestras pacientes de criolipólisis.", "antes_despues", "criolipolisis"],
  ["Ana nos cuenta su experiencia con ácido hialurónico: 'me cambió la cara'.", "testimonio", "acido"],
  ["Limpieza facial profunda en 45 minutos, vuelve a tu rutina el mismo día.", "objecion_tiempo", "limpieza"],
  ["Peeling químico con especialista. Piel renovada en una sesión.", "autoridad_medica", "peeling"],
  ["Plasma rico en plaquetas: el tratamiento que usan las celebridades.", "aspiracional", "prp"],
];

function generarCompetencia(r: Rng, fechas: string[]): AnuncioCompetidor[] {
  const salida: AnuncioCompetidor[] = [];
  let n = 0;
  for (const comp of COMPETIDORES) {
    const cantidad = entero(r, 7, 9);
    for (let i = 0; i < cantidad; i++) {
      const [copy, angulo, servicio] = elegir(r, COPIES_COMPETENCIA);
      // Distribución de longevidad: algunos veteranos (60-150 días), muchos cortos.
      const veterano = r() < 0.22;
      const dias = veterano ? entero(r, 60, 150) : entero(r, 2, 45);
      const activo = veterano ? r() < 0.9 : r() < 0.6;
      const primeraVez = sumarDias(HASTA, -(dias + (activo ? 0 : entero(r, 0, 20))));
      const ultimaVez = activo ? HASTA : sumarDias(primeraVez, dias);
      const variantes = veterano ? entero(r, 2, 6) : entero(r, 1, 3);
      const a: AnuncioCompetidor = {
        competidorId: comp.id,
        nombreAnunciante: comp.nombre,
        anuncioId: `cx_${++n}`,
        primeraVez: primeraVez < fechas[0]! ? fechas[0]! : primeraVez,
        ultimaVez,
        diasCorriendo: dias,
        activo,
        plataformas: r() < 0.7 ? ["facebook", "instagram"] : ["instagram"],
        copy,
        titular: null,
        cta: elegir(r, ["Más información", "Escríbenos", "Agenda", "Reservar"]),
        urlMedia: null,
        tipoMedia: elegir(r, ["video", "video", "imagen", "carrusel"]),
        urlDestino: null,
        dominioDestino: r() < 0.5 ? "wa.me" : null,
        alcanceRango: null,
        variantesDelConcepto: variantes,
        servicioDetectado: servicio,
        anguloDetectado: angulo,
        nivelConsciencia: nivelConscienciaTexto(copy),
        usaPrecio: /\$/.test(copy),
        usaUrgencia: angulo === "urgencia",
        usaProfesional: /m[eé]dico|especialista|dermat/i.test(copy),
        usaTestimonio: angulo === "testimonio",
        usaGarantia: /garant/i.test(copy),
        puntuacionLongevidad: 0, // se recalcula en el motor
      };
      salida.push(a);
    }
  }
  return salida;
}

function generarExperimentos(): Experimento[] {
  return [
    {
      id: "exp_2026_06_toxina_promo",
      hipotesis: "Si se lanza una pieza de toxina con ángulo promoción para quien ya compara precio, entonces bajará el costo por conversación, porque la competencia no muestra precio.",
      servicio: "toxina",
      angulo: "promocion",
      tipoPrueba: "creativo",
      inicio: "2026-06-02",
      fin: "2026-06-14",
      resultado: "perdio",
      metricaExito: "costo por conversación vs promedio de la cuenta",
      aprendizaje: "Trajo conversaciones 30 % más baratas pero con la mitad de asistencia a valoración: atrae a quien compara precio y no llega.",
      origenOportunidadId: null,
    },
    {
      id: "exp_2026_07_laser_testimonio",
      hipotesis: "Si se produce un testimonio en video para láser facial, entonces el gancho superará el 30 %, porque el mercado sostiene testimonios más de 60 días.",
      servicio: "laser_facial",
      angulo: "testimonio",
      tipoPrueba: "creativo",
      inicio: "2026-07-07",
      fin: "2026-07-21",
      resultado: "gano",
      metricaExito: "gancho y costo por conversación",
      aprendizaje: "Gancho 33 %, costo por conversación 18 % por debajo del promedio. Se escaló.",
      origenOportunidadId: null,
    },
    {
      id: "exp_2026_09_confirmacion",
      hipotesis: "Si se confirma la cita 24 h antes y se recuerda 2 h antes, entonces la asistencia subirá 10 puntos, porque la inasistencia es proceso, no pauta.",
      servicio: null,
      angulo: null,
      tipoPrueba: "proceso",
      inicio: "2026-09-08",
      fin: null,
      resultado: "en_curso",
      metricaExito: "asistencia a citas",
      aprendizaje: null,
      origenOportunidadId: "op_r15",
    },
  ];
}

// ---------------------------------------------------------------------------
// Lote
// ---------------------------------------------------------------------------

export function generarSeed(semilla: number = SEMILLA): LoteDatos {
  const r = mulberry32(semilla);
  const fechasTodas = rangoDias(DESDE, HASTA);
  const fechas = fechasTodas.filter((f) => !HUECOS.includes(f));
  const insights = generarInsights(r, fechas);
  const desgloses = generarDesgloses(r, insights, fechas);
  const embudo = generarEmbudo(r, insights, fechas);
  const creativos = generarCreativos(fechasTodas);
  const anunciosCompetencia = generarCompetencia(r, fechasTodas);

  return {
    insights,
    desgloses,
    creativos,
    embudo,
    competidores: COMPETIDORES,
    anunciosCompetencia,
    experimentos: generarExperimentos(),
    meta: {
      generadoEn: `${HASTA}T18:00:00-05:00`,
      desde: DESDE,
      hasta: HASTA,
      origen: "seed",
      huecos: HUECOS,
      advertencias: [
        "Datos de demostración. Los tickets y costos de la clínica no están calibrados: las cifras de margen se muestran como “—”.",
        "Los desgloses por edad, zona y hora no suman exactamente al total por deduplicación de personas.",
      ],
    },
  };
}

function main() {
  const lote = generarSeed(SEMILLA);
  validarSinPII(lote);
  const r = LoteDatosSchema.safeParse(lote);
  if (!r.success) {
    console.error("El seed no cumple el contrato. NO se arregla el contrato: se arregla el seed.");
    console.error(r.error.issues.slice(0, 10));
    process.exit(1);
  }
  const raiz = resolve(dirname(fileURLToPath(import.meta.url)), "..");
  const destino = resolve(raiz, "datos", "seed.json");
  mkdirSync(dirname(destino), { recursive: true });
  writeFileSync(destino, JSON.stringify(lote), "utf8");
  console.log(
    `Seed generado en datos/seed.json · ${lote.insights.length} filas · ${lote.desgloses.length} desgloses · ${lote.embudo.length} registros de embudo · ${lote.anunciosCompetencia.length} anuncios de competencia · huecos: ${lote.meta.huecos.join(", ")}`,
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
