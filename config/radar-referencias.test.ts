import { describe, expect, test } from "vitest";
import { CIUDADES_REFERENTES, REFERENTES_SEGUIDOS } from "./radar-referencias";

describe("Radar · referentes seguidos por página", () => {
  test("cada referente tiene id de página numérico, país, ciudad del radar y la razón medida", () => {
    expect(REFERENTES_SEGUIDOS.length).toBeGreaterThanOrEqual(10);
    for (const r of REFERENTES_SEGUIDOS) {
      expect(r.pageId).toMatch(/^\d{6,}$/);
      expect(["CO", "US"]).toContain(r.pais);
      expect(r.ciudad.length).toBeGreaterThan(2);
      expect(r.porQue.length).toBeGreaterThan(10);
    }
  });
  test("sin repetidos y sin Vivante (no es competencia)", () => {
    const ids = REFERENTES_SEGUIDOS.map((r) => r.pageId);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).not.toContain("367038300938550");
  });
  test("las ciudades por palabra clave siguen ahí", () => {
    expect(CIUDADES_REFERENTES.map((c) => c.ciudad)).toContain("Medellín");
  });
});
