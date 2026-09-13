import { describe, expect, test } from "vitest";
import { benchmarks } from "@/config/benchmarks";
import { cliente } from "@/config/cliente";
import {
  analizarRadar,
  cadenciaSemanal,
  entradasYSalidas,
  espaciosVacios,
  ganadoresProbados,
  mapaAngulos,
  participacionVoz,
  perfilar,
  puntuacionLongevidad,
} from "@/lib/competitive";
import { anuncioCompetidor, creativo, HOY } from "@/lib/diagnostics/fixtures";
import { sumarDias } from "@/lib/format/fechas";

describe("puntuacionLongevidad", () => {
  test("está en [0,1] y crece con los días de forma saturante", () => {
    const a = puntuacionLongevidad({ diasCorriendo: 10, activo: true, variantesDelConcepto: 1 });
    const b = puntuacionLongevidad({ diasCorriendo: 60, activo: true, variantesDelConcepto: 1 });
    const c = puntuacionLongevidad({ diasCorriendo: 200, activo: true, variantesDelConcepto: 1 });
    expect(a).toBeLessThan(b);
    expect(b).toBeLessThan(c);
    expect(c - b).toBeLessThan(b - a); // saturante
    expect(c).toBeLessThanOrEqual(1);
  });
  test("más variantes = mayor puntuación (está invirtiendo en escalarlo)", () => {
    const uno = puntuacionLongevidad({ diasCorriendo: 60, activo: true, variantesDelConcepto: 1 });
    const cinco = puntuacionLongevidad({ diasCorriendo: 60, activo: true, variantesDelConcepto: 5 });
    expect(cinco).toBeGreaterThan(uno);
  });
  test("inactivo pesa menos que activo", () => {
    expect(puntuacionLongevidad({ diasCorriendo: 60, activo: false, variantesDelConcepto: 1 })).toBeLessThan(
      puntuacionLongevidad({ diasCorriendo: 60, activo: true, variantesDelConcepto: 1 }),
    );
  });
});

describe("radar", () => {
  const anuncios = [
    anuncioCompetidor({ anuncioId: "a1", competidorId: "c1", diasCorriendo: 90, primeraVez: sumarDias(HOY, -90), anguloDetectado: "aspiracional", servicioDetectado: "laser_facial", nivelConsciencia: 2, variantesDelConcepto: 4 }),
    anuncioCompetidor({ anuncioId: "a2", competidorId: "c1", diasCorriendo: 65, primeraVez: sumarDias(HOY, -65), anguloDetectado: "promocion", servicioDetectado: "toxina", nivelConsciencia: 5, usaPrecio: true }),
    anuncioCompetidor({ anuncioId: "a3", competidorId: "c2", diasCorriendo: 12, primeraVez: sumarDias(HOY, -12), anguloDetectado: "promocion", servicioDetectado: "toxina", nivelConsciencia: 5, usaPrecio: true }),
    anuncioCompetidor({ anuncioId: "a4", competidorId: "c2", diasCorriendo: 5, primeraVez: sumarDias(HOY, -20), ultimaVez: sumarDias(HOY, -15), activo: false, anguloDetectado: "urgencia", servicioDetectado: "acido", nivelConsciencia: 4 }),
    anuncioCompetidor({ anuncioId: "a5", competidorId: "c3", diasCorriendo: 3, primeraVez: sumarDias(HOY, -3), anguloDetectado: "promocion", servicioDetectado: "depilacion", nivelConsciencia: 5 }),
  ];

  test("ganadoresProbados son los de 60+ días, ordenados por longevidad", () => {
    const g = ganadoresProbados(anuncios, benchmarks);
    expect(g.map((a) => a.anuncioId)).toEqual(["a1", "a2"]);
  });

  test("cadenciaSemanal cuenta nuevos por semana en las últimas 4 semanas", () => {
    const c = cadenciaSemanal(anuncios, HOY);
    // a3 (12 días), a4 (20 días), a5 (3 días) son nuevos en 28 días → 3/4
    expect(c.total).toBeCloseTo(0.75);
    expect(c.porCompetidor.get("c2")).toBeCloseTo(0.5);
  });

  test("entradasYSalidas: salidas rápidas = les fue mal", () => {
    const r = entradasYSalidas(anuncios, HOY);
    expect(r.entradas.map((a) => a.anuncioId)).toContain("a5");
    expect(r.salidas.map((a) => a.anuncioId)).toEqual(["a4"]);
    expect(r.salidasRapidas.map((a) => a.anuncioId)).toEqual(["a4"]);
  });

  test("mapaAngulos marca saturados (más de la mitad de los competidores)", () => {
    const m = mapaAngulos(anuncios);
    const promo = m.find((x) => x.angulo === "promocion");
    expect(promo?.anuncios).toBe(3);
    expect(promo?.competidores).toBe(3);
    expect(promo?.saturado).toBe(true);
    expect(m.find((x) => x.angulo === "urgencia")?.saturado).toBe(false);
  });

  test("espaciosVacios devuelve combinaciones servicio × ángulo × consciencia que nadie ataca", () => {
    const e = espaciosVacios(anuncios, cliente);
    expect(e.length).toBeGreaterThan(0);
    // toxina × promocion × 5 está atacado; toxina × educativo × 2 no.
    expect(e.some((x) => x.servicio === "toxina" && x.angulo === "promocion" && x.nivelConsciencia === 5)).toBe(false);
    expect(e.some((x) => x.servicio === "toxina" && x.angulo === "educativo" && x.nivelConsciencia === 2)).toBe(true);
    // nunca proponen antes_despues (riesgo de política)
    expect(e.some((x) => x.angulo === "antes_despues")).toBe(false);
  });

  test("participacionVoz = propios activos / (propios + competencia activos)", () => {
    expect(participacionVoz(2, anuncios)).toBeCloseTo(2 / (2 + 4));
    expect(participacionVoz(0, [])).toBeNull();
  });

  test("perfilar resume a un competidor sin inventar gasto", () => {
    const p = perfilar("c1", anuncios, benchmarks);
    expect(p.anunciosActivos).toBe(2);
    expect(p.ganadores).toBe(2);
    expect(p.angulos).toContain("aspiracional");
    expect(p).not.toHaveProperty("gastoEstimado");
    expect(p).not.toHaveProperty("roas");
  });

  test("analizarRadar arma el resultado completo", () => {
    const r = analizarRadar(anuncios, [creativo()], cliente, benchmarks, HOY);
    expect(r.ganadores.length).toBe(2);
    expect(r.espaciosVacios.length).toBeGreaterThan(0);
    expect(r.perfiles.length).toBe(3);
    expect(r.usoPrecio).toBeCloseTo(2 / 5);
  });
});
