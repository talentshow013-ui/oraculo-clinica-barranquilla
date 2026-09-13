/**
 * Constructores de datos sintéticos para tests del motor. No es código de producción.
 */
import type {
  AnuncioCompetidor,
  BreakdownRow,
  Creativo,
  InsightRow,
  LoteDatos,
  RegistroEmbudo,
} from "@/lib/adapters/types";
import { rangoDias } from "@/lib/format/fechas";

export const DESDE = "2026-07-15";
export const HASTA = "2026-09-12";
export const HOY = "2026-09-12";

export function fila(p: Partial<InsightRow> = {}): InsightRow {
  return {
    fuente: "meta",
    fecha: "2026-09-01",
    nivel: "anuncio",
    id: "ad_1",
    nombre: "Toxina · autoridad",
    padreId: "adset_1",
    cuentaId: "act_1",
    objetivo: "mensajes",
    estado: "activo",
    gasto: 100_000,
    impresiones: 10_000,
    alcance: 7_000,
    frecuencia: 1.4,
    subastasGanadas: null,
    pujaPromedio: null,
    clics: 300,
    clicsEnlace: 200,
    clicsUnicos: null,
    interacciones: 150,
    reacciones: 100,
    comentarios: 10,
    compartidos: 5,
    guardados: 20,
    visitasPerfil: null,
    seguidoresNuevos: null,
    vistasLandingPage: 180,
    reproducciones: 4_000,
    reproducciones2s: null,
    reproducciones3s: 3_000,
    reproducciones6s: null,
    reproduccionesThru: 1_200,
    p25: 2_500,
    p50: 1_800,
    p75: 1_300,
    p95: 900,
    p100: 800,
    tiempoReproduccionTotal: 40_000,
    duracionCreativoSeg: 20,
    conversacionesIniciadas: 40,
    conversacionesRespondidas: 38,
    resultados: 40,
    tipoResultado: "conversacion",
    valorConversion: null,
    ventanaAtribucion: "7d_click_1d_view",
    ...p,
  };
}

/** Una fila por día para cada anuncio. `ajuste` recibe el índice del día (0 = primero). */
export function serieAnuncio(
  id: string,
  ajuste: (d: number, fecha: string) => Partial<InsightRow> = () => ({}),
  desde = DESDE,
  hasta = HASTA,
): InsightRow[] {
  return rangoDias(desde, hasta).map((fecha, d) => fila({ id, fecha, nombre: id, ...ajuste(d, fecha) }));
}

export function desglose(p: Partial<BreakdownRow> & Pick<BreakdownRow, "dimension" | "valor">): BreakdownRow {
  return { ...fila({ id: "acc", nivel: "cuenta", padreId: null }), nRegistros: 50, ...p };
}

export function registro(
  paso: RegistroEmbudo["paso"],
  cantidad: number,
  p: Partial<RegistroEmbudo> = {},
): RegistroEmbudo {
  return {
    fecha: "2026-09-01",
    campanaId: "camp_1",
    fuenteAtribuida: "meta",
    paso,
    cantidad,
    valorCOP: null,
    servicio: "toxina",
    sede: null,
    nRegistros: cantidad,
    ...p,
  };
}

/** Embudo repartido por día en el rango, con las cantidades TOTALES dadas. */
export function embudoDiario(
  totales: Partial<Record<RegistroEmbudo["paso"], number>>,
  desde = DESDE,
  hasta = HASTA,
  valorVentaCOP: number | null = null,
): RegistroEmbudo[] {
  const dias = rangoDias(desde, hasta);
  const salida: RegistroEmbudo[] = [];
  for (const [paso, total] of Object.entries(totales) as [RegistroEmbudo["paso"], number][]) {
    const porDia = total / dias.length;
    dias.forEach((fecha) => {
      salida.push(
        registro(paso, porDia, {
          fecha,
          valorCOP: paso === "venta" && valorVentaCOP !== null ? porDia * valorVentaCOP : null,
        }),
      );
    });
  }
  return salida;
}

export function creativo(p: Partial<Creativo> = {}): Creativo {
  return {
    id: "cr_1",
    anuncioId: "ad_1",
    formato: "video",
    urlMiniatura: null,
    copyPrincipal: "Toxina botulínica aplicada por médico estético certificado.",
    titular: null,
    descripcion: null,
    cta: "Escríbenos",
    urlDestino: null,
    fechaPrimerGasto: DESDE,
    diasActivo: 60,
    servicio: "toxina",
    anguloDetectado: "autoridad_medica",
    nivelConsciencia: 3,
    confianzaClasificacion: 0.8,
    senalesDeteccion: ["médico"],
    ...p,
  };
}

export function anuncioCompetidor(p: Partial<AnuncioCompetidor> = {}): AnuncioCompetidor {
  return {
    competidorId: "comp_1",
    nombreAnunciante: "Clínica X",
    anuncioId: "cx_1",
    primeraVez: "2026-06-01",
    ultimaVez: HASTA,
    diasCorriendo: 100,
    activo: true,
    plataformas: ["facebook", "instagram"],
    copy: "Rejuvenece tu piel con nuestro láser. Agenda tu valoración.",
    titular: null,
    cta: "Más información",
    urlMedia: null,
    tipoMedia: "video",
    urlDestino: null,
    dominioDestino: null,
    alcanceRango: null,
    variantesDelConcepto: 2,
    servicioDetectado: "laser_facial",
    anguloDetectado: "aspiracional",
    nivelConsciencia: 2,
    usaPrecio: false,
    usaUrgencia: false,
    usaProfesional: false,
    usaTestimonio: false,
    usaGarantia: false,
    puntuacionLongevidad: 0.8,
    ...p,
  };
}

export function lote(p: Partial<LoteDatos> = {}): LoteDatos {
  return {
    insights: [],
    desgloses: [],
    creativos: [],
    embudo: [],
    competidores: [],
    anunciosCompetencia: [],
    experimentos: [],
    meta: {
      generadoEn: `${HOY}T10:00:00-05:00`,
      desde: DESDE,
      hasta: HASTA,
      origen: "seed",
      huecos: [],
      advertencias: [],
    },
    ...p,
  };
}
