/**
 * Conecta Google Ads UNA vez (solo lectura): abre el permiso de Google en el navegador, recibe el
 * código en http://127.0.0.1:53682, lo cambia por un token de actualización y lo guarda en .env
 * junto con la cuenta. Nada va al repositorio.
 *
 *   npm run googleads:conectar
 *
 * Antes, en .env: GOOGLE_ADS_DEVELOPER_TOKEN (Centro de API de la cuenta administradora),
 * GOOGLE_ADS_CLIENT_ID y GOOGLE_ADS_CLIENT_SECRET (cliente OAuth «Aplicación de escritorio» del
 * proyecto de Google Cloud). Guía: docs/CONEXION_GOOGLE_ADS.md
 */
import { createServer } from "node:http";
import { cargarEnv, guardarEnEnv } from "@/lib/adapters/env";
import { cuentasAccesibles } from "@/lib/adapters/google.ads";

cargarEnv();
const clientId = process.env.GOOGLE_ADS_CLIENT_ID;
const clientSecret = process.env.GOOGLE_ADS_CLIENT_SECRET;
const developerToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN;
if (!clientId || !clientSecret || !developerToken) {
  console.error("✗ Faltan en .env: GOOGLE_ADS_CLIENT_ID, GOOGLE_ADS_CLIENT_SECRET y GOOGLE_ADS_DEVELOPER_TOKEN (docs/CONEXION_GOOGLE_ADS.md).");
  process.exit(1);
}
const PUERTO = 53682;
const redirect = `http://127.0.0.1:${PUERTO}`;
const url = `https://accounts.google.com/o/oauth2/v2/auth?${new URLSearchParams({ client_id: clientId, redirect_uri: redirect, response_type: "code", scope: "https://www.googleapis.com/auth/adwords", access_type: "offline", prompt: "consent" }).toString()}`;

const servidor = createServer(async (req, res) => {
  const code = new URL(req.url ?? "/", redirect).searchParams.get("code");
  if (!code) {
    res.end("Sin código. Vuelve a la terminal.");
    return;
  }
  res.end("Listo. Ya puedes cerrar esta pestaña y volver a la terminal.");
  servidor.close();
  try {
    const r = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ code, client_id: clientId, client_secret: clientSecret, redirect_uri: redirect, grant_type: "authorization_code" }).toString() });
    const json = (await r.json()) as { refresh_token?: string; access_token?: string; error_description?: string };
    if (!json.refresh_token || !json.access_token) throw new Error(json.error_description ?? "Google no devolvió el token de actualización (repite y acepta todos los permisos).");
    guardarEnEnv({ GOOGLE_ADS_REFRESH_TOKEN: json.refresh_token });
    console.log("✓ Permiso de Google guardado en .env.");
    const cuentas = await cuentasAccesibles({ developerToken, clientId, clientSecret, refreshToken: json.refresh_token }, json.access_token);
    if (cuentas.length === 1) {
      guardarEnEnv({ GOOGLE_ADS_CUSTOMER_ID: cuentas[0]! });
      console.log(`✓ Cuenta de Google Ads: ${cuentas[0]}. Ahora: npm run googleads:sincronizar -- --dias 90`);
    } else {
      console.log(cuentas.length ? `Cuentas a las que tienes acceso: ${cuentas.join(", ")}. Pon la de la clínica en .env como GOOGLE_ADS_CUSTOMER_ID (y, si entras por una cuenta administradora, su id en GOOGLE_ADS_LOGIN_CUSTOMER_ID).` : "Google no listó cuentas: el token de desarrollador puede estar aún en modo prueba (docs/CONEXION_GOOGLE_ADS.md).");
    }
  } catch (e) {
    console.error(`✗ ${e instanceof Error ? e.message : String(e)}`);
    process.exit(1);
  }
});
servidor.listen(PUERTO, "127.0.0.1", () => {
  console.log("Abre este enlace en el navegador, entra con el Google que administra Google Ads de la clínica y acepta:\n\n" + url + "\n\nEsperando…");
});
