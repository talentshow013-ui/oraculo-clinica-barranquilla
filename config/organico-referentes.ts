/**
 * Referentes ORGÁNICOS que se siguen cada semana (Instagram, API oficial). Clínicas y doctoras de
 * estética (y alguna de otra especialidad que sea modelo de contenido, como la Dra. Pulgarín).
 * Para agregar una: su usuario de Instagram sin @ (debe ser cuenta de empresa o creador).
 */
export interface ReferenteOrganico {
  usuario: string;
  nombre: string;
  ciudad: string;
  porQue: string;
}
export const REFERENTES_ORGANICOS: ReadonlyArray<ReferenteOrganico> = [
  { usuario: "dradianapulgarin", nombre: "Dra. Diana Pulgarín", ciudad: "Colombia", porQue: "Odontología estética; ~2 M de seguidores: colaboraciones con famosos" },
  { usuario: "dramariapaulabello", nombre: "Dra. María Paula Bello (Bèl)", ciudad: "Bogotá", porQue: "Marca personal de médica estética: ella en cámara, casos y su vida" },
  { usuario: "radacassab", nombre: "Rada Cassab", ciudad: "Bogotá · Medellín", porQue: "La doctora como protagonista, historias y tendencias: la que más comentarios saca por post" },
  { usuario: "benesseremedicinaestetica", nombre: "Benessere / Dra. Tole", ciudad: "Bogotá", porQue: "Mismos equipos que Vivante; historias personales y casos de pacientes" },
  { usuario: "clinicabedharma", nombre: "Clínica Be Dharma", ciudad: "Medellín", porQue: "La no quirúrgica con más seguidores de Medellín" },
  { usuario: "dra.sindyclaro", nombre: "Dra. Sindy Claro", ciudad: "Santa Marta · Barranquilla", porQue: "147K seguidores y 541 reseñas en Google; dice atender en Barranquilla" },
  { usuario: "armoniamedicalesthetic_", nombre: "Armonía Medical Esthetic", ciudad: "Santa Marta · Barranquilla (Riomar)", porQue: "Competencia directa con sede en Riomar" },
  { usuario: "equilibrio_clinic", nombre: "Equilibrio Clinic", ciudad: "Cartagena", porQue: "Colaboraciones con influenciadores: 170–230 veces su alcance normal" },
  { usuario: "cliniqmedellin", nombre: "Cliniq", ciudad: "Medellín", porQue: "La cuenta del sector con más seguidores en Medellín" },
  { usuario: "laseraway", nombre: "LaserAway", ciudad: "EE. UU.", porQue: "La cadena más grande de EE. UU." },
  { usuario: "skinlaundry", nombre: "Skin Laundry", ciudad: "EE. UU.", porQue: "El anunciante de estética con más anuncios activos en EE. UU." },
];
/** La cuenta propia, para compararse con los mismos números. */
export const CUENTA_PROPIA = "vivantemedicinaestetica";
