import { describe, expect, test } from "vitest";
import { correrMotor, fuenteActiva } from "@/lib/datos";
import { generarSeed } from "@/scripts/seed";

describe("correrMotor sobre el seed — encuentra los patrones plantados", () => {
  const lote = generarSeed();

  test("produce el resultado completo sin errores de reglas", async () => {
    const r = await correrMotor(lote);
    expect(r.erroresReglas).toEqual([]);
    expect(r.embudo).toHaveLength(8);
    expect(r.catalogo).toHaveLength(145);
    expect(r.lentes).toHaveLength(7);
    expect(r.creativos.length).toBeGreaterThan(5);
    expect(r.oportunidades.length).toBeGreaterThan(3);
    expect(r.hoy).toBe(lote.meta.hasta);
  });

  test("encuentra al menos 8 patrones plantados (§11)", async () => {
    const r = await correrMotor(lote);
    const ids = new Set(r.hallazgos.map((h) => h.reglaId));
    const esperados = ["R07", "R10", "R15", "R11", "R02", "R12", "R23", "R24"];
    const encontrados = esperados.filter((id) => ids.has(id));
    expect(encontrados.length, `encontrados: ${[...ids].join(", ")}`).toBeGreaterThanOrEqual(8);
  });

  test("los hallazgos vienen ordenados por plata y ninguno inventa cifras (null se conserva)", async () => {
    const r = await correrMotor(lote);
    const conPlata = r.hallazgos.filter((h) => h.plataEnRiesgo !== null).map((h) => h.plataEnRiesgo!);
    for (let i = 1; i < conPlata.length; i++) expect(conPlata[i - 1]).toBeGreaterThanOrEqual(conPlata[i]!);
    expect(r.hallazgos.some((h) => h.plataEnRiesgo === null)).toBe(true); // p. ej. R23 huecos
  });

  test("sin calibrar, POAS y CAC/margen son null; el retorno real sí se calcula", async () => {
    const r = await correrMotor(lote);
    expect(r.negocio.poas).toBeNull();
    expect(r.negocio.ratioCacMargen).toBeNull();
    expect(r.negocio.roasReal).not.toBeNull();
    expect(r.negocio.calibrado).toBe(false);
  });

  test("la inasistencia plantada se detecta en la ventana reciente y la fuga más cara está en pesos", async () => {
    const r = await correrMotor(lote);
    const r15 = r.hallazgos.find((h) => h.reglaId === "R15");
    expect(r15).toBeDefined();
    expect(r15!.evidencia.some((e) => e.valor === "últimos 14 días")).toBe(true);
    expect(r.fugaMasCara).not.toBeNull();
    expect(r.fugaMasCara!.fugaCOP).toBeGreaterThan(0);
    expect(r.embudo[1]!.fugaCOP).toBeNull(); // impresión→clic no se valoriza
  });

  test("privacidad: reporta cuántos segmentos se ocultaron", async () => {
    const r = await correrMotor(lote);
    expect(r.privacidad.k).toBe(5);
    expect(r.privacidad.segmentosOcultos).toBeGreaterThanOrEqual(0);
  });

  test("las métricas maestras se resuelven a valores (o null), nunca a NaN/Infinity", async () => {
    const r = await correrMotor(lote);
    for (const m of r.maestras) {
      if (typeof m.valor === "number") expect(Number.isFinite(m.valor), m.id).toBe(true);
    }
    expect(r.maestras.length).toBeGreaterThanOrEqual(16);
  });
});

describe("fuenteActiva", () => {
  test("por defecto es demostración; con ORACULO_FUENTE=archivo es la real", () => {
    expect(fuenteActiva("seed").nombre).toBe("demostracion");
    expect(fuenteActiva("archivo").nombre).toBe("campanas_y_audiencias");
    expect(fuenteActiva(undefined).nombre).toBe("demostracion");
  });
});
