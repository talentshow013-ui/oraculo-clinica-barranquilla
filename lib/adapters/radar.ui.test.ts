import { describe, expect, test } from "vitest";
import { AnuncioCompetidorSchema } from "@/lib/adapters/types";
import { mapearTarjetaUI, parsearFechaLibreria, parsearTarjeta, type TarjetaCruda } from "@/lib/adapters/radar.ui";

const textoActivo = [
  "Activo",
  "Identificador de la biblioteca: 1229350099285014",
  "Se empezó a publicar el 14 jun 2026",
  "Plataformas",
  "4 anuncios usan este creativo y texto",
  "Dermalux Estética",
  "Publicidad",
  "Toxina botulínica aplicada por médico dermatólogo. Desde $320.000. Agenda tu valoración.",
  "wa.me",
  "Enviar mensaje de WhatsApp",
].join("\n");

const textoInactivo = [
  "Inactivo",
  "Identificador de la biblioteca: 777",
  "Se publicó del 1 jun 2026 al 10 jun 2026",
  "Plataformas",
  "Clínica Bellavista",
  "Publicidad",
  "Últimos cupos de criolipólisis esta semana.",
  "Más información",
].join("\n");

describe("parsearFechaLibreria", () => {
  test("español corto y largo", () => {
    expect(parsearFechaLibreria("14 jun 2026")).toBe("2026-06-14");
    expect(parsearFechaLibreria("14 de junio de 2026")).toBe("2026-06-14");
    expect(parsearFechaLibreria("1 sept 2026")).toBe("2026-09-01");
  });
  test("inglés", () => {
    expect(parsearFechaLibreria("Jun 14, 2026")).toBe("2026-06-14");
    expect(parsearFechaLibreria("September 1, 2026")).toBe("2026-09-01");
  });
  test("basura → null", () => {
    expect(parsearFechaLibreria("ayer")).toBeNull();
  });
});

describe("parsearTarjeta — texto de la Biblioteca en español", () => {
  test("anuncio activo: id, fecha de inicio, variantes, anunciante, copy y CTA", () => {
    const t = parsearTarjeta(textoActivo);
    expect(t.adArchiveID).toBe("1229350099285014");
    expect(t.activo).toBe(true);
    expect(t.inicio).toBe("2026-06-14");
    expect(t.fin).toBeNull();
    expect(t.variantes).toBe(4);
    expect(t.anunciante).toBe("Dermalux Estética");
    expect(t.copy).toContain("Toxina botulínica");
    expect(t.cta).toBe("Enviar mensaje de WhatsApp");
  });

  test("anuncio inactivo: rango de fechas", () => {
    const t = parsearTarjeta(textoInactivo);
    expect(t.activo).toBe(false);
    expect(t.inicio).toBe("2026-06-01");
    expect(t.fin).toBe("2026-06-10");
    expect(t.variantes).toBe(1);
    expect(t.cta).toBe("Más información");
  });

  test("inglés: Library ID / Started running / N ads use this creative", () => {
    const t = parsearTarjeta(["Active", "Library ID: 987654321012345", "Started running on Jun 14, 2026", "Platforms", "3 ads use this creative and text", "Some Clinic", "Sponsored", "Body text here", "Learn more"].join("\n"));
    expect(t.adArchiveID).toBe("987654321012345");
    expect(t.inicio).toBe("2026-06-14");
    expect(t.variantes).toBe(3);
    expect(t.anunciante).toBe("Some Clinic");
  });

  test("sin identificador → adArchiveID null (se descarta después)", () => {
    expect(parsearTarjeta("Publicidad\nHola").adArchiveID).toBeNull();
  });
});

describe("mapearTarjetaUI → AnuncioCompetidor", () => {
  const cruda: TarjetaCruda = {
    texto: textoActivo,
    imagenes: ["https://scontent.example/a.jpg"],
    videosPoster: [],
    enlaces: ["https://l.facebook.com/l.php?u=https%3A%2F%2Fwa.me%2F573001234567&h=x"],
    paginaHref: "https://www.facebook.com/DermaluxEstetica/",
    plataformas: ["facebook", "instagram"],
  };

  test("produce un anuncio válido con competidorId derivado de la página", () => {
    const a = mapearTarjetaUI(cruda, "2026-09-12");
    expect(AnuncioCompetidorSchema.safeParse(a).success).toBe(true);
    expect(a.competidorId).toBe("DermaluxEstetica");
    expect(a.urlDestino).toBe("https://wa.me/573001234567");
    expect(a.dominioDestino).toBe("wa.me");
    expect(a.tipoMedia).toBe("imagen");
    expect(a.variantesDelConcepto).toBe(4);
    expect(a.diasCorriendo).toBe(90);
    expect(a.alcanceRango).toBeNull();
    expect(a.plataformas).toEqual(["facebook", "instagram"]);
  });

  test("sin página → competidorId por nombre normalizado", () => {
    const a = mapearTarjetaUI({ ...cruda, paginaHref: null }, "2026-09-12");
    expect(a.competidorId).toBe("dermalux-estetica");
  });

  test("con urlMediaLocal, urlMedia apunta al archivo local", () => {
    const a = mapearTarjetaUI({ ...cruda, urlMediaLocal: "/radar/1229350099285014.jpg" }, "2026-09-12");
    expect(a.urlMedia).toBe("/radar/1229350099285014.jpg");
  });
});

describe("parsearTarjeta — texto REAL capturado el 2026-09-13", () => {
  const real = [
    "​",
    "Activo",
    "Identificador de la biblioteca: 1753168479219530",
    "En circulación desde el 5 ago 2026",
    "Plataformas",
    "​",
    "Abrir menú desplegable",
    "Este anuncio tiene varias versiones",
    "2 anuncios usan este contenido y texto",
    "Ver detalles del anuncio",
    "Clínica odontologíca Smile Care",
    "Publicidad",
    "Aprovecha nuestras grandes promociones",
    "0:00 / 0:37",
    "Clínica odontologíca Smile Care",
    "odontointegrasmile.com",
    "Más información",
  ].join("\n");

  test("fecha 'En circulación desde el', variantes por 'contenido y texto', anunciante y copy limpios", () => {
    const t = parsearTarjeta(real);
    expect(t.adArchiveID).toBe("1753168479219530");
    expect(t.activo).toBe(true);
    expect(t.inicio).toBe("2026-08-05");
    expect(t.variantes).toBe(2);
    expect(t.anunciante).toBe("Clínica odontologíca Smile Care");
    expect(t.copy).toBe("Aprovecha nuestras grandes promociones");
    expect(t.cta).toBe("Más información");
  });

  test("'varias versiones' sin número → al menos 2 variantes", () => {
    const t = parsearTarjeta(real.replace("2 anuncios usan este contenido y texto\n", ""));
    expect(t.variantes).toBe(2);
  });
});

describe("mapearRadarUI — agrupa competidores desde tarjetas de la interfaz", () => {
  test("una página con dos anuncios → un competidor con sus servicios; descarta tarjetas sin id", async () => {
    const { mapearRadarUI } = await import("@/lib/adapters/radar.ui");
    const base: TarjetaCruda = { texto: textoActivo, imagenes: [], videosPoster: [], enlaces: [], paginaHref: "https://www.facebook.com/61563977975719/", plataformas: ["facebook"] };
    const r = mapearRadarUI(
      [base, { ...base, texto: textoActivo.replace("1229350099285014", "1229350099285099").replace("Toxina botulínica", "Depilación láser") }, { ...base, texto: "Publicidad\nsin id" }],
      "2026-09-12",
      { "61563977975719": "Soledad" },
    );
    expect(r.anunciosCompetencia).toHaveLength(2);
    expect(r.descartados).toBe(1);
    expect(r.competidores).toHaveLength(1);
    expect(r.competidores[0]?.id).toBe("61563977975719");
    expect(r.competidores[0]?.ciudad).toBe("Soledad");
    expect(r.competidores[0]?.serviciosConocidos.sort()).toEqual(["depilacion", "toxina"]);
    expect(r.competidores[0]?.urlPagina).toBe("https://www.facebook.com/61563977975719/");
  });

  test("las páginas propias de la clínica y los rubros ajenos (odontología, cursos, prensa) no entran al radar", async () => {
    const { mapearRadarUI } = await import("@/lib/adapters/radar.ui");
    const base: TarjetaCruda = { texto: textoActivo, imagenes: [], videosPoster: [], enlaces: [], paginaHref: "https://www.facebook.com/61563977975719/", plataformas: ["facebook"] };
    const propia = { ...base, paginaHref: "https://www.facebook.com/Vivantemedicinaestetica/", texto: textoActivo.replace("1229350099285014", "1229350099285077") };
    const dental = { ...base, paginaHref: "https://www.facebook.com/Odontointegrasmile/", texto: textoActivo.replace("1229350099285014", "1229350099285088").replace("Clínica Dermalux", "Odonto Integra Smile") };
    const r = mapearRadarUI([base, propia, dental], "2026-09-12", {}, "Barranquilla", { paginasPropias: ["Vivantemedicinaestetica"], excluirNombres: ["odonto", "dental", "escuela", "curso"] });
    expect(r.competidores.map((c) => c.id)).toEqual(["61563977975719"]);
    expect(r.anunciosCompetencia).toHaveLength(1);
    expect(r.excluidos).toBe(2);
  });
});
