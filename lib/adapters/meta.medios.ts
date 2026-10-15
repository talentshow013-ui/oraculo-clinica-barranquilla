/**
 * Subir videos e imágenes de la clínica a una cuenta publicitaria de Meta, directo por la API
 * (el conector de Claude Code no puede: corre en los servidores de Meta y no ve el computador,
 * y solo acepta enlaces públicos). El archivo viaja del PC a Meta por HTTPS; nunca queda abierto
 * en internet. Parte pura aquí; el envío está en `scripts/subir.ts`.
 */
const EXT_VIDEO = ["mp4", "mov", "m4v", "avi", "mkv", "webm"];
const EXT_IMAGEN = ["jpg", "jpeg", "png", "gif", "bmp"];

export function tipoDeArchivo(ruta: string): "video" | "imagen" | null {
  const ext = ruta.toLowerCase().split(".").pop() ?? "";
  if (EXT_VIDEO.includes(ext)) return "video";
  if (EXT_IMAGEN.includes(ext)) return "imagen";
  return null;
}

export function formatearTamano(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1).replace(".", ",")} MB`;
  return `${(bytes / 1024 ** 3).toFixed(2).replace(".", ",")} GB`;
}

const plano = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** La cuenta elegida por id o por parte del nombre. Si no es una sola, error: nunca se adivina a dónde se sube. */
export function resolverCuenta<T extends { id: string; nombre: string }>(texto: string | undefined, cuentas: ReadonlyArray<T>): T {
  const q = plano(texto ?? "").trim();
  if (!q) throw new Error(`Falta --cuenta. Cuentas: ${cuentas.map((c) => c.nombre).join(" | ")}`);
  const exacta = cuentas.find((c) => plano(c.id) === q || plano(c.id) === `act_${q}`);
  if (exacta) return exacta;
  const hallan = cuentas.filter((c) => plano(c.nombre).includes(q));
  if (hallan.length === 1) return hallan[0]!;
  if (!hallan.length) throw new Error(`No encuentro ninguna cuenta como «${texto}». Cuentas: ${cuentas.map((c) => c.nombre).join(" | ")}`);
  throw new Error(`«${texto}» sirve para varias cuentas (${hallan.map((c) => c.nombre).join(" | ")}). Sé más específico.`);
}

/** La miniatura que Meta eligió para el video (la preferida; si no, la primera). */
export function elegirMiniatura(miniaturas: ReadonlyArray<{ uri: string; is_preferred?: boolean }>): string | null {
  return (miniaturas.find((m) => m.is_preferred) ?? miniaturas[0])?.uri ?? null;
}
