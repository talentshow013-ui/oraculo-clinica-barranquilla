import { describe, expect, test } from "vitest";
import { elegirMiniatura, formatearTamano, resolverCuenta, tipoDeArchivo } from "./meta.medios";

const cuentas = [
  { id: "act_536430824306104", nombre: "F3 · Vivante Corporal 2026" },
  { id: "act_1083324715683244", nombre: "F2 · Vivante Facial 2026" },
  { id: "act_28503083", nombre: "Vivante 6 · Varios tratamientos" },
  { id: "act_677891593042927", nombre: "No invasiva · Otros tratamientos" },
];

describe("subir medios a Meta · qué es cada archivo", () => {
  test("videos e imágenes por extensión, sin importar mayúsculas", () => {
    expect(tipoDeArchivo("C:\\Descargas\\BIOLASER\\Bioláser ver.1.mp4")).toBe("video");
    expect(tipoDeArchivo("/x/Reel.MOV")).toBe("video");
    expect(tipoDeArchivo("foto.JPG")).toBe("imagen");
    expect(tipoDeArchivo("foto.png")).toBe("imagen");
    expect(tipoDeArchivo("notas.pdf")).toBeNull();
  });
  test("tamaño en palabras", () => {
    expect(formatearTamano(512)).toBe("512 B");
    expect(formatearTamano(5 * 1024 * 1024)).toBe("5,0 MB");
    expect(formatearTamano(2.5 * 1024 * 1024 * 1024)).toBe("2,50 GB");
  });
});

describe("subir medios a Meta · a qué cuenta", () => {
  test("por id, por parte del nombre, sin tildes ni mayúsculas", () => {
    expect(resolverCuenta("act_28503083", cuentas).id).toBe("act_28503083");
    expect(resolverCuenta("vivante 6", cuentas).id).toBe("act_28503083");
    expect(resolverCuenta("F3", cuentas).id).toBe("act_536430824306104");
    expect(resolverCuenta("facial", cuentas).id).toBe("act_1083324715683244");
    expect(resolverCuenta("INVASIVA", cuentas).id).toBe("act_677891593042927");
  });
  test("ambigua o desconocida: error que dice cuáles hay (nunca adivina la cuenta)", () => {
    expect(() => resolverCuenta("vivante", cuentas)).toThrow(/F2|Vivante 6|F3/);
    expect(() => resolverCuenta("zzz", cuentas)).toThrow(/ninguna cuenta/i);
    expect(() => resolverCuenta("", cuentas)).toThrow(/--cuenta/);
  });
});

describe("subir medios a Meta · la miniatura del video", () => {
  test("elige la preferida; si no hay, la primera", () => {
    expect(elegirMiniatura([{ uri: "a", is_preferred: false }, { uri: "b", is_preferred: true }])).toBe("b");
    expect(elegirMiniatura([{ uri: "a" }, { uri: "c" }])).toBe("a");
    expect(elegirMiniatura([])).toBeNull();
  });
});
