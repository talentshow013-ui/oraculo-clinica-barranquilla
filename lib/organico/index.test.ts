import { describe, expect, test } from "vitest";
import type { LoteOrganico, PublicacionOrganica } from "@/lib/adapters/types";
import { analizarOrganico, NOMBRE_FORMATO } from "./index";

const pub = (p: Partial<PublicacionOrganica> & { id: string; publicadoEn: string }): PublicacionOrganica => ({
  red: "instagram",
  formato: "reel",
  texto: `Publicación ${p.id}`,
  enlace: `https://www.instagram.com/p/${p.id}/`,
  urlMiniatura: null,
  alcance: 1000,
  vistas: 1500,
  meGusta: 50,
  comentarios: 5,
  compartidos: 3,
  guardados: 2,
  interacciones: 60,
  visitasPerfil: null,
  seguidoresGanados: null,
  clics: null,
  segundosPromedio: null,
  respuestas: null,
  ...p,
});

const lote: LoteOrganico = {
  cuentas: [
    { red: "instagram", id: "IG1", alias: "vivante", seguidores: 12000, publicaciones: 500 },
    { red: "facebook", id: "PG1", alias: "Vivante", seguidores: 8000, publicaciones: null },
  ],
  publicaciones: [
    pub({ id: "r1", publicadoEn: "2026-09-10T18:30", alcance: 9000, interacciones: 900 }), // jueves noche, reel estrella
    pub({ id: "r2", publicadoEn: "2026-09-08T09:00", alcance: 3000, interacciones: 60 }),
    pub({ id: "i1", publicadoEn: "2026-09-05T12:00", formato: "imagen", alcance: 800, interacciones: 8 }),
    pub({ id: "c1", publicadoEn: "2026-09-01T19:00", formato: "carrusel", alcance: 2000, interacciones: 120 }),
    pub({ id: "f1", publicadoEn: "2026-09-02T10:00", red: "facebook", formato: "imagen", alcance: 500, vistas: 700, interacciones: 20, guardados: null }),
    pub({ id: "viejo", publicadoEn: "2026-07-01T10:00", alcance: 50000, interacciones: 5000 }), // fuera del periodo
    pub({ id: "sinalcance", publicadoEn: "2026-09-04T10:00", alcance: null, interacciones: null }),
  ],
  dias: [
    { red: "instagram", fecha: "2026-09-01", seguidoresNuevos: 10, seguidoresTotal: null, alcance: 4000, vistas: null, interacciones: null },
    { red: "instagram", fecha: "2026-09-02", seguidoresNuevos: 15, seguidoresTotal: null, alcance: 3000, vistas: null, interacciones: null },
    { red: "instagram", fecha: "2026-07-02", seguidoresNuevos: 99, seguidoresTotal: null, alcance: 3000, vistas: null, interacciones: null },
    { red: "facebook", fecha: "2026-09-01", seguidoresNuevos: null, seguidoresTotal: 7990, alcance: null, vistas: 900, interacciones: 30 },
    { red: "facebook", fecha: "2026-09-02", seguidoresNuevos: null, seguidoresTotal: 8000, alcance: null, vistas: 1000, interacciones: 40 },
  ],
  meta: { capturadoEn: "2026-09-16T11:00:00Z", desde: "2026-06-15", hasta: "2026-09-15", origen: "graph", avisos: ["Meta no entregó «visitas al perfil» en Instagram; se muestra como «—»."] },
};
const rango = { desde: "2026-08-17", hasta: "2026-09-15" };

describe("orgánico · sin datos", () => {
  test("sin archivo → sinDatos y todo vacío, nada inventado", () => {
    const r = analizarOrganico(null, rango, "2026-09-15");
    expect(r.sinDatos).toBe(true);
    expect(r.redes).toEqual([]);
    expect(r.mejores.porAlcance).toEqual([]);
  });
});

describe("orgánico · resumen por red en el periodo", () => {
  const r = analizarOrganico(lote, rango, "2026-09-15");
  test("suma solo lo publicado en el periodo y calcula la tasa de interacción", () => {
    const ig = r.redes.find((x) => x.red === "instagram")!;
    expect(ig).toMatchObject({ alias: "vivante", seguidores: 12000, publicaciones: 5, alcance: 14800, interacciones: 1088, seguidoresGanados: 25 });
    expect(ig.tasaInteraccion).toBeCloseTo(1088 / 14800, 6);
    const fb = r.redes.find((x) => x.red === "facebook")!;
    expect(fb).toMatchObject({ publicaciones: 1, alcance: 500, vistas: 700, seguidoresGanados: 10 });
  });
  test("una publicación sin alcance no entra en la tasa ni se cuenta como cero", () => {
    const p = r.publicaciones.find((x) => x.id === "sinalcance")!;
    expect(p.tasaInteraccion).toBeNull();
  });
  test("lleva su fuente con periodo y registros", () => {
    expect(r.fuente).toMatchObject({ desde: "2026-08-17", hasta: "2026-09-15", registros: 6 });
    expect(r.avisos).toHaveLength(1);
  });
});

describe("orgánico · mejores publicaciones", () => {
  const r = analizarOrganico(lote, rango, "2026-09-15");
  test("por alcance y por tasa, la estrella primero; lo viejo no entra", () => {
    expect(r.mejores.porAlcance[0]!.id).toBe("r1");
    expect(r.mejores.porAlcance.map((p) => p.id)).not.toContain("viejo");
    expect(r.mejores.porTasa[0]!.id).toBe("r1");
  });
  test("cada publicación sabe su día y su franja", () => {
    const p = r.publicaciones.find((x) => x.id === "r1")!;
    expect(p.diaSemana).toBe(4); // jueves (domingo = 0)
    expect(p.franja).toBe("noche");
  });
});

describe("orgánico · qué formato, día y franja rinden", () => {
  const r = analizarOrganico(lote, rango, "2026-09-15");
  test("por formato: el reel gana en tasa y se marca como mejor", () => {
    const reel = r.porFormato.find((g) => g.clave === "instagram|reel")!;
    expect(reel).toMatchObject({ etiqueta: `${NOMBRE_FORMATO.reel} · Instagram`, publicaciones: 3, mejor: true });
    expect(reel.alcanceMedio).toBe(6000);
    expect(r.porFormato.filter((g) => g.mejor)).toHaveLength(1);
  });
  test("por franja: la noche (r1 y c1) es la mejor", () => {
    const noche = r.porFranja.find((g) => g.clave === "noche")!;
    expect(noche.publicaciones).toBe(2);
    expect(noche.mejor).toBe(true);
  });
  test("por día: 7 filas siempre, aunque falten publicaciones", () => {
    expect(r.porDia).toHaveLength(7);
    expect(r.porDia.find((g) => g.clave === "4")!.publicaciones).toBe(1);
  });
});

describe("orgánico · qué merece pauta", () => {
  test("reciente, con tasa muy por encima y alcance sobre la mediana; con el porqué", () => {
    const r = analizarOrganico(lote, rango, "2026-09-15");
    expect(r.paraPauta.map((x) => x.publicacion.id)).toEqual(["r1"]);
    expect(r.paraPauta[0]!.porQue).toMatch(/interacción/);
  });
});

describe("orgánico · seguidores", () => {
  test("serie diaria del periodo por red y ganados en el periodo", () => {
    const r = analizarOrganico(lote, rango, "2026-09-15");
    expect(r.seguidores.serie).toHaveLength(2);
    expect(r.seguidores.serie[0]).toMatchObject({ fecha: "2026-09-01", instagramNuevos: 10, facebookTotal: 7990 });
    expect(r.seguidores.ganados).toEqual({ instagram: 25, facebook: 10 });
  });
});
