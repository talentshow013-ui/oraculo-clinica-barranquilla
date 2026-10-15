/**
 * Recibe el aviso de Kommo (webhook) y lo convierte en conteos y tiempos. El TEXTO de los mensajes se
 * lee en memoria y se descarta: no se guarda, no se imprime, no se manda a ningún lado.
 * La ruta HTTP (`app/api/kommo/webhook/[secreto]/route.ts`) solo llama a `procesarAviso`.
 */
import { timingSafeEqual } from "node:crypto";
import { existsSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { cargarMensajes } from "./mensajes.archivo";
import type { AnuncioMensaje } from "./meta.mensajes";
import { cargarConversaciones, guardarConversaciones } from "./conversaciones.archivo";
import { aObjeto, aplicarMensaje, atribuir, cuentaDelAviso, extraerMensajes, purgar } from "./kommo.conversaciones";

/** Compara el secreto de la dirección con el configurado, sin dar pistas por el tiempo. */
export function secretoValido(recibido: string, esperado: string | undefined): boolean {
  if (!esperado || !recibido) return false;
  const a = Buffer.from(recibido);
  const b = Buffer.from(esperado);
  return a.length === b.length && timingSafeEqual(a, b);
}

export interface OpcionesAviso {
  contentType: string | null;
  cuerpo: string;
  /** Ruta de `datos/conversaciones.json`. */
  ruta: string;
  /** Secreto para las huellas (el de la dirección del webhook). */
  secreto: string;
  /** Subdominio de Kommo de la clínica: avisos de otra cuenta se ignoran. */
  subdominio?: string | null;
  anuncios: ReadonlyArray<AnuncioMensaje>;
  /** Solo dice qué entendió; no guarda nada. */
  prueba?: boolean;
}

export interface RespuestaAviso {
  recibidos: number;
  nuevas: number;
  respuestas: number;
  ignorados: number;
  prueba?: { direccion: string; nivel: string; campana: string | null; anuncio: string | null }[];
}

/** Un solo escritor a la vez: los avisos pueden llegar juntos y cada uno lee-modifica-escribe el archivo. */
let cola: Promise<unknown> = Promise.resolve();
const enFila = <T>(f: () => T): Promise<T> => {
  const p = cola.then(f, f);
  cola = p.catch(() => undefined);
  return p;
};

/**
 * Para verificar el formato real del aviso sin guardar contenido: solo los NOMBRES de los campos
 * (`message[add][0][text]`), nunca sus valores.
 */
function anotarForma(rutaConversaciones: string, cuerpo: string, contentType: string | null, ahora: Date): void {
  const rutaForma = join(dirname(rutaConversaciones), "kommo-webhook-forma.json");
  const campos = new Set<string>();
  const t = (contentType ?? "").toLowerCase();
  if (!t.includes("json") && !cuerpo.trim().startsWith("{")) {
    for (const k of new URLSearchParams(cuerpo).keys()) if (/^[A-Za-z_]+(\[[A-Za-z_0-9]+\])*$/.test(k) && k.length <= 80) campos.add(k);
  } else {
    const recorrer = (n: unknown, p: string, d: number) => {
      if (!n || typeof n !== "object" || d > 6) return;
      for (const [k, v] of Object.entries(n)) {
        const ruta = p ? `${p}.${Array.isArray(n) ? "[]" : k}` : k;
        if (/^[A-Za-z_]+$/.test(Array.isArray(n) ? "x" : k)) {
          if (v && typeof v === "object") recorrer(v, ruta, d + 1);
          else campos.add(ruta);
        }
      }
    };
    recorrer(aObjeto(contentType, cuerpo), "", 0);
  }
  let previo: { campos?: string[]; avisos?: number } = {};
  try {
    if (existsSync(rutaForma)) previo = JSON.parse(readFileSync(rutaForma, "utf8"));
  } catch {
    /* se rehace */
  }
  const union = [...new Set([...(previo.campos ?? []), ...campos])].sort().slice(0, 300);
  writeFileSync(rutaForma, JSON.stringify({ avisos: (previo.avisos ?? 0) + 1, ultimoAviso: ahora.toISOString(), campos: union }, null, 2), { encoding: "utf8", mode: 0o600 });
}

export function procesarAviso(o: OpcionesAviso): Promise<RespuestaAviso> {
  const raiz = aObjeto(o.contentType, o.cuerpo);
  const cuenta = cuentaDelAviso(raiz);
  if (o.subdominio && cuenta && cuenta.toLowerCase() !== o.subdominio.toLowerCase()) return Promise.resolve({ recibidos: 0, nuevas: 0, respuestas: 0, ignorados: 1 });
  const mensajes = extraerMensajes(raiz);
  if (!mensajes.length) return Promise.resolve({ recibidos: 0, nuevas: 0, respuestas: 0, ignorados: 0 });

  if (o.prueba) {
    return Promise.resolve({
      recibidos: mensajes.length,
      nuevas: 0,
      respuestas: 0,
      ignorados: 0,
      prueba: mensajes.map((m) => {
        const a = m.direccion === "entrante" ? atribuir(m.texto, o.anuncios) : null;
        return { direccion: m.direccion, nivel: a?.nivel ?? "-", campana: a?.campana ?? null, anuncio: a?.anuncio ?? null };
      }),
    });
  }

  return enFila(() => {
    const ahora = new Date();
    let estado = cargarConversaciones(o.ruta);
    const r: RespuestaAviso = { recibidos: mensajes.length, nuevas: 0, respuestas: 0, ignorados: 0 };
    for (const m of mensajes) {
      const res = aplicarMensaje(estado, m, { secreto: o.secreto, anuncios: o.anuncios });
      estado = res.estado;
      if (res.efecto === "nueva") r.nuevas++;
      else if (res.efecto === "respuesta") r.respuestas++;
      else if (res.efecto === "ignorado") r.ignorados++;
    }
    estado = purgar(estado, Math.floor(ahora.getTime() / 1000), 90);
    guardarConversaciones({ ...estado, actualizadoEn: ahora.toISOString() }, o.ruta);
    try {
      anotarForma(o.ruta, o.cuerpo, o.contentType, ahora);
    } catch {
      /* la forma es solo una ayuda para verificar */
    }
    return r;
  });
}

/** Los anuncios con mensaje predeterminado, con caché por fecha del archivo (el webhook llega seguido). */
let cache: { mtime: number; ruta: string; anuncios: AnuncioMensaje[] } | null = null;
export function anunciosConMensaje(archivo: string = join(process.cwd(), "datos", "mensajes.json")): AnuncioMensaje[] {
  if (!existsSync(archivo)) return [];
  const mtime = statSync(archivo).mtimeMs;
  if (cache && cache.ruta === archivo && cache.mtime === mtime) return cache.anuncios;
  const anuncios = cargarMensajes(archivo).anuncios.filter((a) => a.predeterminado);
  cache = { mtime, ruta: archivo, anuncios };
  return anuncios;
}
