/**
 * Conecta Google Drive UNA vez, de solo lectura: abre el permiso de Google, recibe el código en
 * http://127.0.0.1:53683, lo cambia por un token de actualización y lo guarda en .env. Nada va al
 * repositorio.
 *
 *   npm run drive:conectar
 *
 * Antes, en .env: GOOGLE_DRIVE_CLIENT_ID y GOOGLE_DRIVE_CLIENT_SECRET (cliente OAuth «Aplicación de
 * escritorio» de un proyecto de Google Cloud con la API de Drive habilitada).
 * Desde un celular: abre el enlace allá; al final sale un error de página (es normal), copia la
 * dirección completa y pásala con `npm run drive:conectar -- --codigo "<dirección>"`.
 */
import { createServer } from "node:http";
import { cargarEnv, guardarEnEnv } from "@/lib/adapters/env";
import { API_DRIVE, SCOPE_DRIVE } from "@/lib/adapters/drive";

cargarEnv();
const clientId = process.env.GOOGLE_DRIVE_CLIENT_ID;
const clientSecret = process.env.GOOGLE_DRIVE_CLIENT_SECRET;
if (!clientId || !clientSecret) {
  console.error("✗ Faltan en .env: GOOGLE_DRIVE_CLIENT_ID y GOOGLE_DRIVE_CLIENT_SECRET (ID de cliente OAuth tipo «Aplicación de escritorio»).");
  process.exit(1);
}
const PUERTO = 53683;
const redirect = `http://127.0.0.1:${PUERTO}`;
const url = `https://accounts.google.com/o/oauth2/v2/auth?${new URLSearchParams({ client_id: clientId, redirect_uri: redirect, response_type: "code", scope: SCOPE_DRIVE, access_type: "offline", prompt: "consent" })}`;

async function canjear(code: string) {
  const r = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ code, client_id: clientId!, client_secret: clientSecret!, redirect_uri: redirect, grant_type: "authorization_code" }).toString() });
  const j = (await r.json()) as { refresh_token?: string; access_token?: string; error_description?: string };
  if (!j.refresh_token || !j.access_token) throw new Error(j.error_description ?? "Google no devolvió el token de actualización (repite y acepta todos los permisos).");
  guardarEnEnv({ GOOGLE_DRIVE_REFRESH_TOKEN: j.refresh_token });
  const yo = (await (await fetch(`${API_DRIVE}/about?fields=user(displayName,emailAddress)`, { headers: { authorization: `Bearer ${j.access_token}` } })).json()) as { user?: { displayName?: string; emailAddress?: string } };
  console.log(`✓ Drive conectado de solo lectura${yo.user?.emailAddress ? ` como ${yo.user.emailAddress}` : ""}. Prueba: npm run drive -- listar`);
}

const iCodigo = process.argv.indexOf("--codigo");
if (iCodigo >= 0) {
  const code = new URL(process.argv[iCodigo + 1] ?? "", redirect).searchParams.get("code");
  if (!code) {
    console.error("✗ No encuentro el código en esa dirección (debe traer ?code=…).");
    process.exit(1);
  }
  canjear(code).catch((e) => {
    console.error(`✗ ${e instanceof Error ? e.message : String(e)}`);
    process.exit(1);
  });
} else {
  const servidor = createServer(async (req, res) => {
    const code = new URL(req.url ?? "/", redirect).searchParams.get("code");
    if (!code) {
      res.end("Sin código. Vuelve a la terminal.");
      return;
    }
    res.end("Listo. Ya puedes cerrar esta pestaña y volver a la terminal.");
    servidor.close();
    try {
      await canjear(code);
    } catch (e) {
      console.error(`✗ ${e instanceof Error ? e.message : String(e)}`);
      process.exit(1);
    }
  });
  servidor.listen(PUERTO, "127.0.0.1", () => console.log(`Abre este enlace, entra con la cuenta de Google dueña de los archivos y acepta (solo lectura):\n\n${url}\n\nEsperando…`));
}
