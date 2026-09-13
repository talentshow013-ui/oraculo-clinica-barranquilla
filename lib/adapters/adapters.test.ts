import { afterEach, describe, expect, test } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { FuenteArchivo } from "@/lib/adapters/archivo.adapter";
import { FuenteMock } from "@/lib/adapters/mock.adapter";
import { generarSeed } from "@/scripts/seed";
import { ErrorDatoSensible } from "@/lib/privacy";

const dirs: string[] = [];
function tmp(): string {
  const d = mkdtempSync(join(tmpdir(), "oraculo-"));
  dirs.push(d);
  return d;
}
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

describe("FuenteMock", () => {
  test("lee y valida el seed; estado con etiqueta pública sin jerga", async () => {
    const d = tmp();
    writeFileSync(join(d, "seed.json"), JSON.stringify(generarSeed()));
    const f = new FuenteMock(join(d, "seed.json"));
    const lote = await f.obtener({ desde: "2026-09-01", hasta: "2026-09-12" });
    expect(lote.meta.origen).toBe("seed");
    expect(lote.insights.every((i) => i.fecha >= "2026-09-01" && i.fecha <= "2026-09-12")).toBe(true);
    const estado = await f.estado();
    expect(estado[0]?.conectado).toBe(true);
    expect(estado.map((e) => e.etiquetaPublica).join(" ")).not.toMatch(/\b(API|MCP|Zod)\b/);
  });

  test("si el seed no existe, el error dice qué comando correr", async () => {
    const f = new FuenteMock(join(tmp(), "no-existe.json"));
    await expect(f.obtener({ desde: "2026-09-01", hasta: "2026-09-12" })).rejects.toThrow(/npm run seed/);
  });
});

describe("FuenteArchivo — la fuente real entra por aquí", () => {
  test("un lote válido carga con el MISMO contrato", async () => {
    const d = tmp();
    const lote = { ...generarSeed(), meta: { ...generarSeed().meta, origen: "archivo" as const } };
    writeFileSync(join(d, "lote.json"), JSON.stringify(lote));
    const f = new FuenteArchivo(join(d, "lote.json"));
    const r = await f.obtener({ desde: lote.meta.desde, hasta: lote.meta.hasta });
    expect(r.meta.origen).toBe("archivo");
  });

  test("un lote que rompe el contrato se rechaza con la ruta del campo", async () => {
    const d = tmp();
    const lote = generarSeed();
    (lote.insights[3] as unknown as { gasto: null }).gasto = null;
    writeFileSync(join(d, "lote.json"), JSON.stringify(lote));
    const f = new FuenteArchivo(join(d, "lote.json"));
    await expect(f.obtener({ desde: lote.meta.desde, hasta: lote.meta.hasta })).rejects.toThrow(/insights\[3\]\.gasto/);
  });

  test("un lote con datos de paciente se rechaza citando la ley", async () => {
    const d = tmp();
    const lote = generarSeed();
    (lote.embudo[0] as unknown as Record<string, unknown>)["telefono"] = "300";
    writeFileSync(join(d, "lote.json"), JSON.stringify(lote));
    const f = new FuenteArchivo(join(d, "lote.json"));
    await expect(f.obtener({ desde: lote.meta.desde, hasta: lote.meta.hasta })).rejects.toThrow(ErrorDatoSensible);
  });

  test("sin archivo, estado dice no conectado con instrucción clara", async () => {
    const f = new FuenteArchivo(join(tmp(), "lote.json"));
    const e = await f.estado();
    expect(e[0]?.conectado).toBe(false);
    expect(e[0]?.detalle).toMatch(/datos\/lote\.json/);
  });
});
