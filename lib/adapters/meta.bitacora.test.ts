import { describe, expect, test } from "vitest";
import { parsearBitacoraMeta, parsearFechaMeta } from "./meta.bitacora";

const evento = (p: Record<string, unknown>) => ({
  event_type: "Estado de la campaña actualizado",
  actor_id: "1",
  actor_name: "Ana Operadora",
  object_id: "120001",
  object_name: "AON I VENTAS I CRIO",
  application_name: "",
  datetime: "25/8/2026 a las 9:47 a. m.",
  extra_data: JSON.stringify({ old_value: "Activa", new_value: "Inactiva" }),
  ...p,
});

describe("bitácora de cambios de Meta → contrato", () => {
  test("fecha y hora en español de Colombia («25/8/2026 a las 9:47 a. m.», «a la 1:08 p. m.»)", () => {
    expect(parsearFechaMeta("25/8/2026 a las 9:47 a. m.")).toEqual({ fecha: "2026-08-25", hora: "09:47" });
    expect(parsearFechaMeta("31/8/2026 a la 1:08 p. m.")).toEqual({ fecha: "2026-08-31", hora: "13:08" });
    expect(parsearFechaMeta("2/7/2026 a las 12:05 a. m.")).toEqual({ fecha: "2026-07-02", hora: "00:05" });
    expect(parsearFechaMeta("2/7/2026 a las 12:05 p. m.")).toEqual({ fecha: "2026-07-02", hora: "12:05" });
    expect(parsearFechaMeta("rara")).toBeNull();
  });

  test("clasifica el objeto (campaña / conjunto / anuncio / cuenta), la acción (apagar / prender / revisión / persona) y quita duplicados", () => {
    const crudo = {
      ad_account_id: "1",
      ventanas: [
        { eventos: [evento({}), evento({ event_type: "Estado del conjunto de anuncios actualizado", object_id: "s1", extra_data: JSON.stringify({ old_value: "Inactivo", new_value: "Activo" }) })] },
        { eventos: [evento({}), evento({ event_type: "Estado del anuncio actualizado", actor_name: "Meta", object_id: "a1", extra_data: JSON.stringify({ old_value: "Revisión pendiente", new_value: "Activo", campaign_id: 120001 }) })] },
        { eventos: [evento({ event_type: "Persona agregada a la cuenta", object_id: "u1", object_name: "", extra_data: JSON.stringify({ user_id: 5, new_value: "Administrador de la cuenta publicitaria", type: "user_role" }) })] },
      ],
    };
    const r = parsearBitacoraMeta(JSON.stringify(crudo), "act_1");
    expect(r).toHaveLength(4); // el primero estaba repetido en dos ventanas
    const campana = r.find((c) => c.objetoId === "120001")!;
    expect(campana).toMatchObject({ cuentaId: "act_1", fecha: "2026-08-25", hora: "09:47", actor: "Ana Operadora", objetoTipo: "campana", accion: "apagar", de: "Activa", a: "Inactiva", objetoNombre: "AON I VENTAS I CRIO" });
    expect(r.find((c) => c.objetoId === "s1")).toMatchObject({ objetoTipo: "conjunto", accion: "prender" });
    expect(r.find((c) => c.objetoId === "a1")).toMatchObject({ objetoTipo: "anuncio", accion: "revision", actor: "Meta", campanaId: "120001" });
    expect(r.find((c) => c.objetoId === "u1")).toMatchObject({ objetoTipo: "cuenta", accion: "persona_agregada", a: "Administrador de la cuenta publicitaria" });
  });

  test("acepta la respuesta directa del conector ({result: \"[...]\"})", () => {
    const r = parsearBitacoraMeta(JSON.stringify({ result: JSON.stringify([evento({})]) }), "act_1");
    expect(r).toHaveLength(1);
  });
});
