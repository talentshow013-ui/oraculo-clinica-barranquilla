/**
 * Fechas SIEMPRE en America/Bogota. Prohibido `toISOString().slice(0, 10)`
 * para obtener el día: corrompe la fecha según la zona del equipo (§12.5).
 *
 * Las fechas del contrato son strings YYYY-MM-DD; aquí la aritmética se hace
 * sobre el calendario (UTC puro con fechas a medianoche) para que sumar días
 * nunca dependa de la zona del sistema.
 */

const ZONA = "America/Bogota";

const formateadorBogota = new Intl.DateTimeFormat("en-CA", {
  timeZone: ZONA,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Instante → día calendario en Bogotá (YYYY-MM-DD). */
export function aFechaBogota(instante: Date): string {
  return formateadorBogota.format(instante);
}

export function hoyBogota(): string {
  return aFechaBogota(new Date());
}

/** Fecha YYYY-MM-DD → milisegundos de esa medianoche en calendario (UTC). */
function aMs(fecha: string): number {
  const [y, m, d] = fecha.split("-").map(Number);
  if (y === undefined || m === undefined || d === undefined) {
    throw new Error(`Fecha inválida: ${fecha}`);
  }
  return Date.UTC(y, m - 1, d);
}

function deMs(ms: number): string {
  const d = new Date(ms);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

const DIA_MS = 86_400_000;

export function sumarDias(fecha: string, dias: number): string {
  return deMs(aMs(fecha) + dias * DIA_MS);
}

/** Días inclusivos entre dos fechas (01 → 07 = 7). */
export function diasEntre(desde: string, hasta: string): number {
  return Math.round((aMs(hasta) - aMs(desde)) / DIA_MS) + 1;
}

export function rangoDias(desde: string, hasta: string): string[] {
  const n = diasEntre(desde, hasta);
  const salida: string[] = [];
  for (let i = 0; i < n; i++) salida.push(sumarDias(desde, i));
  return salida;
}

/** Días del rango que no aparecen en `presentes`. Un hueco puede simular una caída. */
export function listarHuecos(desde: string, hasta: string, presentes: ReadonlySet<string>): string[] {
  return rangoDias(desde, hasta).filter((d) => !presentes.has(d));
}

/** Día de la semana 0-6 (domingo = 0) de una fecha calendario. */
export function diaSemana(fecha: string): number {
  return new Date(aMs(fecha)).getUTCDay();
}

/** Semana ISO "YYYY-Www" para nombrar reportes. */
export function semanaISO(fecha: string): string {
  const d = new Date(aMs(fecha));
  const dia = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dia);
  const inicioAnio = Date.UTC(d.getUTCFullYear(), 0, 1);
  const semana = Math.ceil(((d.getTime() - inicioAnio) / DIA_MS + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(semana).padStart(2, "0")}`;
}
