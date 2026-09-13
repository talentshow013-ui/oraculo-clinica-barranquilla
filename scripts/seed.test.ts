import { describe, expect, test } from "vitest";
import { LoteDatosSchema } from "@/lib/adapters/types";
import { generarSeed, SEMILLA, DIAS } from "@/scripts/seed";
import { validarSinPII } from "@/lib/privacy";
import { diasEntre } from "@/lib/format/fechas";

describe("seed determinista", () => {
  const lote = generarSeed(SEMILLA);

  test("misma semilla → mismo lote", () => {
    expect(JSON.stringify(generarSeed(SEMILLA))).toBe(JSON.stringify(lote));
  });

  test("otra semilla → otro lote", () => {
    expect(JSON.stringify(generarSeed(SEMILLA + 1))).not.toBe(JSON.stringify(lote));
  });

  test("pasa el contrato completo (mismo Zod que la fuente real)", () => {
    const r = LoteDatosSchema.safeParse(lote);
    if (!r.success) console.error(r.error.issues.slice(0, 5));
    expect(r.success).toBe(true);
  });

  test("no contiene datos de paciente", () => {
    expect(() => validarSinPII(lote)).not.toThrow();
  });

  test("cubre 180 días con exactamente 2 huecos declarados", () => {
    expect(DIAS).toBe(180);
    expect(diasEntre(lote.meta.desde, lote.meta.hasta)).toBe(180);
    expect(lote.meta.huecos).toHaveLength(2);
    const fechas = new Set(lote.insights.map((f) => f.fecha));
    for (const h of lote.meta.huecos) expect(fechas.has(h)).toBe(false);
    expect(fechas.size).toBe(178);
  });

  test("tiene niveles campaña, conjunto y anuncio", () => {
    const niveles = new Set(lote.insights.map((f) => f.nivel));
    expect(niveles).toEqual(new Set(["campana", "conjunto", "anuncio"]));
  });

  test("hay 6 competidores y ~50 anuncios, algunos de 60+ días", () => {
    expect(lote.competidores).toHaveLength(6);
    expect(lote.anunciosCompetencia.length).toBeGreaterThanOrEqual(45);
    expect(lote.anunciosCompetencia.length).toBeLessThanOrEqual(55);
    expect(lote.anunciosCompetencia.filter((a) => a.diasCorriendo >= 60).length).toBeGreaterThanOrEqual(5);
    expect(lote.anunciosCompetencia.every((a) => a.alcanceRango === null)).toBe(true);
  });

  test("~22 % de la inversión con ubicación está fuera del radio", () => {
    const ubic = lote.desgloses.filter((d) => d.dimension === "ubicacion");
    const total = ubic.reduce((s, d) => s + d.gasto, 0);
    const fuera = ubic.filter((d) => ["Cartagena", "Santa Marta", "Bogotá"].includes(d.valor)).reduce((s, d) => s + d.gasto, 0);
    expect(fuera / total).toBeGreaterThan(0.18);
    expect(fuera / total).toBeLessThan(0.26);
  });

  test("el segmento 65+ gasta y no convierte", () => {
    const seg = lote.desgloses.filter((d) => d.dimension === "edad" && d.valor === "65+");
    expect(seg.reduce((s, d) => s + d.gasto, 0)).toBeGreaterThan(0);
    expect(seg.reduce((s, d) => s + d.resultados, 0)).toBe(0);
  });

  test("~50 % de la pauta corre fuera del horario de atención", () => {
    const horas = lote.desgloses.filter((d) => d.dimension === "hora");
    const total = horas.reduce((s, d) => s + d.gasto, 0);
    const fuera = horas.filter((d) => Number(d.valor) < 8 || Number(d.valor) >= 18).reduce((s, d) => s + d.gasto, 0);
    expect(fuera / total).toBeGreaterThan(0.4);
    expect(fuera / total).toBeLessThan(0.6);
  });

  test("la asistencia a citas cae en los últimos 25 días", () => {
    const corte = lote.meta.hasta.slice(0, 8) + "01"; // aproximación: último mes
    const asist = (desde: boolean) =>
      lote.embudo.filter((r) => (desde ? r.fecha >= corte : r.fecha < corte)).reduce(
        (acc, r) => {
          if (r.paso === "cita_agendada") acc.ag += r.cantidad;
          if (r.paso === "cita_asistida") acc.as += r.cantidad;
          return acc;
        },
        { ag: 0, as: 0 },
      );
    const antes = asist(false);
    const despues = asist(true);
    expect(despues.as / despues.ag).toBeLessThan(antes.as / antes.ag - 0.1);
  });

  test("hay ventas con valor en pesos y experimentos registrados", () => {
    expect(lote.embudo.some((r) => r.paso === "venta" && r.valorCOP !== null && r.valorCOP > 0)).toBe(true);
    expect(lote.experimentos.length).toBeGreaterThanOrEqual(2);
    expect(lote.experimentos.some((e) => e.resultado === "perdio")).toBe(true);
  });
});
