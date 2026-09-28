import { describe, expect, test } from "vitest";
import { leadsDeAcciones, ritmoDelDia, type HoraPauta } from "./ritmo";

const h = (fecha: string, hora: number, gasto: number, leads: number): HoraPauta => ({ fecha, hora, gasto, leads });
const historico: HoraPauta[] = [];
for (const fecha of ["2026-09-21", "2026-09-22", "2026-09-23", "2026-09-24"]) for (let hora = 0; hora < 24; hora++) historico.push(h(fecha, hora, 5_000, hora >= 7 && hora <= 20 ? 2 : 0));

describe("leads de una fila por hora", () => {
  test("conversaciones iniciadas + formularios", () => {
    expect(leadsDeAcciones([{ action_type: "onsite_conversion.messaging_conversation_started_7d", value: "3" }, { action_type: "lead", value: "2" }, { action_type: "link_click", value: "40" }])).toBe(5);
    expect(leadsDeAcciones(undefined)).toBe(0);
  });
});

describe("ritmo del día contra los días anteriores a la misma hora", () => {
  test("hoy va por debajo: compara horas completas y da la diferencia", () => {
    const hoy = [h("2026-09-25", 7, 5_000, 1), h("2026-09-25", 8, 5_000, 0), h("2026-09-25", 9, 5_000, 1), h("2026-09-25", 10, 2_000, 3)];
    const r = ritmoDelDia([...historico, ...hoy], "2026-09-25", 10);
    expect(r.hoy).toMatchObject({ leads: 2, gasto: 15_000 }); // horas 0-9 (la 10 va en curso)
    expect(r.promedio.leads).toBe(6); // 7, 8 y 9 → 2 cada una
    expect(r.diferencia).toBeCloseTo(2 / 6 - 1, 5);
    expect(r.diasComparados).toBe(4);
    expect(r.horaMasFloja).toMatchObject({ hora: 8, hoy: 0, promedio: 2 });
    expect(r.enCurso).toMatchObject({ hora: 10, leads: 3 });
  });
  test("lo normal es la mediana (un día atípico no la infla) y se compara con el mismo día de la semana", () => {
    const atipico = [...historico.filter((x) => x.fecha !== "2026-09-24" && x.fecha !== "2026-09-21"), ...Array.from({ length: 24 }, (_, hora) => h("2026-09-24", hora, 50_000, 20))];
    const hoy = [h("2026-09-28", 7, 5_000, 2), h("2026-09-28", 8, 5_000, 2), h("2026-09-28", 9, 5_000, 2)];
    const r = ritmoDelDia([...atipico, ...hoy, ...[7, 8, 9].map((hora) => h("2026-09-21", hora, 5_000, 1))], "2026-09-28", 10);
    expect(r.promedio.leads).toBe(6); // mediana de 3, 6, 6, 60
    expect(r.mismoDia).toMatchObject({ leads: 3, dias: 1 }); // lunes 21
    expect(r.diferenciaMismoDia).toBeCloseTo(1, 5);
  });
  test("sin días anteriores no inventa comparación", () => {
    const r = ritmoDelDia([h("2026-09-25", 8, 1_000, 1)], "2026-09-25", 10);
    expect(r.diferencia).toBeNull();
    expect(r.diasComparados).toBe(0);
  });
});
