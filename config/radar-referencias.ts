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

/**
 * REFERENTES SEGUIDOS POR PÁGINA: los que de verdad invierten en pauta (medido en la Biblioteca de
 * anuncios de Meta el 20-oct-2026, anuncios activos; Vivante tenía 85 ese día). Cada domingo se bajan
 * TODOS sus anuncios activos, no solo los que salen al buscar por palabras. Para seguir a otro: su id
 * de página sale de la Biblioteca (view_all_page_id) o pidiéndolo en el chat.
 */
export interface ReferenteSeguido {
  nombre: string;
  pageId: string;
  pais: "CO" | "US";
  /** Ciudad con la que aparece en el radar (chips de /competencia). */
  ciudad: string;
  porQue: string;
}
export const REFERENTES_SEGUIDOS: ReadonlyArray<ReferenteSeguido> = [
  // Colombia
  { nombre: "Punto Láser Center", pageId: "426707017192545", pais: "CO", ciudad: "Cartagena", porQue: "100 anuncios activos; cadena de la Costa con sedes en Barranquilla (Alto Prado, Mallplaza) y Soledad: garantía de por vida, 2x1, sesiones gratis" },
  { nombre: "Equilibrio Clinic", pageId: "116997711395079", pais: "CO", ciudad: "Cartagena", porQue: "93 anuncios activos; líder de Cartagena (65K IG); publica precio en el anuncio (39 de 85)" },
  { nombre: "Dra. Maria Paula Bello (Bèl)", pageId: "2198572167040957", pais: "CO", ciudad: "Bogotá", porQue: "78 anuncios activos; marca personal de médica con 281K en IG: casos reales y educación, cero descuentos" },
  { nombre: "Rada Cassab Medicina Estética", pageId: "137117346322807", pais: "CO", ciudad: "Medellín", porQue: "15 anuncios activos, algunos con 500+ días al aire; marca nacional de 30+ años (146K IG)" },
  { nombre: "Benessere / Dra. Tole", pageId: "422567424747558", pais: "CO", ciudad: "Bogotá", porQue: "13 anuncios activos; casi los mismos equipos que Vivante (criolipólisis, Ultraformer, Morpheus8)" },
  { nombre: "Clínica Be Dharma", pageId: "734261583105013", pais: "CO", ciudad: "Medellín", porQue: "11 anuncios activos; la no quirúrgica con más seguidores de Medellín (140K IG); anuncios educativos por tratamiento" },
  { nombre: "Espacolaser Colombia", pageId: "103446171643899", pais: "CO", ciudad: "Bogotá", porQue: "16 anuncios activos; cadena internacional de depilación (800+ centros)" },
  // EE. UU.
  { nombre: "Skin Laundry", pageId: "166192383533295", pais: "US", ciudad: "EE. UU. (cadenas)", porQue: "750 anuncios activos; gancho de entrada con precio: láser facial $50 (vale $275)" },
  { nombre: "SkinSpirit", pageId: "239659982790186", pais: "US", ciudad: "EE. UU. (cadenas)", porQue: "320 anuncios activos; 60 clínicas (KKR); video POV y rutina del profesional" },
  { nombre: "LaserAway", pageId: "157163837672241", pais: "US", ciudad: "EE. UU. (cadenas)", porQue: "290 anuncios activos; la cadena más grande (215+ clínicas); ofertas con cuota mensual" },
  { nombre: "Milan Laser Hair Removal", pageId: "1526930857572336", pais: "US", ciudad: "EE. UU. (cadenas)", porQue: "210 anuncios activos; 400+ clínicas; garantía de por vida y primera sesión gratis" },
  { nombre: "Alchemy 43", pageId: "857504861088365", pais: "US", ciudad: "EE. UU. (cadenas)", porQue: "190 anuncios activos; 30% en la primera cita, compra 2 lleva 1 en rellenos, financiación" },
  { nombre: "Heyday", pageId: "430915543738234", pais: "US", ciudad: "EE. UU. (cadenas)", porQue: "130 anuncios activos; faciales con membresía" },
  { nombre: "Semper Laser", pageId: "552845988519241", pais: "US", ciudad: "Miami", porQue: "100 anuncios activos; 13 sedes en Florida; «4 sesiones gratis» y cuota mensual desde $24" },
  { nombre: "Peachy", pageId: "2127944670829044", pais: "US", ciudad: "EE. UU. (cadenas)", porQue: "88 anuncios activos; precio fijo por zona ($425) en vez de por unidad" },
  { nombre: "Serenity Medical Spa", pageId: "954616634732103", pais: "US", ciudad: "Miami", porQue: "25 anuncios activos; todo en español para latinas: valoración gratis y WhatsApp" },
];
