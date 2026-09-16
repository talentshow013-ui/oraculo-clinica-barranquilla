import { describe, expect, test } from "vitest";
import { urlAnunciosDePagina, urlAnuncioBiblioteca, urlBusquedaBiblioteca } from "./enlaces";

describe("enlaces a la Biblioteca de anuncios: todo lo del radar se puede verificar", () => {
  test("anuncio exacto por id", () => {
    expect(urlAnuncioBiblioteca("1588066176391836")).toBe("https://www.facebook.com/ads/library/?id=1588066176391836");
  });
  test("búsqueda por palabras en Colombia, con espacios normalizados", () => {
    const u = urlBusquedaBiblioteca("criolipólisis   Barranquilla");
    expect(u).toContain("country=CO");
    expect(u).toContain("q=criolip%C3%B3lisis%20Barranquilla");
    expect(u).toContain("active_status=all");
  });
  test("página con id numérico → todos sus anuncios; página con nombre → búsqueda", () => {
    expect(urlAnunciosDePagina("X", "https://www.facebook.com/100086981160365/")).toContain("view_all_page_id=100086981160365");
    expect(urlAnunciosDePagina("Amatista", "https://www.facebook.com/amatistacentroesteticaspa/")).toContain("q=Amatista");
    expect(urlAnunciosDePagina("Amatista", null)).toContain("q=Amatista");
  });
});
