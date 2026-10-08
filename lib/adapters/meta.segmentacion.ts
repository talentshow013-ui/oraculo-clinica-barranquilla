/**
 * La segmentación de un conjunto de anuncios de Meta en palabras de dueño: a cuántos km de la
 * clínica, quiénes (viven allí o también visitan), edad, género y si el público Advantage+ está
 * encendido. Sirve para comprobar de verdad si un cambio de «kilometraje» quedó hecho.
 */
const KM_POR_MILLA = 1.609344;

interface Lugar {
  name?: string;
  radius?: number;
  distance_unit?: string;
}
export interface TargetingMeta {
  geo_locations?: { places?: Lugar[]; custom_locations?: Lugar[]; cities?: Lugar[]; regions?: Lugar[]; countries?: string[]; location_types?: string[] };
  age_min?: number;
  age_max?: number;
  genders?: number[];
  targeting_automation?: { advantage_audience?: number };
}

export interface Segmentacion {
  lugar: string | null;
  /** Radio alrededor del lugar, en km; null si el conjunto va por país o región sin radio. */
  radioKm: number | null;
  quienes: string;
  edad: string;
  generos: string;
  advantagePlus: boolean;
}

export function resumirSegmentacion(t: TargetingMeta): Segmentacion {
  const g = t.geo_locations ?? {};
  const conRadio = [...(g.places ?? []), ...(g.custom_locations ?? []), ...(g.cities ?? [])].find((l) => typeof l.radius === "number");
  const km = conRadio ? (conRadio.distance_unit === "mile" ? conRadio.radius! * KM_POR_MILLA : conRadio.radius!) : null;
  const sinRadio = g.regions?.[0]?.name ?? g.countries?.[0] ?? null;
  const tipos = g.location_types ?? [];
  const soloViven = tipos.length === 1 && tipos[0] === "home";
  const g1 = t.genders ?? [];
  return {
    lugar: conRadio?.name ?? sinRadio,
    radioKm: km,
    quienes: soloViven ? "viven allí" : "viven, frecuentan o visitaron",
    edad: t.age_min || t.age_max ? `${t.age_min ?? "—"}–${t.age_max ?? "—"}` : "todas",
    generos: g1.length === 1 ? (g1[0] === 2 ? "mujeres" : "hombres") : "todos",
    advantagePlus: (t.targeting_automation?.advantage_audience ?? 0) === 1,
  };
}
