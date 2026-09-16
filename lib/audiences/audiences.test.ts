import { describe, expect, test } from "vitest";
import { analizarPublicos, resumirSegmentacion } from "./index";
import { benchmarks } from "@/config/benchmarks";
import type { Publico } from "@/lib/adapters/types";

function publico(p: Partial<Omit<Publico, "segmentacion">> & { segmentacion?: Partial<Publico["segmentacion"]> } = {}): Publico {
  const { segmentacion, ...resto } = p;
  return {
    fuente: "meta", cuentaId: "act", conjuntoId: "s1", nombre: "Conjunto", campanaId: "c1", campanaNombre: "Campaña", estado: "activo", objetivo: "CONVERSATIONS", destino: "WHATSAPP", presupuestoDiario: 40_000, creado: "2026-07-01", aprendizaje: null,
    desde: "2026-06-15", hasta: "2026-09-15", gasto: 1_000_000, impresiones: 100_000, alcance: 60_000, clicsEnlace: 800, resultados: 250, tipoResultado: "conversacion",
    ...resto,
    segmentacion: { edadMin: 25, edadMax: 55, genero: "todos", lugares: ["Vivante (10 km)"], radioKm: 10, excluidos: [], intereses: [], personalizados: [], similares: [], publicosExcluidos: [], advantage: false, plataformas: ["instagram"], tipo: "amplio", ...segmentacion },
  };
}

describe("públicos: quién rinde y qué segmentación copiar", () => {
  const lista = [
    publico({ conjuntoId: "a", nombre: "Remarketing IG 365", gasto: 600_000, resultados: 300, segmentacion: { tipo: "remarketing", personalizados: ["Interacción IG 365"], genero: "mujeres", edadMin: 30, edadMax: 55 } }), // $2.000
    publico({ conjuntoId: "b", nombre: "Intereses fitness", gasto: 1_200_000, resultados: 200, segmentacion: { tipo: "intereses", intereses: ["Gimnasio", "Dieta"], radioKm: 22 } }), // $6.000
    publico({ conjuntoId: "c", nombre: "Advantage", gasto: 1_000_000, resultados: 250, segmentacion: { tipo: "advantage", advantage: true } }), // $4.000
    publico({ conjuntoId: "d", nombre: "Nuevo sin señal", gasto: 20_000, impresiones: 900, resultados: 3 }),
  ];
  const r = analizarPublicos(lista, benchmarks);

  test("referencia = gasto ÷ resultados de todos; cuadrantes por diferencia contra la referencia; sin señal no se juzga", () => {
    expect(r.referencia).toBeCloseTo(2_820_000 / 753, 0);
    const por = Object.fromEntries(r.todos.map((p) => [p.conjuntoId, p.cuadrante]));
    expect(por).toEqual({ a: "ganador", b: "caro", c: "al_costo", d: "sin_senal" }); // c: $4.000 vs $3.745 de referencia → dentro del ±10 %
    expect(r.todos[0]!.puesto).toBe(1);
    expect(r.todos[0]!.conjuntoId).toBe("a");
    expect(r.ganadores.map((p) => p.conjuntoId)).toEqual(["a"]);
  });

  test("agrupa por tipo, edad, género y radio con costo del grupo (sumas, no promedios)", () => {
    expect(r.porTipo[0]).toMatchObject({ clave: "remarketing", conjuntos: 1, resultados: 300, costoResultado: 2_000 });
    expect(r.porGenero.find((g) => g.clave === "mujeres")!.costoResultado).toBe(2_000);
    expect(r.porRadio.find((g) => g.clave === "16–30 km")!.conjuntos).toBe(1);
    expect(r.porEdad.find((g) => g.clave === "30–55")!.mejor!.conjuntoId).toBe("a");
  });

  test("las sugerencias nacen de los grupos con 50+ resultados y de los ganadores, y dicen de qué conjunto copiar", () => {
    const titulos = r.sugerencias.map((s) => s.titulo);
    expect(titulos.some((t) => /Remarketing/.test(t))).toBe(true);
    expect(titulos.some((t) => /30–55/.test(t))).toBe(true);
    expect(titulos.some((t) => /Solo mujeres/i.test(t))).toBe(true);
    expect(r.sugerencias.find((s) => /Copiar la segmentación/.test(s.titulo))!.conjuntoId).toBe("a");
    for (const s of r.sugerencias) expect(s.evidencia.length).toBeGreaterThan(0);
  });

  test("sin públicos → sinDatos, sin inventar", () => {
    expect(analizarPublicos([], benchmarks).sinDatos).toBe(true);
  });

  test("la segmentación se resume en una frase de dueño", () => {
    expect(resumirSegmentacion(lista[0]!)).toBe("Remarketing (ya te conocen) · 30–55 años · solo mujeres · 10 km alrededor de la clínica · remarketing: Interacción IG 365");
  });
});
