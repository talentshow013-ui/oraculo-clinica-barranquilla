import { describe, expect, test } from "vitest";
import { construirComparativa, mejorMes, resumenMercadoMeta } from "./comparativa";
import { fila } from "@/lib/diagnostics/fixtures";
import { rangoDias } from "@/lib/format/fechas";
import type { RankingAnuncio } from "@/lib/adapters/types";

const dias = (desde: string, hasta: string, gasto: number, conv: number) =>
  rangoDias(desde, hasta).map((fecha) => fila({ nivel: "campana", id: "c1", fecha, gasto, resultados: conv, conversacionesIniciadas: conv, tipoResultado: "conversacion" }));

const ranking = (anuncioId: string, interaccion: RankingAnuncio["interaccion"], conversion: RankingAnuncio["conversion"]): RankingAnuncio => ({
  fuente: "meta", cuentaId: "act", anuncioId, nombre: anuncioId, fecha: "2026-09-15", cohorte: "mensajes · públicos nuevos", calidad: "promedio", interaccion, conversion, lecturaMeta: "x",
});

describe("frente a quién te comparas", () => {
  test("el mejor mes es el de menor costo por conversación entre los meses con al menos 15 días de gasto", () => {
    const filas = [...dias("2026-06-15", "2026-06-30", 100_000, 20), ...dias("2026-07-01", "2026-07-31", 100_000, 40), ...dias("2026-08-01", "2026-08-31", 100_000, 25), ...dias("2026-09-01", "2026-09-05", 100_000, 90)];
    const { mejor, considerados } = mejorMes(filas);
    expect(considerados).toBe(3); // septiembre tiene 5 días: no califica; junio tiene 16
    expect(mejor!.etiqueta).toBe("julio 2026");
    expect(mejor!.costoConversacion).toBe(2_500);
    expect(mejor!.dias).toBe(31);
  });
  test("sin ningún mes completo, mejorMes es null y se dice cuántos se miraron", () => {
    expect(mejorMes(dias("2026-09-01", "2026-09-05", 10, 1))).toEqual({ mejor: null, considerados: 0 });
  });
  test("resumen del ranking de Meta: cuántos por encima, igual, por debajo y sin dato", () => {
    const r = resumenMercadoMeta([ranking("a", "superior", "promedio"), ranking("b", "inferior_35", "promedio"), ranking("c", "sin_dato", "sin_dato"), ranking("d", "promedio", "promedio")]);
    expect(r).toEqual({ fecha: "2026-09-15", anunciosConDato: 3, mejor: 1, igual: 1, inferior: 1, sinDato: 1 });
    expect(resumenMercadoMeta([])).toBeNull();
  });
  test("la comparativa junta tú, anterior, mejor mes y mercado con sus rangos", () => {
    const filas = [...dias("2026-07-01", "2026-07-31", 100_000, 40), ...dias("2026-08-01", "2026-09-13", 100_000, 20)];
    const c = construirComparativa(filas, { reciente: { desde: "2026-08-31", hasta: "2026-09-13" }, previa: { desde: "2026-08-17", hasta: "2026-08-30" } }, [ranking("a", "inferior_20", "promedio")]);
    expect(c.tu.dias).toBe(14);
    expect(c.tu.costoConversacion).toBe(5_000);
    expect(c.anterior.dias).toBe(14);
    expect(c.mejorMes!.etiqueta).toBe("julio 2026");
    expect(c.mercadoMeta!.inferior).toBe(1);
  });
});
