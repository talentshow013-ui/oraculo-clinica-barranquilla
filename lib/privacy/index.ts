/**
 * Privacidad por esquema, no por política.
 *
 * Una clínica estética maneja datos de salud: datos sensibles según la
 * Ley 1581 de 2012 (art. 5). Aquí no hay dónde guardar un dato identificable
 * de paciente y, si alguien lo intenta, la carga falla ruidosamente. Es más
 * barato romper una importación que filtrar datos de una paciente.
 */
import { createHash } from "node:crypto";

/** Un cruce con menos de 5 registros identifica a una persona concreta. */
export const K_MINIMO = 5;

export const CAMPOS_PROHIBIDOS: ReadonlyArray<string> = [
  "nombre",
  "apellido",
  "nombrecompleto",
  "cedula",
  "documento",
  "identificacion",
  "telefono",
  "celular",
  "whatsapp",
  "email",
  "correo",
  "direccion",
  "historia",
  "historiaclinica",
  "diagnostico",
  "pacienteid",
  "paciente",
  "fechanacimiento",
  "nacimiento",
];

export const AVISO_PANEL =
  "Este panel trabaja con cifras agregadas. No guarda nombres, teléfonos ni historias de pacientes, " +
  "y oculta cualquier cruce con menos de 5 personas para que nadie pueda ser identificado.";

export class ErrorDatoSensible extends Error {
  readonly ruta: string;
  constructor(ruta: string) {
    super(
      `Dato sensible detectado en "${ruta}". El panel no puede almacenar datos identificables de ` +
        `pacientes (Ley 1581 de 2012, art. 5). La carga se detuvo.`,
    );
    this.name = "ErrorDatoSensible";
    this.ruta = ruta;
  }
}

/** Normaliza nombres de campo: minúsculas, sin acentos ni separadores. */
function normalizar(clave: string): string {
  return clave
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

const PROHIBIDOS_NORMALIZADOS = new Set(CAMPOS_PROHIBIDOS.map(normalizar));

/**
 * Rutas del contrato donde "nombre" es el nombre de una ENTIDAD de la
 * plataforma (campaña, conjunto, anuncio, competidor), nunca de una persona.
 * Todo lo demás con esa clave se rechaza; en particular, nada en `embudo`.
 */
const RUTAS_PERMITIDAS: ReadonlyArray<RegExp> = [
  /^(insights|desgloses)\[\d+\]\.nombre$/,
  /^competidores\[\d+\]\.nombre$/,
  /^rankings\[\d+\]\.nombre$/,
  /^bitacora\[\d+\]\.(objetoNombre|actor)$/,
];

/**
 * Guardián de ingesta. Recorre cualquier objeto y lanza ErrorDatoSensible si
 * encuentra una clave prohibida. Devuelve el mismo objeto si está limpio.
 */
export function validarSinPII<T>(objeto: T, ruta = ""): T {
  if (Array.isArray(objeto)) {
    objeto.forEach((item, i) => validarSinPII(item, `${ruta}[${i}]`));
    return objeto;
  }
  if (objeto !== null && typeof objeto === "object") {
    for (const [clave, valor] of Object.entries(objeto as Record<string, unknown>)) {
      const rutaHija = ruta ? `${ruta}.${clave}` : clave;
      const permitida = RUTAS_PERMITIDAS.some((re) => re.test(rutaHija));
      if (!permitida && PROHIBIDOS_NORMALIZADOS.has(normalizar(clave))) {
        throw new ErrorDatoSensible(rutaHija);
      }
      validarSinPII(valor, rutaHija);
    }
  }
  return objeto;
}

/** Oculta el valor si el cruce tiene menos de k registros. */
export function enmascarar<T>(valor: T, nRegistros: number, k = K_MINIMO): T | null {
  return nRegistros < k ? null : valor;
}

export function filtrarPorK<T extends { nRegistros: number }>(
  filas: ReadonlyArray<T>,
  k = K_MINIMO,
): { visibles: T[]; ocultas: T[] } {
  const visibles: T[] = [];
  const ocultas: T[] = [];
  for (const f of filas) (f.nRegistros < k ? ocultas : visibles).push(f);
  return { visibles, ocultas };
}

/** SHA-256 con sal. Solo para deduplicar recompras; nunca reversible. */
export function pseudonimizar(valor: string, sal: string): string {
  return createHash("sha256").update(`${sal}:${valor}`).digest("hex");
}
