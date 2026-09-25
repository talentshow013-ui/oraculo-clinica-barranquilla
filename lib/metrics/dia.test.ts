import { describe, expect, test } from "vitest";
import type { InsightRow } from "@/lib/adapters/types";
import { resumenDelDia } from "./dia";

const fila = (p: Partial<InsightRow> & { fecha: string; id: string; cuentaId: string }): InsightRow =>
  ({
    fuente: "meta", nivel: "campana", nombre: p.id, padreId: null, objetivo: null, estado: "activo",
    gasto: 0, impresiones: 0, alcance: null, frecuencia: null, subastasGanadas: null, pujaPromedio: null,
    clics: 0, clicsEnlace: 0, clicsUnicos: null, interacciones: null, reacciones: null, comentarios: null, compartidos: null, guardados: null, visitasPerfil: null, seguidoresNuevos: null, vistasLandingPage: null,
    reproducciones: null, reproducciones2s: null, reproducciones3s: null, reproducciones6s: null, reproduccionesThru: null, p25: null, p50: null, p75: null, p95: null, p100: null, tiempoReproduccionTotal: null, duracionCreativoSeg: null,
    conversacionesIniciadas: null, conversacionesRespondidas: null, resultados: 0, tipoResultado: "conversacion", ventanaAtribucion: "7d_click", valorConversion: null,
    ...p,
  }) as InsightRow;

const cuentas = [
  { nombre: "F3 Corporal", insights: [
    fila({ fecha: "2026-09-25", id: "C1", nombre: "Crio", cuentaId: "a", gasto: 100_000, resultados: 25 }),
    fila({ fecha: "2026-09-25", id: "C2", nombre: "Lipo", cuentaId: "a", gasto: 50_000, resultados: 0 }),
    fila({ fecha: "2026-09-25", id: "S1", nivel: "conjunto", cuentaId: "a", gasto: 150_000, resultados: 25 }),
    fila({ fecha: "2026-09-24", id: "C1", nombre: "Crio", cuentaId: "a", gasto: 200_000, resultados: 40 }),
  ] },
  { nombre: "Google Ads", insights: [fila({ fecha: "2026-09-25", id: "G1", nombre: "Búsqueda", cuentaId: "g", fuente: "google", gasto: 20_000, resultados: 2 })] },
  { nombre: "Sin pauta hoy", insights: [fila({ fecha: "2026-09-20", id: "X", cuentaId: "x", gasto: 9_000, resultados: 1 })] },
];

describe("resumen del día (gasto y resultados de hoy y de ayer)", () => {
  const r = resumenDelDia(cuentas, "2026-09-25");
  test("por cuenta: solo filas de campaña, hoy y ayer, costo por resultado del motor", () => {
    expect(r.cuentas[0]).toMatchObject({ nombre: "F3 Corporal", hoy: { gasto: 150_000, resultados: 25, costoPorResultado: 6_000 }, ayer: { gasto: 200_000, resultados: 40, costoPorResultado: 5_000 } });
  });
  test("campañas de hoy ordenadas por gasto; sin resultados → costo null (no infinito)", () => {
    expect(r.cuentas[0]!.campanas.map((c) => c.nombre)).toEqual(["Crio", "Lipo"]);
    expect(r.cuentas[0]!.campanas[1]!.costoPorResultado).toBeNull();
  });
  test("total del día suma todas las cuentas; la cuenta sin pauta hoy va en cero", () => {
    expect(r.total.hoy).toMatchObject({ gasto: 170_000, resultados: 27 });
    expect(r.cuentas[2]!.hoy).toMatchObject({ gasto: 0, resultados: 0, costoPorResultado: null });
  });
});
