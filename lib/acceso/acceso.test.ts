import { describe, expect, test } from "vitest";
import { autorizar, cabeceraDesafio } from "./index";

const b64 = (s: string) => Buffer.from(s, "utf8").toString("base64");

describe("candado del panel — usuario y clave por variables de entorno", () => {
  test("sin usuario/clave configurados, el panel queda abierto (uso local)", () => {
    expect(autorizar(null, { usuario: "", clave: "" })).toBe("abierto");
    expect(autorizar(null, { usuario: undefined, clave: undefined })).toBe("abierto");
  });

  test("con clave configurada y sin cabecera → pide credenciales", () => {
    expect(autorizar(null, { usuario: "pilar", clave: "secreta" })).toBe("pedir");
  });

  test("credenciales correctas → permitido; incorrectas → pedir de nuevo", () => {
    const cfg = { usuario: "pilar", clave: "secreta" };
    expect(autorizar(`Basic ${b64("pilar:secreta")}`, cfg)).toBe("permitido");
    expect(autorizar(`Basic ${b64("pilar:otra")}`, cfg)).toBe("pedir");
    expect(autorizar(`Basic ${b64("otro:secreta")}`, cfg)).toBe("pedir");
    expect(autorizar("Bearer loquesea", cfg)).toBe("pedir");
    expect(autorizar("Basic ###", cfg)).toBe("pedir");
  });

  test("la clave puede tener dos puntos y tildes", () => {
    const cfg = { usuario: "clínica", clave: "a:b:ñ" };
    expect(autorizar(`Basic ${b64("clínica:a:b:ñ")}`, cfg)).toBe("permitido");
  });

  test("la cabecera de desafío no lleva jerga", () => {
    expect(cabeceraDesafio()).toMatch(/^Basic realm="/);
    expect(cabeceraDesafio()).not.toMatch(/api|endpoint/i);
  });
});

test("la cabecera de desafío es ASCII puro (un encabezado con tildes rompe la respuesta)", () => {
  expect(/^[\x20-\x7e]+$/.test(cabeceraDesafio())).toBe(true);
});
