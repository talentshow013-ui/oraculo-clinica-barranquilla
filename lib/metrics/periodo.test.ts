import { describe, expect, test } from "vitest";
import { compararPeriodos, rangoDeMes, rangoUltimos, type FilaPeriodo } from "./periodo";

const f = (cuenta: string, id: string, gasto: number, resultados: number, tipo: string | null = "conversacion"): FilaPeriodo => ({ cuenta, campanaId: id, campana: `Campaña ${id}`, gasto, resultados, tipoResultado: tipo, impresiones: gasto * 10, clics: gasto / 100 });

describe("Periodo · rangos", () => {
  test("un mes completo (y el mes en curso llega hasta hoy)", () => {
    expect(rangoDeMes("2026-05", "2026-10-22")).toEqual({ desde: "2026-05-01", hasta: "2026-05-31" });
    expect(rangoDeMes("2026-02", "2026-10-22")).toEqual({ desde: "2026-02-01", hasta: "2026-02-28" });
    expect(rangoDeMes("2026-10", "2026-10-22")).toEqual({ desde: "2026-10-01", hasta: "2026-10-22" });
  });
  test("últimos N días contando hoy", () => {
    expect(rangoUltimos(31, "2026-10-22")).toEqual({ desde: "2026-09-22", hasta: "2026-10-22" });
  });
});

describe("Periodo · comparar dos periodos por campaña", () => {
  const a = [f("F3", "1", 100_000, 20), f("F3", "2", 50_000, 0, null), f("V6", "3", 30_000, 10)];
  const b = [f("F3", "1", 200_000, 25), f("V6", "4", 40_000, 8)];
  const r = compararPeriodos(a, b);
  test("totales: gasto, resultados y costo por resultado (los objetivos sin fruto no cuentan como resultado)", () => {
    expect(r.a).toMatchObject({ gasto: 180_000, resultados: 30, costoPorResultado: 6_000 });
    expect(r.b).toMatchObject({ gasto: 240_000, resultados: 33 });
  });
  test("cada campaña con sus dos periodos; las que solo están en uno quedan marcadas", () => {
    const c1 = r.campanas.find((c) => c.campanaId === "1")!;
    expect(c1.a?.costoPorResultado).toBe(5_000);
    expect(c1.b?.costoPorResultado).toBe(8_000);
    expect(r.campanas.find((c) => c.campanaId === "3")!.b).toBeNull();
    expect(r.campanas.find((c) => c.campanaId === "4")!.a).toBeNull();
    expect(r.campanas[0]!.campanaId).toBe("1"); // primero la de más gasto sumado
  });
  test("por cuenta", () => {
    expect(r.porCuenta.find((c) => c.cuenta === "V6")).toMatchObject({ a: { gasto: 30_000 }, b: { gasto: 40_000 } });
  });
});
