/**
 * Guarda localmente la imagen de cada publicación orgánica (`public/organico/<red>-<id>.jpg`):
 * las URLs de Meta caducan en días y el panel debe seguir mostrando el video/imagen. Solo descarga
 * las que faltan; si una falla, la publicación queda sin imagen (nunca tumba la sincronización).
 */
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import type { LoteOrganico } from "@/lib/adapters/types";

export const CARPETA_MINIATURAS = process.env.ORACULO_RUTA_MINIATURAS_ORGANICO ? resolve(process.env.ORACULO_RUTA_MINIATURAS_ORGANICO) : resolve(process.cwd(), "public", "organico");
const RUTA_PUBLICA = "/organico";

export async function guardarMiniaturas(lote: LoteOrganico, fetchFn: typeof fetch = fetch): Promise<{ nuevas: number; fallidas: number }> {
  mkdirSync(CARPETA_MINIATURAS, { recursive: true });
  let nuevas = 0;
  let fallidas = 0;
  for (const p of lote.publicaciones) {
    const nombre = `${p.red}-${p.id.replace(/[^0-9a-zA-Z_-]/g, "")}.jpg`;
    const local = `${RUTA_PUBLICA}/${nombre}`;
    const archivo = resolve(CARPETA_MINIATURAS, nombre);
    if (existsSync(archivo)) {
      p.urlMiniatura = local;
      continue;
    }
    if (!p.urlMiniatura || p.urlMiniatura.startsWith(RUTA_PUBLICA)) continue;
    try {
      const r = await fetchFn(p.urlMiniatura);
      if (!r.ok) throw new Error(String(r.status));
      writeFileSync(archivo, Buffer.from(await r.arrayBuffer()));
      p.urlMiniatura = local;
      nuevas++;
    } catch {
      fallidas++;
      p.urlMiniatura = null;
    }
  }
  return { nuevas, fallidas };
}
