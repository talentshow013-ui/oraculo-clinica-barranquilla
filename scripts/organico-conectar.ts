/**
 * Conecta el orgánico UNA vez: toma un token de Facebook, lo vuelve de larga duración (si hay
 * META_APP_ID y META_APP_SECRET en .env), busca la página de la clínica y su Instagram, y guarda
 * en `.env` el token DE PÁGINA (no caduca) con los dos ids. Nada se escribe en el repositorio.
 *
 *   npm run organico:conectar -- <token>                 → si hay una sola página, la toma
 *   npm run organico:conectar -- <token> --pagina <id>   → si hay varias
 *
 * De dónde sale el token: developers.facebook.com/tools/explorer → app «VIVANTE CLAUDE» →
 * permisos pages_show_list, pages_read_engagement, read_insights, instagram_basic,
 * instagram_manage_insights, business_management → «Generar token» con el Facebook que administra
 * la página. Detalle en docs/CONEXION_ORGANICO.md.
 */
import { cargarEnv, guardarEnEnv } from "@/lib/adapters/env";
import { VERSION_GRAPH } from "@/lib/adapters/organico.graph";

cargarEnv();
const token = process.argv[2];
if (!token || token.startsWith("--")) {
  console.error("Uso: npm run organico:conectar -- <token> [--pagina <id>]");
  process.exit(1);
}
const iPag = process.argv.indexOf("--pagina");
const paginaPedida = iPag >= 0 ? process.argv[iPag + 1] : undefined;

async function graph(ruta: string, params: Record<string, string>): Promise<Record<string, unknown>> {
  const q = new URLSearchParams(params);
  const r = await fetch(`https://graph.facebook.com/${VERSION_GRAPH}/${ruta}?${q.toString()}`);
  const json = (await r.json()) as { error?: { message?: string; code?: number } } & Record<string, unknown>;
  if (json.error) throw new Error(`Meta respondió: ${json.error.message ?? "error"} (código ${json.error.code ?? "?"})`);
  return json;
}

async function main() {
  let tokenUsuario = token!;
  const appId = process.env.META_APP_ID;
  const secreto = process.env.META_APP_SECRET;
  if (appId && secreto) {
    const r = await graph("oauth/access_token", { grant_type: "fb_exchange_token", client_id: appId, client_secret: secreto, fb_exchange_token: tokenUsuario });
    tokenUsuario = String(r.access_token);
    console.log("✓ Token de usuario extendido a larga duración.");
  } else {
    console.log("· Sin META_APP_ID/META_APP_SECRET en .env: se usa el token tal cual (extiéndelo en developers.facebook.com/tools/debug/accesstoken antes de pegarlo).");
  }

  const yo = await graph("me", { fields: "id,name", access_token: tokenUsuario });
  console.log(`✓ Sesión de Facebook válida (${String(yo.name)}).`);

  const cuentas = (await graph("me/accounts", { fields: "id,name,access_token,instagram_business_account{id,username}", limit: "50", access_token: tokenUsuario })) as { data?: Array<{ id: string; name: string; access_token: string; instagram_business_account?: { id: string; username: string } }> };
  const paginas = cuentas.data ?? [];
  if (!paginas.length) {
    console.error("✗ Ese Facebook no administra ninguna página. Hay que generar el token con el Facebook que administra la página de la clínica.");
    process.exit(1);
  }
  const pagina = paginaPedida ? paginas.find((p) => p.id === paginaPedida) : paginas.length === 1 ? paginas[0] : undefined;
  if (!pagina) {
    console.log("Hay varias páginas; repite con --pagina <id>:");
    for (const p of paginas) console.log(`  ${p.id}  ${p.name}${p.instagram_business_account ? `  · Instagram @${p.instagram_business_account.username}` : "  · sin Instagram vinculado"}`);
    process.exit(1);
  }
  const ig = pagina.instagram_business_account ?? null;
  console.log(`✓ Página: ${pagina.name} (${pagina.id})`);
  console.log(ig ? `✓ Instagram: @${ig.username} (${ig.id})` : "· La página no tiene un Instagram profesional vinculado: solo se traerá Facebook. (Se vincula en Meta Business Suite → Configuración → Instagram.)");

  guardarEnEnv({ META_ORGANICO_TOKEN: pagina.access_token, META_PAGINA_ID: pagina.id, META_INSTAGRAM_ID: ig?.id ?? "" });
  console.log("✓ Guardado en .env (META_ORGANICO_TOKEN, META_PAGINA_ID, META_INSTAGRAM_ID). Ahora: npm run organico:sincronizar");
}

main().catch((e) => {
  console.error(`✗ ${e instanceof Error ? e.message : String(e)}`);
  process.exit(1);
});
