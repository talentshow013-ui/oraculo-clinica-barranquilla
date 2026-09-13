import { describe, expect, test } from "vitest";
import { cop, num, pct, ratio, VACIO } from "@/lib/format";
import { aFechaBogota, diasEntre, hoyBogota, listarHuecos, rangoDias, sumarDias } from "@/lib/format/fechas";

describe("formato es-CO", () => {
  test("pesos sin decimales con separador de miles", () => {
    expect(cop(1234567)).toBe("$ 1.234.567");
  });
  test("pesos redondea", () => {
    expect(cop(1234567.6)).toBe("$ 1.234.568");
  });
  test("porcentaje con coma decimal", () => {
    expect(pct(0.0913)).toBe("9,1 %");
  });
  test("null es — (vacío), nunca 0", () => {
    expect(cop(null)).toBe(VACIO);
    expect(pct(null)).toBe(VACIO);
    expect(num(null)).toBe(VACIO);
    expect(ratio(null)).toBe(VACIO);
    expect(VACIO).toBe("—");
  });
  test("ratio con una decimal y x", () => {
    expect(ratio(4)).toBe("4,0x");
    expect(ratio(0.8)).toBe("0,8x");
  });
  test("número entero con miles", () => {
    expect(num(45000)).toBe("45.000");
  });
});

describe("fechas en America/Bogota", () => {
  test("hoyBogota devuelve YYYY-MM-DD", () => {
    expect(hoyBogota()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
  test("una instante a las 04:30 UTC es el día anterior en Bogotá", () => {
    expect(aFechaBogota(new Date("2026-09-14T04:30:00Z"))).toBe("2026-09-13");
  });
  test("sumarDias cruza mes", () => {
    expect(sumarDias("2026-08-30", 3)).toBe("2026-09-02");
    expect(sumarDias("2026-09-01", -1)).toBe("2026-08-31");
  });
  test("diasEntre es inclusivo", () => {
    expect(diasEntre("2026-09-01", "2026-09-07")).toBe(7);
  });
  test("rangoDias lista cada día", () => {
    expect(rangoDias("2026-09-01", "2026-09-03")).toEqual(["2026-09-01", "2026-09-02", "2026-09-03"]);
  });
  test("listarHuecos encuentra días sin datos", () => {
    const presentes = new Set(["2026-09-01", "2026-09-03"]);
    expect(listarHuecos("2026-09-01", "2026-09-03", presentes)).toEqual(["2026-09-02"]);
  });
});
