import { describe, expect, test } from "vitest";
import { TIPO_GOOGLE, consultaDeBusqueda, formatoDeExportacion, resumirArchivo, urlDeLista } from "./drive";

describe("drive · la búsqueda", () => {
  test("texto libre: busca en el nombre y dentro del contenido, sin la papelera", () => {
    expect(consultaDeBusqueda("lipo en frío")).toBe("(name contains 'lipo en frío' or fullText contains 'lipo en frío') and trashed = false");
  });
  test("las comillas del usuario no rompen la consulta", () => {
    expect(consultaDeBusqueda("l'oréal")).toContain("l\\'oréal");
  });
  test("con carpeta: solo lo que está dentro de ella", () => {
    expect(consultaDeBusqueda("precios", { carpetaId: "ABC" })).toContain("'ABC' in parents");
  });
  test("sin texto: lista lo reciente, sin papelera", () => {
    expect(consultaDeBusqueda("")).toBe("trashed = false");
  });
});

describe("drive · qué se puede leer como texto", () => {
  test("los documentos de Google se exportan: Doc y Presentación a texto, Hoja a CSV", () => {
    expect(formatoDeExportacion(TIPO_GOOGLE.documento)).toBe("text/plain");
    expect(formatoDeExportacion(TIPO_GOOGLE.presentacion)).toBe("text/plain");
    expect(formatoDeExportacion(TIPO_GOOGLE.hoja)).toBe("text/csv");
  });
  test("los archivos de texto se descargan tal cual; los demás (imagen, PDF, video) no se leen como texto", () => {
    expect(formatoDeExportacion("text/plain")).toBe("descargar");
    expect(formatoDeExportacion("text/csv")).toBe("descargar");
    expect(formatoDeExportacion("application/json")).toBe("descargar");
    expect(formatoDeExportacion("application/pdf")).toBeNull();
    expect(formatoDeExportacion("image/png")).toBeNull();
    expect(formatoDeExportacion(TIPO_GOOGLE.carpeta)).toBeNull();
  });
});

describe("drive · la petición y el resumen", () => {
  test("la lista pide solo los campos que se usan y trae todas las unidades", () => {
    const u = new URL(urlDeLista("trashed = false", 20));
    expect(u.searchParams.get("q")).toBe("trashed = false");
    expect(u.searchParams.get("pageSize")).toBe("20");
    expect(u.searchParams.get("supportsAllDrives")).toBe("true");
    expect(u.searchParams.get("includeItemsFromAllDrives")).toBe("true");
    expect(u.searchParams.get("orderBy")).toBe("modifiedTime desc");
    expect(u.searchParams.get("fields")).toContain("webViewLink");
  });
  test("resumen de un archivo en palabras de dueño", () => {
    const r = resumirArchivo({ id: "1", name: "Precios 2026", mimeType: TIPO_GOOGLE.hoja, modifiedTime: "2026-10-01T15:00:00.000Z", webViewLink: "https://docs.google.com/x", size: undefined, owners: [{ displayName: "Ana" }] });
    expect(r).toMatchObject({ tipo: "hoja de cálculo", nombre: "Precios 2026", modificado: "2026-10-01", enlace: "https://docs.google.com/x", legible: true });
  });
});
