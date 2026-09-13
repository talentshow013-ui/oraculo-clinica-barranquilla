import { describe, expect, test } from "vitest";
import { benchmarks } from "@/config/benchmarks";
import { cliente, estaCalibrado, margenUnitario, ticketPromedio } from "@/config/cliente";

describe("config del cliente", () => {
  test("los tickets arrancan en cero: sin calibrar", () => {
    expect(estaCalibrado()).toBe(false);
    expect(ticketPromedio()).toBeNull();
    expect(margenUnitario("toxina")).toBeNull();
  });
  test("zonas válidas son el área metropolitana", () => {
    expect(cliente.zonasValidas).toContain("Barranquilla");
    expect(cliente.zonasValidas).toContain("Soledad");
    expect(cliente.zonasValidas).not.toContain("Cartagena");
  });
  test("con ticket y costo calibrados el margen se calcula", () => {
    const cfg = {
      ...cliente,
      servicios: [{ id: "x", nombre: "x", ticketCOP: 500000, costoDirectoCOP: 150000, recurrenciaMeses: null }],
    };
    expect(margenUnitario("x", cfg)).toBe(350000);
  });
});

describe("benchmarks", () => {
  test("todos declaran origen y arrancan sin calibrar", () => {
    for (const u of Object.values(benchmarks)) {
      expect(u.origen.length).toBeGreaterThan(10);
      expect(u.calibrado).toBe(false);
    }
  });
});
