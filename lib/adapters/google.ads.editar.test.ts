import { describe, expect, test } from "vitest";
import { aMicros, cuerpoEstado, cuerpoPresupuesto, resolverCampana, type CampanaGoogle } from "./google.ads.editar";

const C: CampanaGoogle[] = [
  { id: "24231395161", nombre: "Busqueda_Facial_Barranquilla_2026-09-07", estado: "ENABLED", presupuestoRecurso: "customers/1/campaignBudgets/9", presupuestoDiario: 34_000, compartido: false },
  { id: "24319071734", nombre: "Busqueda_Corporal_Barranquilla_2026-10-04", estado: "ENABLED", presupuestoRecurso: "customers/1/campaignBudgets/8", presupuestoDiario: 27_000, compartido: false },
  { id: "24313804767", nombre: "Busqueda_Marca_Barranquilla_2026-10-04", estado: "PAUSED", presupuestoRecurso: "customers/1/campaignBudgets/7", presupuestoDiario: 5_000, compartido: false },
];

describe("Google Ads · editar", () => {
  test("encontrar la campaña por id o por parte del nombre (sin tildes ni mayúsculas)", () => {
    expect(resolverCampana(C, "24319071734").nombre).toContain("Corporal");
    expect(resolverCampana(C, "búsqueda facial").id).toBe("24231395161");
    expect(resolverCampana(C, "marca").estado).toBe("PAUSED");
  });
  test("si hay varias o ninguna, error claro con las opciones (nunca adivinar)", () => {
    expect(() => resolverCampana(C, "busqueda")).toThrow(/varias.*Facial.*Corporal/s);
    expect(() => resolverCampana(C, "tiktok")).toThrow(/ninguna/);
  });
  test("pesos a micros de Google", () => {
    expect(aMicros(50_000)).toBe("50000000000");
    expect(() => aMicros(0)).toThrow();
    expect(() => aMicros(-5)).toThrow();
  });
  test("cuerpos de cambio: solo el campo que se cambia, y con validación previa si se pide", () => {
    expect(cuerpoPresupuesto(C[0]!, 40_000, true)).toEqual({ validateOnly: true, operations: [{ update: { resourceName: "customers/1/campaignBudgets/9", amountMicros: "40000000000" }, updateMask: "amount_micros" }] });
    expect(cuerpoEstado("1", C[0]!, "PAUSED", false)).toEqual({ validateOnly: false, operations: [{ update: { resourceName: "customers/1/campaigns/24231395161", status: "PAUSED" }, updateMask: "status" }] });
  });
});
