/**
 * RADAR DE REFERENTES: de dónde se mira qué le funciona a otras clínicas. Barranquilla NO está: ya
 * conocemos a los vecinos; lo útil es ver qué sostienen al aire (60+ días = les deja plata) las
 * mejores de Medellín (la cuna de la estética en Colombia), Santa Marta, Cartagena y de EE. UU.
 * (Miami y otras ciudades grandes), que están años adelante en ofertas y formatos.
 *
 * Las búsquedas se hacen en la Biblioteca de anuncios de Meta (pública y gratis). Se agrega o quita
 * una ciudad aquí y `npm run radar:referencias` rehace el radar. Consultas en el idioma de cada
 * mercado, con los servicios de la clínica: criolipólisis, HIFU, láser, toxina, lipo en frío.
 */
export interface CiudadReferente {
  ciudad: string;
  /** País de la Biblioteca de anuncios (código ISO de 2 letras). */
  pais: "CO" | "US";
  consultas: ReadonlyArray<string>;
}

const COLOMBIA = (ciudad: string): ReadonlyArray<string> => [`clínica estética ${ciudad}`, `medicina estética ${ciudad}`, `criolipólisis ${ciudad}`, `hifu ${ciudad}`, `rejuvenecimiento facial ${ciudad}`, `botox ${ciudad}`, `depilación láser ${ciudad}`];
const EEUU = (ciudad: string): ReadonlyArray<string> => [`med spa ${ciudad}`, `cryolipolysis ${ciudad}`, `body contouring ${ciudad}`, `hifu ${ciudad}`, `botox ${ciudad}`];

export const CIUDADES_REFERENTES: ReadonlyArray<CiudadReferente> = [
  { ciudad: "Medellín", pais: "CO", consultas: COLOMBIA("medellín") },
  { ciudad: "Santa Marta", pais: "CO", consultas: COLOMBIA("santa marta") },
  { ciudad: "Cartagena", pais: "CO", consultas: COLOMBIA("cartagena") },
  { ciudad: "Miami", pais: "US", consultas: [...EEUU("miami"), "clínica estética miami", "criolipólisis miami"] },
  { ciudad: "Los Ángeles", pais: "US", consultas: EEUU("los angeles") },
  { ciudad: "Houston", pais: "US", consultas: EEUU("houston") },
  { ciudad: "Nueva York", pais: "US", consultas: EEUU("new york") },
];

/** Rubros ajenos en inglés que se descartan (se suman a `cliente.radar.excluirNombres`). */
export const EXCLUIR_EN: ReadonlyArray<string> = ["dental", "dentist", "orthodont", "chiropract", "veterinar", "pet ", "school", "academy", "training", "course", "university", "real estate", "restaurant", "plastic surgery center only"];
