import { describe, expect, test } from "vitest";
import { campanasInterruptor, resumirBitacora } from "./bitacora";
import type { CambioCuenta } from "@/lib/adapters/types";

const cambio = (p: Partial<CambioCuenta>): CambioCuenta => ({
  fuente: "meta", cuentaId: "act", fecha: "2026-09-01", hora: "10:00", actor: "Ana", tipo: "Estado de la campaña actualizado", objetoTipo: "campana", objetoId: "c1", objetoNombre: "Crio fríos", campanaId: "c1", accion: "apagar", de: "Activa", a: "Inactiva", ...p,
});

describe("bitácora: quién cambió qué", () => {
  const cambios = [
    cambio({ fecha: "2026-08-27", accion: "prender", actor: "Andrés" }),
    cambio({ fecha: "2026-09-01", accion: "apagar", actor: "María" }),
    cambio({ fecha: "2026-09-01", hora: "10:05", accion: "prender", actor: "María" }),
    cambio({ fecha: "2026-09-03", accion: "apagar", actor: "Andrés" }),
    cambio({ fecha: "2026-09-12", accion: "prender", actor: "Dayana" }),
    cambio({ fecha: "2026-09-02", objetoId: "c2", campanaId: "c2", objetoNombre: "Ultrahifu", accion: "apagar" }),
    cambio({ fecha: "2026-09-02", objetoTipo: "anuncio", objetoId: "a1", accion: "revision", actor: "Meta" }),
    cambio({ fecha: "2026-08-22", objetoTipo: "cuenta", objetoId: "u1", accion: "persona_agregada", actor: "María" }),
    cambio({ fecha: "2026-07-10", accion: "apagar", actor: "Viejo" }), // fuera del rango
  ];
  const rango = { desde: "2026-08-17", hasta: "2026-09-13" };

  test("cuenta cambios por persona, personas agregadas y los interruptores de más a menos", () => {
    const r = resumirBitacora(cambios, rango);
    expect(r.total).toBe(8);
    expect(r.porActor[0]).toEqual({ actor: "María", cambios: 3, apagados: 1, prendidos: 1 });
    expect(r.personasAgregadas).toBe(1);
    expect(r.interruptores[0]).toMatchObject({ objetoId: "c1", nombre: "Crio fríos", apagados: 2, prendidos: 3, actores: ["Andrés", "María", "Dayana"], ultimo: "2026-09-12" });
    expect(r.interruptores[1]).toMatchObject({ objetoId: "c2", apagados: 1, prendidos: 0 });
    expect(r.porSemana.reduce((s, x) => s + x.cambios, 0)).toBe(8);
  });

  test("campañas interruptor: 3 o más prendidos/apagados en el rango", () => {
    const i = campanasInterruptor(cambios, rango);
    expect(i.map((x) => x.objetoId)).toEqual(["c1"]);
    expect(campanasInterruptor(cambios, { desde: "2026-09-10", hasta: "2026-09-13" })).toEqual([]);
  });
});
