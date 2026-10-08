import { describe, expect, test } from "vitest";
import { resumirSegmentacion } from "./meta.segmentacion";

const places = (radius: number, tipos: string[] = ["frequently_in", "home", "recent"]) => ({
  geo_locations: { places: [{ key: "1", name: "Vivante Medicina Estética", distance_unit: "kilometer", radius }], location_types: tipos },
  age_min: 24, age_max: 60, genders: [2],
  targeting_automation: { advantage_audience: 0 },
});

describe("segmentación de un conjunto, en palabras de dueño", () => {
  test("radio en km alrededor de la clínica", () => {
    const r = resumirSegmentacion(places(8));
    expect(r.radioKm).toBe(8);
    expect(r.lugar).toBe("Vivante Medicina Estética");
    expect(r.edad).toBe("24–60");
    expect(r.generos).toBe("mujeres");
    expect(r.advantagePlus).toBe(false);
  });
  test("«viven en» frente a «viven o visitan»", () => {
    expect(resumirSegmentacion(places(8, ["home"])).quienes).toBe("viven allí");
    expect(resumirSegmentacion(places(8)).quienes).toBe("viven, frecuentan o visitaron");
  });
  test("millas se pasan a km; ciudades con radio también", () => {
    expect(resumirSegmentacion({ geo_locations: { custom_locations: [{ name: "x", distance_unit: "mile", radius: 5 }] } }).radioKm).toBeCloseTo(8.05, 1);
    expect(resumirSegmentacion({ geo_locations: { cities: [{ name: "Barranquilla", radius: 40, distance_unit: "kilometer" }] } })).toMatchObject({ lugar: "Barranquilla", radioKm: 40 });
  });
  test("sin lugar con radio (solo país o región) no inventa kilómetros", () => {
    const r = resumirSegmentacion({ geo_locations: { countries: ["CO"] } });
    expect(r.radioKm).toBeNull();
    expect(r.lugar).toBe("CO");
  });
  test("Advantage+ activado y todos los géneros", () => {
    const r = resumirSegmentacion({ ...places(10), genders: undefined, targeting_automation: { advantage_audience: 1 } });
    expect(r.advantagePlus).toBe(true);
    expect(r.generos).toBe("todos");
  });
});
