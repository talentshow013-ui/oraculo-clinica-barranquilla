import { describe, expect, test } from "vitest";
import { actualizarEnv, leerEnv } from "./env";

describe(".env sin dependencias", () => {
  test("lee CLAVE=valor, ignora comentarios y quita comillas", () => {
    expect(leerEnv("# c\nA=1\nB=\"dos\"\n\nC='tres' \nMAL LINEA")).toEqual({ A: "1", B: "dos", C: "tres" });
  });
  test("reemplaza claves existentes y agrega las nuevas al final sin tocar el resto", () => {
    const r = actualizarEnv("# candado\nORACULO_USUARIO=x\nMETA_PAGINA_ID=viejo\n", { META_PAGINA_ID: "nuevo", META_ORGANICO_TOKEN: "t" });
    expect(r).toBe("# candado\nORACULO_USUARIO=x\nMETA_PAGINA_ID=nuevo\nMETA_ORGANICO_TOKEN=t\n");
  });
});
