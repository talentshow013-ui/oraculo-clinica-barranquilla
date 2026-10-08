/**
 * Google Drive de solo lectura, desde el agente: encontrar y leer documentos (guiones, precios,
 * protocolos). Lo leído se muestra y no se guarda en el repositorio.
 *
 *   npm run drive -- listar                       → lo más reciente
 *   npm run drive -- buscar "lipo en frío"        → por nombre o por contenido
 *   npm run drive -- leer <id | enlace>           → el texto de un documento, hoja o archivo de texto
 *   opciones: --carpeta <id>   limita a una carpeta · --max 30   cuántos resultados
 *
 * Requiere `npm run drive:conectar` (una vez). Nunca datos de pacientes (nombres, teléfonos, historias).
 */
import { cargarEnv } from "@/lib/adapters/env";
import { API_DRIVE, consultaDeBusqueda, formatoDeExportacion, resumirArchivo, tokenDeAccesoDrive, urlDeLista, type ArchivoDrive } from "@/lib/adapters/drive";

cargarEnv();
const e = process.env;
if (!e.GOOGLE_DRIVE_CLIENT_ID || !e.GOOGLE_DRIVE_CLIENT_SECRET || !e.GOOGLE_DRIVE_REFRESH_TOKEN) {
  console.error("✗ Drive no está conectado. Corre una vez: npm run drive:conectar");
  process.exit(1);
}
const [orden, ...resto] = process.argv.slice(2).filter((x, i, t) => !x.startsWith("--") && !["--carpeta", "--max"].includes(t[i - 1] ?? ""));
const arg = (n: string) => {
  const i = process.argv.indexOf(n);
  return i >= 0 ? process.argv[i + 1] : undefined;
};
const MAX_CARACTERES = 60_000;

async function pedir(token: string, url: string): Promise<Response> {
  const r = await fetch(url, { headers: { authorization: `Bearer ${token}` } });
  if (!r.ok) throw new Error(`Drive respondió ${r.status}: ${(await r.text()).slice(0, 200)}`);
  return r;
}

async function main() {
  const token = await tokenDeAccesoDrive({ clientId: e.GOOGLE_DRIVE_CLIENT_ID!, clientSecret: e.GOOGLE_DRIVE_CLIENT_SECRET!, refreshToken: e.GOOGLE_DRIVE_REFRESH_TOKEN! });
  if (orden === "listar" || orden === "buscar") {
    const texto = orden === "buscar" ? resto.join(" ") : "";
    const j = (await (await pedir(token, urlDeLista(consultaDeBusqueda(texto, { carpetaId: arg("--carpeta") }), Number(arg("--max") ?? 20)))).json()) as { files?: ArchivoDrive[] };
    const lista = (j.files ?? []).map(resumirArchivo);
    console.log(lista.length ? `${lista.length} archivo(s)${texto ? ` para «${texto}»` : " recientes"}:` : "No encontré nada.");
    for (const a of lista) console.log(`  · ${a.nombre} (${a.tipo}${a.legible ? "" : ", no se lee como texto"}) · ${a.modificado}${a.dueno ? ` · ${a.dueno}` : ""}\n    id: ${a.id}${a.enlace ? `  ${a.enlace}` : ""}`);
    return;
  }
  if (orden === "leer") {
    const id = (resto.join(" ").match(/[-\w]{25,}/) ?? [])[0];
    if (!id) {
      console.error("✗ Pásame el id o el enlace del archivo: npm run drive -- leer <id | enlace>");
      process.exit(1);
    }
    const meta = (await (await pedir(token, `${API_DRIVE}/files/${id}?fields=id,name,mimeType,modifiedTime,size&supportsAllDrives=true`)).json()) as ArchivoDrive;
    const modo = formatoDeExportacion(meta.mimeType);
    if (!modo) {
      console.error(`✗ «${meta.name}» es ${resumirArchivo(meta).tipo}: no se puede leer como texto desde aquí. Ábrelo en Drive.`);
      process.exit(1);
    }
    const url = modo === "descargar" ? `${API_DRIVE}/files/${id}?alt=media&supportsAllDrives=true` : `${API_DRIVE}/files/${id}/export?mimeType=${encodeURIComponent(modo)}`;
    const texto = await (await pedir(token, url)).text();
    console.log(`# ${meta.name} · ${(meta.modifiedTime ?? "").slice(0, 10)}\n`);
    console.log(texto.length > MAX_CARACTERES ? `${texto.slice(0, MAX_CARACTERES)}\n\n… (cortado: ${texto.length.toLocaleString("es-CO")} caracteres en total)` : texto);
    return;
  }
  console.error('Uso: npm run drive -- listar | buscar "texto" | leer <id|enlace>   (opciones: --carpeta <id> --max 30)');
  process.exit(1);
}

main().catch((err) => {
  console.error(`✗ ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
