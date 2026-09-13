import { describe, expect, test } from "vitest";
import type { InsightRow } from "@/lib/adapters/types";
import {
  agregar,
  concentracionHHI,
  ctr,
  delta,
  holdRate,
  hookRate,
  razon,
  serieDiaria,
  sumaNullable,
  ventanasIguales,
} from "@/lib/metrics/core";

function fila(p: Partial<InsightRow>): InsightRow {
  return {
    fuente: "meta",
    fecha: "2026-09-01",
    nivel: "anuncio",
    id: "ad_1",
    nombre: "x",
    padreId: null,
    cuentaId: "act",
    objetivo: null,
    estado: "activo",
    gasto: 0,
    impresiones: 0,
    alcance: null,
    frecuencia: null,
    subastasGanadas: null,
    pujaPromedio: null,
    clics: 0,
    clicsEnlace: 0,
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
    resultados: 0,
    tipoResultado: null,
    valorConversion: null,
    ventanaAtribucion: "7d_click",
    ...p,
  };
}

describe("razon — null no es 0", () => {
  test("denominador 0 devuelve null, nunca Infinity", () => {
    expect(razon(1, 0)).toBeNull();
  });
  test("numerador null devuelve null", () => {
    expect(razon(null, 5)).toBeNull();
  });
  test("denominador null devuelve null", () => {
    expect(razon(5, null)).toBeNull();
  });
  test("0/5 es 0: medido y fue cero", () => {
    expect(razon(0, 5)).toBe(0);
  });
  test("nunca devuelve NaN", () => {
    expect(razon(Number.NaN, 5)).toBeNull();
  });
});

describe("sumaNullable", () => {
  test("todos null → null (no sabemos)", () => {
    expect(sumaNullable([null, null])).toBeNull();
  });
  test("ignora null si hay algún valor", () => {
    expect(sumaNullable([null, 3, 4])).toBe(7);
  });
  test("lista vacía → null", () => {
    expect(sumaNullable([])).toBeNull();
  });
});

describe("agregar — nunca se promedian promedios", () => {
  test("CTR agregado de 1/100 y 90/900 es 9,1 %, no 5,5 %", () => {
    const a = agregar([
      fila({ fecha: "2026-09-01", impresiones: 100, clics: 1 }),
      fila({ fecha: "2026-09-02", impresiones: 900, clics: 90 }),
    ]);
    expect(ctr(a)).toBeCloseTo(0.091, 6);
    expect(ctr(a)).not.toBeCloseTo(0.055, 3);
  });
  test("alcance todo null queda null, no 0", () => {
    const a = agregar([fila({}), fila({})]);
    expect(a.alcance).toBeNull();
  });
  test("cuenta días distintos y entidades distintas", () => {
    const a = agregar([
      fila({ fecha: "2026-09-01", id: "a" }),
      fila({ fecha: "2026-09-01", id: "b" }),
      fila({ fecha: "2026-09-02", id: "a" }),
    ]);
    expect(a.dias).toBe(2);
    expect(a.entidades).toBe(2);
  });
});

describe("compatibilidad de plataformas en video", () => {
  test("hookRate usa 3s cuando existe", () => {
    const a = agregar([fila({ impresiones: 1000, reproducciones3s: 300, reproducciones2s: 500 })]);
    expect(hookRate(a)).toBeCloseTo(0.3);
  });
  test("hookRate cae a 2s cuando no hay 3s (TikTok)", () => {
    const a = agregar([fila({ impresiones: 1000, reproducciones2s: 500 })]);
    expect(hookRate(a)).toBeCloseTo(0.5);
  });
  test("holdRate usa ThruPlay y cae a 6s", () => {
    const conThru = agregar([fila({ impresiones: 1000, reproduccionesThru: 100, reproducciones6s: 200 })]);
    const sinThru = agregar([fila({ impresiones: 1000, reproducciones6s: 200 })]);
    expect(holdRate(conThru)).toBeCloseTo(0.1);
    expect(holdRate(sinThru)).toBeCloseTo(0.2);
  });
});

describe("ventanasIguales — comparaciones honestas", () => {
  test("7 días contra 28 días se rechaza", () => {
    expect(
      ventanasIguales({ desde: "2026-09-01", hasta: "2026-09-07" }, { desde: "2026-08-01", hasta: "2026-08-28" }),
    ).toBe(false);
  });
  test("14 contra 14 se acepta", () => {
    expect(
      ventanasIguales({ desde: "2026-09-01", hasta: "2026-09-14" }, { desde: "2026-08-18", hasta: "2026-08-31" }),
    ).toBe(true);
  });
});

describe("serie y concentración", () => {
  test("serieDiaria agrega por fecha en orden", () => {
    const s = serieDiaria([
      fila({ fecha: "2026-09-02", gasto: 5 }),
      fila({ fecha: "2026-09-01", gasto: 1 }),
      fila({ fecha: "2026-09-01", gasto: 2, id: "b" }),
    ]);
    expect(s.map((p) => p.fecha)).toEqual(["2026-09-01", "2026-09-02"]);
    expect(s[0]?.agregado.gasto).toBe(3);
  });
  test("HHI de un solo creativo es 1", () => {
    expect(concentracionHHI([100])).toBe(1);
  });
  test("HHI de 4 iguales es 0,25", () => {
    expect(concentracionHHI([1, 1, 1, 1])).toBeCloseTo(0.25);
  });
  test("delta contra base 0 es null", () => {
    expect(delta(10, 0)).toBeNull();
    expect(delta(12, 10)).toBeCloseTo(0.2);
  });
});
