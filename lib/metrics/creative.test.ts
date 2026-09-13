import { describe, expect, test } from "vitest";
import type { Creativo, InsightRow } from "@/lib/adapters/types";
import { benchmarks } from "@/config/benchmarks";
import { clasificarCuadrante, evaluarCreativos, indiceFatiga, vidaUtil } from "@/lib/metrics/creative";
import { agregar } from "@/lib/metrics/core";
import { sumarDias } from "@/lib/format/fechas";

function fila(p: Partial<InsightRow>): InsightRow {
  return {
    fuente: "meta",
    fecha: "2026-09-01",
    nivel: "anuncio",
    id: "ad_1",
    nombre: "x",
    padreId: "adset_1",
    cuentaId: "act",
    objetivo: null,
    estado: "activo",
    gasto: 10000,
    impresiones: 1000,
    alcance: 800,
    frecuencia: 1.2,
    subastasGanadas: null,
    pujaPromedio: null,
    clics: 30,
    clicsEnlace: 20,
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
    resultados: 2,
    tipoResultado: null,
    valorConversion: null,
    ventanaAtribucion: "7d_click",
    ...p,
  };
}

/** Serie de n días: CTR de enlace y frecuencia evolucionan según funciones. */
function serie(n: number, ctrFn: (d: number) => number, frecFn: (d: number) => number): InsightRow[] {
  return Array.from({ length: n }, (_, d) => {
    const impresiones = 2000;
    const frec = frecFn(d);
    return fila({
      fecha: sumarDias("2026-06-01", d),
      impresiones,
      alcance: Math.round(impresiones / frec),
      frecuencia: frec,
      clicsEnlace: Math.round(impresiones * ctrFn(d)),
      clics: Math.round(impresiones * ctrFn(d) * 1.4),
    });
  });
}

describe("indiceFatiga", () => {
  test("está en [0,1] y trae la fórmula visible", () => {
    const r = indiceFatiga(serie(30, () => 0.02, () => 1.5));
    expect(r.indice).toBeGreaterThanOrEqual(0);
    expect(r.indice).toBeLessThanOrEqual(1);
    expect(typeof r.formulaVisible).toBe("string");
    expect(r.formulaVisible.length).toBeGreaterThan(20);
  });

  test("CTR estable y frecuencia estable → fatiga cercana a 0", () => {
    const r = indiceFatiga(serie(30, () => 0.02, () => 1.5));
    expect(r.indice).toBeLessThan(0.1);
  });

  test("misma caída de CTR pesa MÁS si la frecuencia sube (agotamiento real) que si está estable (ruido)", () => {
    const ctrCae = (d: number) => (d < 20 ? 0.03 : 0.015);
    const estable = indiceFatiga(serie(30, ctrCae, () => 1.5));
    const subiendo = indiceFatiga(serie(30, ctrCae, (d) => (d < 20 ? 1.5 : 3.5)));
    expect(estable.indice).not.toBeNull();
    expect(subiendo.indice).toBeGreaterThan(estable.indice ?? Number.POSITIVE_INFINITY);
  });

  test("con menos de 2 ventanas devuelve null (sin señal)", () => {
    const r = indiceFatiga(serie(3, () => 0.02, () => 1.5));
    expect(r.indice).toBeNull();
  });
});

describe("clasificarCuadrante", () => {
  const b = benchmarks;
  const bien = { hookRate: 0.4, costoResultado: 20000, impresiones: 10000, resultados: 30 };

  test("pocos datos → sin_senal, no se decide", () => {
    expect(clasificarCuadrante({ ...bien, impresiones: 200, resultados: 2 }, 25000, b)).toBe("sin_senal");
  });
  test("hook alto y costo bajo → escalar", () => {
    expect(clasificarCuadrante(bien, 25000, b)).toBe("escalar");
  });
  test("hook bajo y costo bajo → arreglar_gancho (convierte pero pocos se detienen)", () => {
    expect(clasificarCuadrante({ ...bien, hookRate: 0.1 }, 25000, b)).toBe("arreglar_gancho");
  });
  test("hook alto y costo alto → arreglar_oferta (detiene el scroll pero no vende)", () => {
    expect(clasificarCuadrante({ ...bien, costoResultado: 50000 }, 25000, b)).toBe("arreglar_oferta");
  });
  test("hook bajo y costo alto → matar", () => {
    expect(clasificarCuadrante({ ...bien, hookRate: 0.1, costoResultado: 50000 }, 25000, b)).toBe("matar");
  });
  test("sin hook rate (imagen) usa CTR de enlace como proxy de atención", () => {
    expect(clasificarCuadrante({ ...bien, hookRate: null, ctrEnlace: 0.03 }, 25000, b)).toBe("escalar");
  });
  test("sin costo de referencia de cuenta → sin_senal", () => {
    expect(clasificarCuadrante(bien, null, b)).toBe("sin_senal");
  });
});

describe("evaluarCreativos", () => {
  const creativo: Creativo = {
    id: "cr_1",
    anuncioId: "ad_1",
    formato: "video",
    urlMiniatura: null,
    copyPrincipal: "Toxina con médico estético",
    titular: null,
    descripcion: null,
    cta: null,
    urlDestino: null,
    fechaPrimerGasto: "2026-06-01",
    diasActivo: 30,
    servicio: "toxina",
    anguloDetectado: "autoridad_medica",
    nivelConsciencia: 3,
    confianzaClasificacion: 0.8,
    senalesDeteccion: ["médico"],
  };

  test("devuelve una evaluación por creativo con cuadrante y fatiga", () => {
    const filas = serie(30, () => 0.02, () => 1.5).map((f) => ({ ...f, resultados: 3, reproducciones3s: 800 }));
    const evals = evaluarCreativos([creativo], filas, benchmarks);
    expect(evals).toHaveLength(1);
    expect(evals[0]?.creativo.id).toBe("cr_1");
    expect(["escalar", "arreglar_gancho", "arreglar_oferta", "matar", "sin_senal"]).toContain(evals[0]?.cuadrante);
    expect(evals[0]?.fatiga.indice).not.toBeNull();
  });

  test("creativo sin filas → sin_senal y gasto 0", () => {
    const evals = evaluarCreativos([creativo], [], benchmarks);
    expect(evals[0]?.cuadrante).toBe("sin_senal");
    expect(evals[0]?.agregado.gasto).toBe(0);
  });

  test("vidaUtil: días hasta que el CTR cae bajo el umbral desde su mejor semana", () => {
    const filas = serie(40, (d) => (d < 25 ? 0.03 : 0.01), () => 2);
    expect(vidaUtil(filas, benchmarks)).toBe(25);
    expect(vidaUtil(serie(10, () => 0.03, () => 2), benchmarks)).toBeNull();
  });

  test("la agregación por creativo no promedia razones", () => {
    const filas = [fila({ impresiones: 100, clics: 1 }), fila({ fecha: "2026-09-02", impresiones: 900, clics: 90 })];
    const a = agregar(filas);
    expect(a.clics / a.impresiones).toBeCloseTo(0.091);
  });
});
