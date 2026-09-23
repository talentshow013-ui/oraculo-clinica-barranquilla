import { describe, expect, test } from "vitest";
import type { InsightRow } from "@/lib/adapters/types";
import { UMBRALES_CLINICA, claveAlerta, componerAlertasNuevas, componerAvisoPauta, estadoPauta, evaluarAlertas } from "./alertas";

const fila = (p: Partial<InsightRow> & { fecha: string; nivel: InsightRow["nivel"]; id: string }): InsightRow =>
  ({
    fuente: "meta", nombre: p.id, padreId: null, cuentaId: "act_1", objetivo: "MESSAGES", estado: "activo",
    gasto: 0, impresiones: 0, alcance: null, frecuencia: null, subastasGanadas: null, pujaPromedio: null,
    clics: 0, clicsEnlace: 0, clicsUnicos: null, interacciones: null, reacciones: null, comentarios: null, compartidos: null, guardados: null, visitasPerfil: null, seguidoresNuevos: null, vistasLandingPage: null,
    reproducciones: null, reproducciones2s: null, reproducciones3s: null, reproducciones6s: null, reproduccionesThru: null, p25: null, p50: null, p75: null, p95: null, p100: null, tiempoReproduccionTotal: null, duracionCreativoSeg: null,
    conversacionesIniciadas: null, conversacionesRespondidas: null, resultados: 0, tipoResultado: "conversacion", ventanaAtribucion: "7d_click", valorConversion: null, moneda: "COP",
    ...p,
  }) as InsightRow;

/* tres días de datos hasta el 20; campaña C1 con conjunto S1 y anuncios A1 (bueno), A2 (caro), A3 (rechazado), A4 (nuevo sin resultados) */
const dias = ["2026-09-18", "2026-09-19", "2026-09-20"];
const insights: InsightRow[] = dias.flatMap((f) => [
  fila({ fecha: f, nivel: "campana", id: "C1", nombre: "Toxina septiembre", gasto: 100_000, impresiones: 10_000, clics: 200, clicsEnlace: 150, conversacionesIniciadas: 30, resultados: 30 }),
  fila({ fecha: f, nivel: "conjunto", id: "S1", nombre: "Mujeres 30-55 BAQ", padreId: "C1", gasto: 100_000, impresiones: 10_000, clics: 100, clicsEnlace: 90, conversacionesIniciadas: 30, resultados: 30 }),
  fila({ fecha: f, nivel: "anuncio", id: "A1", nombre: "Reel antes/después", padreId: "S1", gasto: 40_000, impresiones: 5_000, clics: 120, clicsEnlace: 100, reproducciones3s: 1_500, reproduccionesThru: 1_200, conversacionesIniciadas: 20, resultados: 20 }),
  fila({ fecha: f, nivel: "anuncio", id: "A2", nombre: "Foto precio", padreId: "S1", gasto: 50_000, impresiones: 3_000, clics: 60, clicsEnlace: 40, reproducciones3s: 300, reproduccionesThru: 100, conversacionesIniciadas: 10, resultados: 10 }),
  fila({ fecha: f, nivel: "anuncio", id: "A3", nombre: "Testimonio", padreId: "S1", estado: "rechazado", gasto: 0, impresiones: 0 }),
]);
/* el Reel viene de antes: no es nuevo */
insights.push(fila({ fecha: "2026-09-15", nivel: "anuncio", id: "A1", nombre: "Reel antes/después", padreId: "S1", gasto: 40_000, impresiones: 5_000, clics: 120, clicsEnlace: 100, reproducciones3s: 1_500, reproduccionesThru: 1_200, conversacionesIniciadas: 20, resultados: 20 }));
insights.push(fila({ fecha: "2026-09-20", nivel: "anuncio", id: "A4", nombre: "Video nuevo", padreId: "S1", gasto: 10_000, impresiones: 2_500, clics: 10, clicsEnlace: 5, reproducciones3s: 100, reproduccionesThru: 50, conversacionesIniciadas: 0, resultados: 0 }));

describe("alertas · umbrales de la clínica", () => {
  const alertas = evaluarAlertas(insights, "2026-09-21", UMBRALES_CLINICA);
  const tipos = alertas.map((a) => `${a.tipo}:${a.entidad}`);
  test("CPL por encima de 4.000 (3 días): A2 sí, A1 no", () => {
    expect(tipos).toContain("cpl_alto:Foto precio");
    expect(tipos).not.toContain("cpl_alto:Reel antes/después");
    const a = alertas.find((x) => x.tipo === "cpl_alto" && x.entidad === "Foto precio")!;
    expect(a.texto).toMatch(/5\.000/);
  });
  test("anuncio rechazado", () => {
    expect(tipos).toContain("rechazado:Testimonio");
  });
  test("CTR bajo a nivel de conjunto (< 1,30 %)", () => {
    expect(tipos).toContain("ctr_bajo_conjunto:Mujeres 30-55 BAQ");
  });
  test("bajo rendimiento (regla de la clínica): > 2.000 impresiones, 0 resultados y CTR o gancho bajos", () => {
    expect(tipos).not.toContain("bajo_rendimiento:Foto precio"); // gancho bajo, pero sí trae leads
    expect(tipos).toContain("bajo_rendimiento:Video nuevo"); // 2.500 impresiones, 0 resultados, CTR 0,4 %
    expect(tipos).not.toContain("bajo_rendimiento:Reel antes/después");
    const v = alertas.find((x) => x.tipo === "bajo_rendimiento" && x.entidad === "Video nuevo")!;
    expect(v.ventanas).toEqual([3, 7, 15]);
  });
  test("sin datos → sin alertas", () => {
    expect(evaluarAlertas([], "2026-09-21", UMBRALES_CLINICA)).toEqual([]);
  });
});

describe("alertas · estado de la pauta (6 a. m., 12 m., 6 p. m.)", () => {
  const e = estadoPauta(insights, "2026-09-21");
  test("campañas al aire con sus anuncios, leads y costo; lo nuevo marcado", () => {
    expect(e.campanas).toHaveLength(1);
    const c = e.campanas[0]!;
    expect(c.nombre).toBe("Toxina septiembre");
    expect(c.leads).toBe(90);
    expect(c.cpl).toBeCloseTo(300_000 / 90, 2);
    expect(c.anuncios.map((a) => a.nombre)).toEqual(["Foto precio", "Reel antes/después", "Video nuevo"]); // por gasto; el rechazado no cuenta como activo
    expect(c.anuncios.find((a) => a.nombre === "Video nuevo")!.nuevo).toBe(true);
    expect(c.anuncios.find((a) => a.nombre === "Reel antes/después")!.nuevo).toBe(false);
    expect(e.ayer).toMatchObject({ fecha: "2026-09-20", leads: 30, gasto: 100_000 });
  });
  test("el mensaje lo dice en lenguaje de dueño", () => {
    const t = componerAvisoPauta([{ nombre: "Vivante (Meta)", insights }], { hoy: "2026-09-21", momento: "mediodía", umbrales: UMBRALES_CLINICA });
    expect(t).toMatch(/Toxina septiembre/);
    expect(t).toMatch(/NUEVO/);
    expect(t).toMatch(/Alertas/);
    expect(t).toMatch(/rechazado/i);
    expect(t.length).toBeLessThan(4000);
  });
});

describe("alertas · medición rota (gasto sin conversiones)", () => {
  const sinConv: InsightRow[] = ["2026-09-20", "2026-09-21"].map((f) => fila({ fecha: f, nivel: "campana", id: "G1", nombre: "Búsqueda", fuente: "google", tipoResultado: "conversion", gasto: 50_000, impresiones: 3_000, clics: 60, clicsEnlace: 60, resultados: 0 }));
  test("dos días completos gastando y cero conversiones → alarma de medición", () => {
    const a = evaluarAlertas(sinConv, "2026-09-22", UMBRALES_CLINICA);
    expect(a[0]).toMatchObject({ tipo: "sin_conversiones", nivel: "cuenta" });
    expect(a[0]!.texto).toMatch(/medición/);
  });
  test("con una sola conversión en esos días, no hay alarma", () => {
    const una = sinConv.map((f, i) => (i === 0 ? { ...f, resultados: 1 } : f));
    expect(evaluarAlertas(una, "2026-09-22", UMBRALES_CLINICA).some((x) => x.tipo === "sin_conversiones")).toBe(false);
  });
  test("una campaña de clics (no busca contactos) no dispara costo por lead", () => {
    const clics = insights.map((f) => (f.id === "C1" ? { ...f, tipoResultado: "link_click", resultados: 0, conversacionesIniciadas: null } : f));
    expect(evaluarAlertas(clics, "2026-09-21", UMBRALES_CLINICA).some((x) => x.tipo === "cpl_alto" && x.entidad === "Toxina septiembre")).toBe(false);
  });
  test("campañas que no buscan contactos (alcance) no cuentan", () => {
    const alcance = sinConv.map((f) => ({ ...f, fuente: "meta" as const, tipoResultado: null }));
    expect(evaluarAlertas(alcance, "2026-09-22", UMBRALES_CLINICA).some((x) => x.tipo === "sin_conversiones")).toBe(false);
  });
});

describe("alertas · aviso en el momento (solo lo nuevo)", () => {
  test("clave estable por cuenta, tipo y entidad", () => {
    expect(claveAlerta("Vivante", { tipo: "rechazado", entidad: "Testimonio" })).toBe("Vivante|rechazado|Testimonio");
  });
  test("el mensaje junta las alertas nuevas por cuenta", () => {
    const t = componerAlertasNuevas([{ cuenta: "F3 Corporal", alerta: { tipo: "rechazado", nivel: "anuncio", entidad: "X", ventanas: [], texto: "Anuncio rechazado: «X»." } }], "10:40");
    expect(t).toMatch(/Alerta nueva · 10:40/);
    expect(t).toMatch(/F3 Corporal/);
    expect(t).toMatch(/⛔/);
  });
});
