import { describe, expect, test } from "vitest";
import type { LoteKommo } from "@/lib/adapters/kommo";
import { analizarPacientes } from "./index";

const r = (fecha: string, paso: "lead_calificado" | "cita_agendada" | "cita_asistida" | "venta", cantidad: number, fuente = "desconocido", valorCOP: number | null = null) => ({ fecha, campanaId: null, fuenteAtribuida: fuente as "meta", paso, cantidad, valorCOP, servicio: null, sede: null, nRegistros: cantidad });

const lote: LoteKommo = {
  etapas: [
    { id: 1, nombre: "Leads Entrantes", pipelineId: 10, tipo: "normal", orden: 1 },
    { id: 2, nombre: "AGENDADO", pipelineId: 10, tipo: "normal", orden: 2 },
    { id: 142, nombre: "Leads ganados", pipelineId: 10, tipo: "ganado", orden: 99 },
  ],
  embudo: [
    r("2026-09-01", "lead_calificado", 400), r("2026-09-01", "cita_agendada", 8), r("2026-09-01", "cita_asistida", 3), r("2026-09-01", "venta", 2, "desconocido", 900000),
    r("2026-09-02", "lead_calificado", 300, "meta"), r("2026-09-02", "cita_agendada", 4, "meta"), r("2026-09-02", "venta", 1, "meta", 0),
    r("2026-09-08", "lead_calificado", 500), r("2026-09-08", "cita_agendada", 10),
    r("2026-07-01", "lead_calificado", 9999), // fuera
  ],
  meta: { capturadoEn: "2026-09-20T10:00:00Z", desde: "2026-06-23", hasta: "2026-09-20", origen: "kommo", leads: 1200, avisos: ["aviso x"] },
};
const rango = { desde: "2026-08-24", hasta: "2026-09-20" };

describe("pacientes · sin datos", () => {
  test("null → sinDatos", () => {
    expect(analizarPacientes(null, rango).sinDatos).toBe(true);
  });
});

describe("pacientes · totales y tasas del periodo", () => {
  const p = analizarPacientes(lote, rango);
  test("suma solo el periodo y calcula las tasas entre pasos", () => {
    expect(p.totales).toEqual({ leads: 1200, citas: 22, asistieron: 3, ventas: 3, valorVentas: 900000 });
    expect(p.tasas.leadACita).toBeCloseTo(22 / 1200, 6);
    expect(p.tasas.citaAAsistencia).toBeCloseTo(3 / 22, 6);
    expect(p.tasas.asistenciaAVenta).toBeCloseTo(3 / 3, 6);
    expect(p.tasas.leadAVenta).toBeCloseTo(3 / 1200, 6);
  });
  test("por fuente, ordenado por leads; desconocido se llama así", () => {
    expect(p.porFuente[0]).toMatchObject({ fuente: "desconocido", leads: 900, citas: 18 });
    expect(p.porFuente[1]).toMatchObject({ fuente: "meta", leads: 300, citas: 4, ventas: 1 });
  });
  test("serie semanal con leads y citas", () => {
    expect(p.porSemana.length).toBeGreaterThanOrEqual(2);
    expect(p.porSemana[0]).toMatchObject({ leads: 700, citas: 12 });
  });
  test("lecturas de dueño: la fuga principal y el precio en cero", () => {
    const t = p.lecturas.join(" ");
    expect(t).toMatch(/1,8 %/);
    expect(t).toMatch(/no dicen de dónde vienen/);
    const sinValor = analizarPacientes({ ...lote, embudo: lote.embudo.map((x) => ({ ...x, valorCOP: 0 })) }, rango);
    expect(sinValor.lecturas.join(" ")).toMatch(/precio/);
    expect(p.fuente.registros).toBe(9); // 10 registros menos el de julio
    expect(p.avisos).toEqual(["aviso x"]);
  });
});
