import { describe, expect, test } from "vitest";
import type { LoteWeb } from "@/lib/adapters/types";
import { analizarWeb } from "./index";

const ses = (fecha: string, canal: string, fuente: string, sesiones: number, eventosClave: number | null, extra: Partial<LoteWeb["sesiones"][number]> = {}) => ({ fecha, canal, fuente, medio: "x", sesiones, usuarios: sesiones, usuariosNuevos: null, sesionesComprometidas: Math.round(sesiones * 0.5), duracionMedia: 40, eventosClave, ...extra });

const lote: LoteWeb = {
  propiedadId: "123",
  sesiones: [
    ses("2026-09-10", "Paid Social", "facebook", 200, 20),
    ses("2026-09-10", "Paid Social", "instagram", 100, 5),
    ses("2026-09-10", "Organic Search", "google", 50, 5),
    ses("2026-09-11", "Direct", "(direct)", 50, 0),
    ses("2026-09-11", "Organic Social", "tiktok", 100, 2),
    ses("2026-07-01", "Direct", "(direct)", 999, 99), // fuera del periodo
  ],
  paginas: [
    { fecha: "2026-09-10", pagina: "/criolipolisis", sesiones: 150, sesionesComprometidas: 90, eventosClave: 18 },
    { fecha: "2026-09-10", pagina: "/", sesiones: 200, sesionesComprometidas: 60, eventosClave: 6 },
    { fecha: "2026-09-11", pagina: "/criolipolisis", sesiones: 50, sesionesComprometidas: 30, eventosClave: 4 },
  ],
  eventos: [
    { fecha: "2026-09-10", evento: "click_whatsapp", veces: 25, esClave: true },
    { fecha: "2026-09-11", evento: "click_whatsapp", veces: 7, esClave: true },
    { fecha: "2026-09-10", evento: "page_view", veces: 900, esClave: false },
  ],
  ciudades: [
    { fecha: "2026-09-10", ciudad: "Barranquilla", sesiones: 300, eventosClave: 28 },
    { fecha: "2026-09-10", ciudad: "Bogota", sesiones: 100, eventosClave: 2 },
    { fecha: "2026-09-11", ciudad: "Barranquilla", sesiones: 100, eventosClave: 2 },
  ],
  meta: { capturadoEn: "2026-09-16T10:00:00Z", desde: "2026-06-15", hasta: "2026-09-15", origen: "ga4", avisos: [] },
};
const rango = { desde: "2026-09-01", hasta: "2026-09-15" };

describe("web · sin datos", () => {
  test("null → sinDatos y vacío", () => {
    const r = analizarWeb(null, rango, "Barranquilla");
    expect(r.sinDatos).toBe(true);
    expect(r.porCanal).toEqual([]);
  });
});

describe("web · resumen y canales", () => {
  const r = analizarWeb(lote, rango, "Barranquilla");
  test("suma solo el periodo; tasa de conversión = eventos clave ÷ sesiones", () => {
    expect(r.resumen).toMatchObject({ sesiones: 500, usuarios: 500, eventosClave: 32 });
    expect(r.resumen.tasaConversion).toBeCloseTo(32 / 500, 6);
    expect(r.resumen.tasaCompromiso).toBeCloseTo(250 / 500, 6);
  });
  test("por canal ordenado por sesiones, con participación y tasa; el mejor por tasa marcado", () => {
    expect(r.porCanal[0]).toMatchObject({ canal: "Paid Social", sesiones: 300, eventosClave: 25, participacion: 0.6 });
    const org = r.porCanal.find((c) => c.canal === "Organic Search")!;
    expect(org.tasaConversion).toBeCloseTo(0.1, 6);
    expect(org.mejor).toBe(true);
  });
  test("por fuente: facebook e instagram separados", () => {
    expect(r.porFuente[0]!.fuente).toBe("facebook");
    expect(r.porFuente.map((f) => f.fuente).sort()).toEqual(["(direct)", "facebook", "google", "instagram", "tiktok"]);
  });
  test("lo que trae la pauta de Meta (facebook+instagram pagado) sale aparte", () => {
    expect(r.pautaMeta).toMatchObject({ sesiones: 300, eventosClave: 25 });
    expect(r.pautaMeta!.participacionEventos).toBeCloseTo(25 / 32, 6);
  });
});

describe("web · páginas, eventos y ciudades", () => {
  const r = analizarWeb(lote, rango, "Barranquilla");
  test("páginas agregadas del periodo, por eventos clave primero", () => {
    expect(r.paginas[0]).toMatchObject({ pagina: "/criolipolisis", sesiones: 200, eventosClave: 22 });
    expect(r.paginas[0]!.tasaConversion).toBeCloseTo(22 / 200, 6);
  });
  test("eventos clave por nombre; los no clave no aparecen", () => {
    expect(r.eventosClave).toEqual([{ evento: "click_whatsapp", veces: 32 }]);
  });
  test("ciudades: la de la clínica primero y el porcentaje de sesiones de afuera", () => {
    expect(r.ciudades[0]).toMatchObject({ ciudad: "Barranquilla", sesiones: 400, eventosClave: 30 });
    expect(r.fueraDeCiudad).toBeCloseTo(100 / 500, 6);
  });
  test("serie diaria del periodo", () => {
    expect(r.serie).toEqual([{ fecha: "2026-09-10", sesiones: 350, eventosClave: 30 }, { fecha: "2026-09-11", sesiones: 150, eventosClave: 2 }]);
  });
  test("lecturas y fuente", () => {
    expect(r.lecturas.join(" ")).toMatch(/Meta/);
    expect(r.fuente).toMatchObject({ desde: "2026-09-01", hasta: "2026-09-15", registros: 5 });
  });
});
