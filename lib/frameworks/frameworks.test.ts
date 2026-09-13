import { describe, expect, test } from "vitest";
import { LENTES, aplicarLentes, type EntradaLentes } from "@/lib/frameworks";
import { benchmarks } from "@/config/benchmarks";
import { cliente } from "@/config/cliente";

const entradaVacia: EntradaLentes = {
  creativos: [],
  negocio: {
    gasto: 0,
    ingresosCaja: null,
    showRate: null,
    cierreEnConsultorio: null,
    costoCitaAsistida: null,
    cac: null,
    roasReal: null,
    margenFraccion: null,
    margenUnitarioCOP: null,
    poas: null,
    ratioCacMargen: null,
    ltv: null,
    ltvSobreCac: null,
    tasaRecompra: null,
    calibrado: false,
  },
  radar: null,
  hallazgos: [],
  cliente,
  benchmarks,
};

describe("mesa de consultores — marcos publicados, no personas simuladas", () => {
  test("hay 7 lentes y cada una cita su fuente", () => {
    expect(LENTES).toHaveLength(7);
    for (const l of LENTES) {
      expect(l.fuente).toMatch(/Hormozi|Schwartz|Cialdini|Miller|Ogilvy|Holmes|North Star|AARRR/);
      expect(l.paraQue.length).toBeGreaterThan(10);
      expect(l.criterios.length).toBeGreaterThanOrEqual(3);
    }
  });

  test("cada criterio declara con qué dato del panel se responde y qué hacer si falla", () => {
    const r = aplicarLentes(entradaVacia);
    for (const lente of r) {
      for (const c of lente.criterios) {
        expect(c.datoPanel.length).toBeGreaterThan(3);
        expect(c.accionSiFalla.length).toBeGreaterThan(10);
      }
    }
  });

  test("sin datos, cumple es null (no se inventa)", () => {
    const r = aplicarLentes(entradaVacia);
    const nulos = r.flatMap((l) => l.criterios).filter((c) => c.cumple === null).length;
    expect(nulos).toBeGreaterThan(5);
  });

  test("con margen y CAC calibrados, la jerarquía de métricas evalúa", () => {
    const r = aplicarLentes({
      ...entradaVacia,
      negocio: { ...entradaVacia.negocio, calibrado: true, cac: 200_000, margenUnitarioCOP: 500_000, ratioCacMargen: 0.4, poas: 1.6, roasReal: 4, showRate: 0.8 },
    });
    const norte = r.find((l) => /North Star/.test(l.fuente))!;
    const cacMargen = norte.criterios.find((c) => /margen/i.test(c.criterio))!;
    expect(cacMargen.cumple).toBe(true);
  });

  test("ninguna lente pone palabras en boca de una persona", () => {
    for (const l of LENTES) {
      expect(l.paraQue).not.toMatch(/dice que|diría|opina/);
    }
  });
});
