/**
 * Sube videos e imágenes del computador a una cuenta publicitaria de Meta, directo por la API.
 * Para cuando el conector de Claude Code dice «no puedo tomar el archivo» (solo acepta enlaces
 * públicos). El archivo viaja del PC a Meta por HTTPS: nunca queda abierto en internet.
 *
 *   npm run subir -- --verificar --cuenta "Vivante 6"
 *       → solo lectura: confirma que el permiso alcanza para subir a esa cuenta
 *   npm run subir -- "C:\\Users\\...\\Descargas\\BIOLASER\\Bioláser ver.1.mp4" "…ver.2.mp4" --cuenta "Vivante 6"
 *       → muestra qué subiría y NO sube nada
 *   … --confirmar
 *       → sube. Solo después de que una persona dijo «sí» a ese archivo y a esa cuenta.
 *
 * Al terminar da el id del video (video_id) y la miniatura: con eso se arma el anuncio con el
 * conector (`ads_create_creative` con video_id e image_url) o en el Administrador de anuncios.
 * El token vive en `.env` (META_ORGANICO_TOKEN) y no se imprime.
 */
import { closeSync, existsSync, openSync, readSync, statSync } from "node:fs";
import { basename, resolve } from "node:path";
import { cargarEnv } from "@/lib/adapters/env";
import { cliente } from "@/config/cliente";
import { elegirMiniatura, formatearTamano, resolverCuenta, tipoDeArchivo } from "@/lib/adapters/meta.medios";

cargarEnv();
const token = process.env.META_ORGANICO_TOKEN;
if (!token) {
  console.error("✗ Falta META_ORGANICO_TOKEN en .env");
  process.exit(1);
}
const API = "https://graph.facebook.com/v25.0";
const API_VIDEO = "https://graph-video.facebook.com/v25.0";
const arg = (n: string) => {
  const i = process.argv.indexOf(n);
  return i >= 0 ? process.argv[i + 1] : undefined;
};
const CON_VALOR = new Set(["--cuenta", "--nombre"]);
const archivos = process.argv.slice(2).filter((x, i, t) => !x.startsWith("--") && !CON_VALOR.has(t[i - 1] ?? ""));
const confirmar = process.argv.includes("--confirmar");
const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function llamar<T>(url: string, init?: RequestInit): Promise<T> {
  const r = await fetch(url, init);
  const j = (await r.json()) as T & { error?: { message?: string; error_user_msg?: string; code?: number } };
  if (j.error) throw new Error(`Meta respondió: ${j.error.error_user_msg ?? j.error.message ?? "error"} (código ${j.error.code ?? "?"})`);
  return j;
}

function leerTrozo(ruta: string, desde: number, hasta: number): Buffer {
  const largo = hasta - desde;
  const buf = Buffer.alloc(largo);
  const fd = openSync(ruta, "r");
  try {
    readSync(fd, buf, 0, largo, desde);
  } finally {
    closeSync(fd);
  }
  return buf;
}

/** Subida por partes (la forma de Meta para videos de cualquier tamaño). */
async function subirVideo(cuentaId: string, ruta: string, nombre: string): Promise<string> {
  const tamano = statSync(ruta).size;
  const formulario = (campos: Record<string, string>, trozo?: Buffer) => {
    const f = new FormData();
    f.set("access_token", token!);
    for (const [k, v] of Object.entries(campos)) f.set(k, v);
    if (trozo) f.set("video_file_chunk", new Blob([new Uint8Array(trozo)]), "trozo");
    return f;
  };
  const inicio = await llamar<{ upload_session_id: string; video_id: string; start_offset: string; end_offset: string }>(`${API_VIDEO}/${cuentaId}/advideos`, { method: "POST", body: formulario({ upload_phase: "start", file_size: String(tamano) }) });
  let desde = Number(inicio.start_offset);
  let hasta = Number(inicio.end_offset);
  while (desde < tamano) {
    const r = await llamar<{ start_offset: string; end_offset: string }>(`${API_VIDEO}/${cuentaId}/advideos`, { method: "POST", body: formulario({ upload_phase: "transfer", upload_session_id: inicio.upload_session_id, start_offset: String(desde) }, leerTrozo(ruta, desde, Math.min(hasta, tamano))) });
    desde = Number(r.start_offset);
    hasta = Number(r.end_offset);
    process.stdout.write(`\r  subiendo ${Math.min(100, Math.round((100 * desde) / tamano))} %   `);
  }
  process.stdout.write("\n");
  await llamar<{ success: boolean }>(`${API_VIDEO}/${cuentaId}/advideos`, { method: "POST", body: formulario({ upload_phase: "finish", upload_session_id: inicio.upload_session_id, title: nombre, name: nombre }) });
  return inicio.video_id;
}

async function subirImagen(cuentaId: string, ruta: string): Promise<string> {
  const f = new FormData();
  f.set("access_token", token!);
  f.set(basename(ruta), new Blob([new Uint8Array(leerTrozo(ruta, 0, statSync(ruta).size))]), basename(ruta));
  const j = await llamar<{ images?: Record<string, { hash: string }> }>(`${API}/${cuentaId}/adimages`, { method: "POST", body: f });
  const hash = Object.values(j.images ?? {})[0]?.hash;
  if (!hash) throw new Error("Meta no devolvió el hash de la imagen");
  return hash;
}

async function esperarProcesado(videoId: string): Promise<{ listo: boolean; miniatura: string | null }> {
  for (let i = 0; i < 40; i++) {
    const s = await llamar<{ status?: { video_status?: string } }>(`${API}/${videoId}?${new URLSearchParams({ fields: "status", access_token: token! })}`);
    const estado = s.status?.video_status;
    if (estado === "ready") {
      const m = await llamar<{ data?: { uri: string; is_preferred?: boolean }[] }>(`${API}/${videoId}/thumbnails?${new URLSearchParams({ access_token: token! })}`).catch(() => ({ data: [] }));
      return { listo: true, miniatura: elegirMiniatura(m.data ?? []) };
    }
    if (estado === "error") throw new Error("Meta no pudo procesar el video (formato o duración no aceptados)");
    await esperar(5_000);
  }
  return { listo: false, miniatura: null };
}

async function main() {
  const cuenta = resolverCuenta(arg("--cuenta"), cliente.cuentasPublicitarias.filter((c) => (c.plataforma ?? "meta") === "meta"));

  if (process.argv.includes("--verificar")) {
    /* solo lectura: ¿el token tiene permiso de administrar anuncios y ve los videos de esta cuenta? */
    const c = await llamar<{ name?: string; account_status?: number }>(`${API}/${cuenta.id}?${new URLSearchParams({ fields: "name,account_status", access_token: token! })}`);
    const v = await llamar<{ data?: { id: string }[] }>(`${API}/${cuenta.id}/advideos?${new URLSearchParams({ fields: "id", limit: "1", access_token: token! })}`);
    let permisos: string[] = [];
    if (process.env.META_APP_ID && process.env.META_APP_SECRET) {
      const d = await llamar<{ data?: { scopes?: string[]; is_valid?: boolean } }>(`${API}/debug_token?${new URLSearchParams({ input_token: token!, access_token: `${process.env.META_APP_ID}|${process.env.META_APP_SECRET}` })}`).catch(() => ({ data: undefined }));
      permisos = d.data?.scopes ?? [];
    }
    const administra = permisos.includes("ads_management");
    console.log(`${cuenta.nombre}: cuenta ${c.account_status === 1 ? "activa" : `estado ${c.account_status}`} · ve los videos de la cuenta: sí (${(v.data ?? []).length ? "tiene videos" : "sin videos"}) · permiso de administrar anuncios (ads_management): ${permisos.length ? (administra ? "sí" : "NO") : "no se pudo comprobar"}`);
    console.log(administra ? "✓ El permiso alcanza para subir medios. La primera subida real lo confirma del todo." : "✗ Falta el permiso ads_management en el token: sin él Meta no deja subir.");
    process.exit(administra || !permisos.length ? 0 : 1);
  }

  if (!archivos.length) {
    console.error('Uso: npm run subir -- "<archivo>" ["<otro>"] --cuenta "<cuenta>" [--confirmar]   |   npm run subir -- --verificar --cuenta "<cuenta>"');
    process.exit(1);
  }
  const lista = archivos.map((a) => {
    const ruta = resolve(a);
    if (!existsSync(ruta)) throw new Error(`No existe el archivo: ${ruta}`);
    const tipo = tipoDeArchivo(ruta);
    if (!tipo) throw new Error(`«${basename(ruta)}» no es un video ni una imagen que Meta acepte (mp4, mov… / jpg, png…).`);
    return { ruta, tipo, tamano: statSync(ruta).size };
  });

  console.log(`Cuenta: ${cuenta.nombre} (${cuenta.id})`);
  for (const f of lista) console.log(`  · ${f.tipo === "video" ? "video" : "imagen"} · ${basename(f.ruta)} · ${formatearTamano(f.tamano)}`);
  if (!confirmar) {
    console.log("\nNO se subió nada. Para subirlos, una persona tiene que decir «sí» y se repite el comando con --confirmar.");
    return;
  }

  for (const f of lista) {
    const nombre = arg("--nombre") && lista.length === 1 ? arg("--nombre")! : basename(f.ruta).replace(/\.[^.]+$/, "");
    console.log(`\n▶ ${basename(f.ruta)}`);
    if (f.tipo === "imagen") {
      console.log(`  ✓ subida. image_hash: ${await subirImagen(cuenta.id, f.ruta)}`);
      continue;
    }
    const videoId = await subirVideo(cuenta.id, f.ruta, nombre);
    console.log(`  ✓ subido. video_id: ${videoId} · esperando que Meta lo procese…`);
    const p = await esperarProcesado(videoId);
    console.log(p.listo ? `  ✓ listo para usar en un anuncio${p.miniatura ? `\n    miniatura (image_url): ${p.miniatura}` : ""}` : "  … Meta sigue procesándolo; el video_id ya sirve, solo puede tardar unos minutos en aprobarse.");
  }
  console.log("\nSiguiente: armar el anuncio con el video_id (conector `ads_create_creative` o Administrador de anuncios).");
}

main().catch((e) => {
  console.error(`✗ ${e instanceof Error ? e.message : String(e)}`);
  process.exit(1);
});
