import { describe, expect, test } from "vitest";
import {
  AVISO_PANEL,
  CAMPOS_PROHIBIDOS,
  ErrorDatoSensible,
  K_MINIMO,
  enmascarar,
  filtrarPorK,
  pseudonimizar,
  validarSinPII,
} from "@/lib/privacy";

describe("validarSinPII — la carga falla ruidosamente", () => {
  test("un campo telefono lanza ErrorDatoSensible citando la Ley 1581", () => {
    expect(() => validarSinPII({ telefono: "3001234567" })).toThrow(ErrorDatoSensible);
    expect(() => validarSinPII({ telefono: "3001234567" })).toThrow(/Ley 1581/);
  });
  test("detecta campos anidados y dentro de arrays", () => {
    expect(() => validarSinPII({ embudo: [{ paso: "venta", cedula: "123" }] })).toThrow(ErrorDatoSensible);
  });
  test("no distingue mayúsculas ni acentos", () => {
    expect(() => validarSinPII({ Teléfono: "x" })).toThrow(ErrorDatoSensible);
    expect(() => validarSinPII({ EMAIL: "x" })).toThrow(ErrorDatoSensible);
  });
  test("un objeto limpio pasa y devuelve el mismo objeto", () => {
    const o = { paso: "venta", cantidad: 3, nombreCampana: "Toxina" };
    expect(validarSinPII(o)).toBe(o);
  });
  test("el error dice qué ruta disparó", () => {
    try {
      validarSinPII({ embudo: [{ correo: "a@b.c" }] });
    } catch (e) {
      expect((e as ErrorDatoSensible).ruta).toBe("embudo[0].correo");
    }
  });
  test("la lista de prohibidos incluye los básicos", () => {
    for (const c of ["nombre", "cedula", "telefono", "email", "direccion", "historia"]) {
      expect(CAMPOS_PROHIBIDOS).toContain(c);
    }
  });
});

describe("k-anonimato", () => {
  test("k mínimo es 5", () => {
    expect(K_MINIMO).toBe(5);
  });
  test("enmascarar oculta cruces con n < k", () => {
    expect(enmascarar(10, 3)).toBeNull();
    expect(enmascarar(10, 5)).toBe(10);
    expect(enmascarar(10, 4, 4)).toBe(10);
  });
  test("filtrarPorK separa visibles y ocultas", () => {
    const filas = [{ nRegistros: 2 }, { nRegistros: 7 }, { nRegistros: 5 }];
    const r = filtrarPorK(filas);
    expect(r.visibles).toHaveLength(2);
    expect(r.ocultas).toHaveLength(1);
  });
});

describe("pseudonimizar", () => {
  test("determinista con la misma sal", () => {
    expect(pseudonimizar("abc", "sal1")).toBe(pseudonimizar("abc", "sal1"));
  });
  test("distinto con otra sal", () => {
    expect(pseudonimizar("abc", "sal1")).not.toBe(pseudonimizar("abc", "sal2"));
  });
  test("no contiene el valor original", () => {
    expect(pseudonimizar("3001234567", "s")).not.toContain("3001234567");
  });
});

test("AVISO_PANEL habla en lenguaje de persona normal", () => {
  expect(AVISO_PANEL).toMatch(/pacientes|personas/i);
  expect(AVISO_PANEL).not.toMatch(/\b(API|MCP|Zod)\b/);
});
