/**
 * Candado del panel. Cuando el panel vive en internet (VPS) se exige usuario y clave; en un
 * PC local, sin variables configuradas, queda abierto. Comparación en tiempo constante para no
 * filtrar la longitud de la clave. Sin dependencias: sirve en el borde (middleware).
 */
export interface ConfigAcceso {
  usuario: string | undefined;
  clave: string | undefined;
}

export type Decision = "abierto" | "permitido" | "pedir";

function igualConstante(a: string, b: string): boolean {
  const la = new TextEncoder().encode(a);
  const lb = new TextEncoder().encode(b);
  let diff = la.length ^ lb.length;
  const n = Math.max(la.length, lb.length);
  for (let i = 0; i < n; i++) diff |= (la[i] ?? 0) ^ (lb[i] ?? 0);
  return diff === 0;
}

function decodificarBase64(s: string): string | null {
  try {
    if (typeof atob === "function") {
      const bin = atob(s);
      const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
      return new TextDecoder().decode(bytes);
    }
    return Buffer.from(s, "base64").toString("utf8");
  } catch {
    return null;
  }
}

export function autorizar(cabeceraAuthorization: string | null, cfg: ConfigAcceso): Decision {
  const usuario = cfg.usuario ?? "";
  const clave = cfg.clave ?? "";
  if (!usuario || !clave) return "abierto";
  if (!cabeceraAuthorization?.startsWith("Basic ")) return "pedir";
  const texto = decodificarBase64(cabeceraAuthorization.slice(6).trim());
  if (!texto) return "pedir";
  const sep = texto.indexOf(":");
  if (sep < 0) return "pedir";
  const u = texto.slice(0, sep);
  const c = texto.slice(sep + 1);
  return igualConstante(u, usuario) && igualConstante(c, clave) ? "permitido" : "pedir";
}

export function cabeceraDesafio(): string {
  // Solo ASCII: un encabezado HTTP con tildes rompe la respuesta.
  return 'Basic realm="Oraculo - panel privado", charset="UTF-8"';
}
