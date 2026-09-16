import { describe, expect, test } from "vitest";
import { estudiarReferencias, type ArchivoReferencia } from "./referencias";

const tarjeta = (id: string, desde: string, anunciante: string, copy: string) => ({
  texto: `Activo\nIdentificador de la biblioteca: ${id}\nEn circulación desde el ${desde}\nPlataformas\n\nVer detalles del anuncio\n${anunciante}\nPublicidad\n${copy}`,
  imagenes: [],
  videosPoster: [],
  enlaces: [],
  paginaHref: `https://www.facebook.com/${anunciante.replace(/\s+/g, "").toLowerCase()}/`,
  plataformas: ["facebook", "instagram"],
});

const archivos: ArchivoReferencia[] = [
  { ciudad: "Cartagena", pais: "CO", consulta: "clínica estética Cartagena", capturadoEn: "2026-09-16", tarjetas: [
    tarjeta("100001", "1 jun 2026", "Clínica Bocagrande", "Mujeres de más de 40: firmeza facial sin cirugía con Ultherapy. Agenda tu valoración. $ 350.000"),
    tarjeta("100002", "1 sep 2026", "Estética Manga", "Criolipólisis para eliminar grasa localizada. Sin dolor. Escríbenos."),
    tarjeta("100003", "20 may 2026", "Clínica Bocagrande", "Mamás: recupera tu abdomen después del parto con criolipólisis, sin incapacidad."),
  ] },
  { ciudad: "Miami", pais: "US", consulta: "med spa Miami", capturadoEn: "2026-09-16", tarjetas: [
    tarjeta("100009", "10 mar 2026", "Brickell Med Spa", "Women over 40: lift without surgery. Book your consultation."),
  ] },
];

describe("referencias de otros mercados", () => {
  const r = estudiarReferencias(archivos, "2026-09-16");
  test("una ciudad por archivo, con ganadores de 60+ días enlazados a la Biblioteca y pistas de a quién le hablan", () => {
    expect(r.sinDatos).toBe(false);
    const c = r.ciudades.find((x) => x.ciudad === "Cartagena")!;
    expect(c.anuncios).toBe(3);
    expect(c.anunciantes).toBe(2);
    expect(c.ganadores.map((g) => g.anuncioId)).toEqual(["100003", "100001"]);
    expect(c.ganadores[0]!.verificar).toBe("https://www.facebook.com/ads/library/?id=100003");
    expect(c.aQuienLeHablan.map((p) => p.clave)).toEqual(expect.arrayContaining(["mujeres", "mas40", "mamas"]));
    expect(c.usanPrecio).toBe(1);
    expect(c.aprendizajes.length).toBeGreaterThanOrEqual(4);
    expect(c.aprendizajes[0]).toMatch(/Clínica Bocagrande/);
  });
  test("lo transversal solo aparece con 2+ ciudades y cuenta por anuncio", () => {
    expect(r.transversal.length).toBeGreaterThan(0);
    expect(r.transversal[0]).toMatch(/2 ciudades y 4 anuncios/);
  });
  test("sin archivos → sinDatos", () => {
    expect(estudiarReferencias([], "2026-09-16").sinDatos).toBe(true);
  });
});
