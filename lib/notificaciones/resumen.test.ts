import { describe, expect, test } from "vitest";
import type { InsightRow } from "@/lib/adapters/types";
import { UMBRALES_CLINICA } from "./alertas";
import { componerResumenConciso, nombreCorto, resumenConciso } from "./resumen";

const fila = (p: Partial<InsightRow> & { fecha: string; id: string }): InsightRow =>
  ({
    fuente: "meta", nivel: "anuncio", nombre: p.id, padreId: "S1", cuentaId: "act_1", objetivo: "MESSAGES", estado: "activo",
    gasto: 0, impresiones: 1000, alcance: null, frecuencia: null, subastasGanadas: null, pujaPromedio: null,
    clics: 10, clicsEnlace: 10, clicsUnicos: null, interacciones: null, reacciones: null, comentarios: null, compartidos: null, guardados: null, visitasPerfil: null, seguidoresNuevos: null, vistasLandingPage: null,
    reproducciones: null, reproducciones2s: null, reproducciones3s: null, reproducciones6s: null, reproduccionesThru: null, p25: null, p50: null, p75: null, p95: null, p100: null, tiempoReproduccionTotal: null, duracionCreativoSeg: null,
    conversacionesIniciadas: null, conversacionesRespondidas: null, resultados: 0, tipoResultado: "conversacion", ventanaAtribucion: "7d_click", valorConversion: null,
    ...p,
  }) as InsightRow;

const dias = ["2026-09-23", "2026-09-24", "2026-09-25"];
const insights: InsightRow[] = dias.flatMap((f) => [
  fila({ fecha: f, nivel: "campana", id: "C1", nombre: "Campaña", padreId: null, gasto: 160_000, resultados: 42, conversacionesIniciadas: 42 }),
  fila({ fecha: f, id: "A1", nombre: "✅ VENTAS I PUBLICOS FRIOS 🔵 I MARZO I 🟫CRIOLIPOLISIS 🟪 I ANUNCIO I GANADOR❇️", gasto: 40_000, resultados: 20, conversacionesIniciadas: 20 }),
  fila({ fecha: f, id: "A2", nombre: "🤗 Creativo 3 ⚪ LandingPage_Crio", gasto: 100_000, resultados: 2, conversacionesIniciadas: 2 }),
  fila({ fecha: f, id: "A3", nombre: "Normal", gasto: 20_000, resultados: 5, conversacionesIniciadas: 5 }),
  fila({ fecha: f, id: "A4", nombre: "Testimonio", estado: "rechazado" }),
]);
/* los anuncios vienen de antes: no son pruebas nuevas */
for (const id of ["A1", "A2", "A3"]) insights.push(fila({ fecha: "2026-09-15", id, nombre: insights.find((f) => f.id === id)!.nombre, gasto: 1_000, resultados: 1, conversacionesIniciadas: 1 }));

describe("nombre corto", () => {
  test("sin emojis ni separadores, y cortado", () => {
    expect(nombreCorto("✅ VENTAS I PUBLICOS FRIOS 🔵 I MARZO I 🟫CRIOLIPOLISIS 🟪 I ANUNCIO I GANADOR❇️")).toBe("VENTAS · PUBLICOS FRIOS · MARZO · CRIOLIPOLISIS · …");
    expect(nombreCorto("🤗 Creativo 3 ⚪ LandingPage_Crio")).toBe("Creativo 3 LandingPage_Crio");
  });
});

describe("resumen conciso (lo que pidió la clínica)", () => {
  const r = resumenConciso([{ nombre: "F3 Corporal", insights }], "2026-09-25", "2026-09-25", UMBRALES_CLINICA);
  test("gasto, leads y costo por lead del día", () => {
    expect(r.dia).toMatchObject({ gasto: 160_000, leads: 42 });
    expect(r.dia.cpl).toBeCloseTo(160_000 / 42, 2);
    expect(r.anterior).toMatchObject({ gasto: 160_000, leads: 42 });
  });
  test("oportunidad: el anuncio que trae leads mucho más baratos que el promedio", () => {
    expect(r.oportunidades[0]!.texto).toMatch(/CRIOLIPOLISIS/);
    expect(r.oportunidades[0]!.texto).toMatch(/subir/i);
  });
  test("riesgos: el anuncio que quema plata primero, y el rechazado", () => {
    expect(r.riesgos[0]!.texto).toMatch(/LandingPage_Crio/);
    expect(r.riesgos.some((x) => /rechaz/i.test(x.texto))).toBe(true);
    expect(r.riesgos.length).toBeLessThanOrEqual(3);
  });
  test("el mensaje es corto y en lenguaje de dueño", () => {
    const t = componerResumenConciso(r, { momento: "12 m.", etiquetaDia: "Hoy hasta ahora", urlPanel: "https://x/panel" });
    expect(t).toMatch(/Gasto/);
    expect(t).toMatch(/Leads/);
    expect(t).toMatch(/Costo por lead/);
    expect(t).toMatch(/Oportunidades/);
    expect(t).toMatch(/Riesgos/);
    expect(t.split("\n").length).toBeLessThanOrEqual(26);
    expect(t).not.toMatch(/🟪|❇️/);
  });
});
