/**
 * Google Drive de solo lectura, para que el agente encuentre y lea documentos (guiones, precios,
 * protocolos) cuando se lo pidan. Permiso `drive.readonly` por OAuth con el inicio de sesión de una
 * persona: ve lo que esa cuenta ve, y nada se escribe ni se borra. El token de actualización vive
 * solo en `.env` (`npm run drive:conectar`).
 *
 * Privacidad: lo que se lee se muestra en el momento; no se guarda en el repositorio. Nunca nombres,
 * teléfonos ni historias de pacientes (ver CLAUDE.md).
 */
export const API_DRIVE = "https://www.googleapis.com/drive/v3";
export const SCOPE_DRIVE = "https://www.googleapis.com/auth/drive.readonly";

export const TIPO_GOOGLE = {
  carpeta: "application/vnd.google-apps.folder",
  documento: "application/vnd.google-apps.document",
  hoja: "application/vnd.google-apps.spreadsheet",
  presentacion: "application/vnd.google-apps.presentation",
} as const;

export interface ArchivoDrive {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime?: string;
  webViewLink?: string;
  size?: string;
  owners?: { displayName?: string }[];
}

export interface ResumenArchivo {
  id: string;
  nombre: string;
  tipo: string;
  modificado: string;
  enlace: string | null;
  dueno: string | null;
  /** ¿Se puede leer como texto? (Docs, Hojas, Presentaciones y archivos de texto) */
  legible: boolean;
}

/** `q` de la API de Drive: texto en el nombre o en el contenido, sin la papelera, opcionalmente dentro de una carpeta. */
export function consultaDeBusqueda(texto: string, o: { carpetaId?: string } = {}): string {
  const partes: string[] = [];
  const t = texto.trim().replace(/\\/g, "\\\\").replace(/'/g, "\\'");
  if (t) partes.push(`(name contains '${t}' or fullText contains '${t}')`);
  if (o.carpetaId) partes.push(`'${o.carpetaId.replace(/'/g, "")}' in parents`);
  partes.push("trashed = false");
  return partes.join(" and ");
}

export function urlDeLista(q: string, tamano = 20): string {
  const p = new URLSearchParams({
    q,
    pageSize: String(Math.min(Math.max(tamano, 1), 100)),
    orderBy: "modifiedTime desc",
    fields: "files(id,name,mimeType,modifiedTime,webViewLink,size,owners(displayName))",
    supportsAllDrives: "true",
    includeItemsFromAllDrives: "true",
  });
  return `${API_DRIVE}/files?${p}`;
}

/** Cómo leer un archivo como texto: exportarlo (Docs), descargarlo (texto) o no se puede (null). */
export function formatoDeExportacion(mime: string): "text/plain" | "text/csv" | "descargar" | null {
  if (mime === TIPO_GOOGLE.documento || mime === TIPO_GOOGLE.presentacion) return "text/plain";
  if (mime === TIPO_GOOGLE.hoja) return "text/csv";
  if (mime.startsWith("text/") || mime === "application/json") return "descargar";
  return null;
}

const NOMBRE_TIPO: Record<string, string> = {
  [TIPO_GOOGLE.carpeta]: "carpeta",
  [TIPO_GOOGLE.documento]: "documento",
  [TIPO_GOOGLE.hoja]: "hoja de cálculo",
  [TIPO_GOOGLE.presentacion]: "presentación",
  "application/pdf": "PDF",
};

export function resumirArchivo(a: ArchivoDrive): ResumenArchivo {
  return {
    id: a.id,
    nombre: a.name,
    tipo: NOMBRE_TIPO[a.mimeType] ?? (a.mimeType.startsWith("image/") ? "imagen" : a.mimeType.startsWith("video/") ? "video" : a.mimeType.startsWith("text/") ? "texto" : a.mimeType),
    modificado: (a.modifiedTime ?? "").slice(0, 10),
    enlace: a.webViewLink ?? null,
    dueno: a.owners?.[0]?.displayName ?? null,
    legible: formatoDeExportacion(a.mimeType) !== null,
  };
}

export interface CredencialesDrive {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
}

export async function tokenDeAccesoDrive(c: CredencialesDrive, fetchFn: typeof fetch = fetch): Promise<string> {
  const r = await fetchFn("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "refresh_token", client_id: c.clientId, client_secret: c.clientSecret, refresh_token: c.refreshToken }).toString(),
  });
  const j = (await r.json()) as { access_token?: string; error?: string; error_description?: string };
  if (!j.access_token) throw new Error(`Google no dio token de acceso a Drive: ${j.error_description ?? j.error ?? r.status}`);
  return j.access_token;
}
