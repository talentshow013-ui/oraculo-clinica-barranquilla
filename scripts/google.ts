/**
 * Google Ads · ver y EDITAR campañas (presupuesto diario, pausar, activar), directo por la API.
 *
 *   npm run google -- campanas                                              → todas, con estado y presupuesto
 *   npm run google -- presupuesto --campana "Facial" --diario 50000         → muestra el cambio y NO cambia nada
 *   npm run google -- pausar  --campana "Corporal"                          → ídem
 *   npm run google -- activar --campana "24313804767"                       → ídem (también por id)
 *   … --confirmar                                                           → lo aplica (solo tras el «sí» de una persona)
 *
 * CUALQUIER otra cosa (crear campañas, grupos, anuncios, palabras clave, negativas, pujas, extensiones…):
 *   npm run google -- consulta "SELECT campaign.id, campaign.name FROM campaign"            → leer lo que sea (GAQL)
 *   npm run google -- mutar campaigns '{"operations":[{"update":{…},"updateMask":"…"}]}'    → valida y NO aplica
 *   … --confirmar                                                                           → aplica
 *   (servicio = campaigns, adGroups, adGroupAds, adGroupCriteria, campaignCriteria, campaignBudgets, assets…;
 *    el JSON es el cuerpo del :mutate de la API de Google Ads; también se puede pasar --cuerpo ruta.json)
 *
 * Siempre valida primero con Google sin aplicar (validateOnly). Con --confirmar aplica, vuelve a leer la
 * campaña para comprobar y lo anota en datos/experimentos.json. Las llaves viven en la configuración local
 * y no se imprimen.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { cargarEnv } from "@/lib/adapters/env";
import { VERSION_GOOGLE_ADS, crearConsultaGoogle, tokenDeAcceso, type CredencialesGoogleAds } from "@/lib/adapters/google.ads";
import { GAQL_CAMPANAS, cuerpoEstado, cuerpoPresupuesto, mapearCampanas, mutarGoogle, resolverCampana, type CampanaGoogle } from "@/lib/adapters/google.ads.editar";

cargarEnv();
const e = process.env;
const arg = (n: string) => {
  const i = process.argv.indexOf(n);
  return i >= 0 ? process.argv[i + 1] : undefined;
};
const accion = process.argv.slice(2).find((x) => !x.startsWith("--") && ["campanas", "presupuesto", "pausar", "activar", "consulta", "mutar"].includes(x)) ?? "campanas";
const confirmar = process.argv.includes("--confirmar");
const pesos = (n: number) => `$ ${n.toLocaleString("es-CO")}`;
const ESTADO: Record<string, string> = { ENABLED: "activa", PAUSED: "pausada" };

function anotar(registro: Record<string, unknown>) {
  const ruta = "datos/experimentos.json";
  let lista: unknown[] = [];
  try {
    if (existsSync(ruta)) lista = JSON.parse(readFileSync(ruta, "utf8"));
  } catch {}
  lista.push({ fecha: new Date().toISOString(), plataforma: "google", fuente: "npm run google", ...registro });
  writeFileSync(ruta, JSON.stringify(lista, null, 2));
}

async function main() {
  if (!e.GOOGLE_ADS_DEVELOPER_TOKEN || !e.GOOGLE_ADS_REFRESH_TOKEN || !e.GOOGLE_ADS_CUSTOMER_ID) throw new Error("Falta la conexión de Google Ads (GOOGLE_ADS_*). Ver docs o npm run googleads:conectar.");
  const c: CredencialesGoogleAds = { developerToken: e.GOOGLE_ADS_DEVELOPER_TOKEN, clientId: e.GOOGLE_ADS_CLIENT_ID!, clientSecret: e.GOOGLE_ADS_CLIENT_SECRET!, refreshToken: e.GOOGLE_ADS_REFRESH_TOKEN, loginCustomerId: e.GOOGLE_ADS_LOGIN_CUSTOMER_ID || undefined };
  const cid = e.GOOGLE_ADS_CUSTOMER_ID.replace(/-/g, "");
  const at = await tokenDeAcceso(c);
  const leer = async () => mapearCampanas(await crearConsultaGoogle(c, cid, at)(GAQL_CAMPANAS));
  const cab: Record<string, string> = { authorization: `Bearer ${at}`, "developer-token": c.developerToken, "content-type": "application/json" };
  if (c.loginCustomerId) cab["login-customer-id"] = c.loginCustomerId.replace(/-/g, "");

  if (accion === "consulta") {
    const gaql = process.argv[process.argv.indexOf("consulta") + 1];
    if (!gaql || gaql.startsWith("--")) throw new Error('Uso: npm run google -- consulta "SELECT … FROM …"');
    console.log(JSON.stringify(await crearConsultaGoogle(c, cid, at)(gaql), null, 2));
    return;
  }
  if (accion === "mutar") {
    const i = process.argv.indexOf("mutar");
    const servicio = process.argv[i + 1];
    const crudo = arg("--cuerpo") ? readFileSync(arg("--cuerpo")!, "utf8") : process.argv[i + 2];
    if (!servicio || servicio.startsWith("--") || !crudo) throw new Error("Uso: npm run google -- mutar <servicio> '<json>' [--confirmar]   (o --cuerpo ruta.json)");
    const cuerpo = JSON.parse(crudo) as Record<string, unknown>;
    const url = `https://googleads.googleapis.com/${VERSION_GOOGLE_ADS}/customers/${cid}/${servicio}:mutate`;
    const enviar = async (validar: boolean) => {
      const r = await fetch(url, { method: "POST", headers: cab, body: JSON.stringify({ ...cuerpo, validateOnly: validar }) });
      const t = await r.text();
      if (!r.ok) throw new Error(`Google Ads rechazó el cambio (${r.status}): ${t.slice(0, 1500)}`);
      return t;
    };
    await enviar(true);
    console.log(`✓ Google valida el cambio en ${servicio} (no se aplicó nada todavía).`);
    if (!confirmar) {
      console.log("NO se cambió nada. Di el cambio, espera el «sí» y repite con --confirmar.");
      return;
    }
    const resp = await enviar(false);
    anotar({ accion: `mutar ${servicio}`, cuerpo, respuesta: JSON.parse(resp || "{}") });
    console.log(`✓ Aplicado en Google Ads · respuesta: ${resp.slice(0, 1500)}\n· anotado en datos/experimentos.json. Compruébalo con: npm run google -- consulta "…"`);
    return;
  }

  const campanas = await leer();
  if (accion === "campanas") {
    console.log(`Google Ads · cuenta ${cid} · ${campanas.length} campañas (fuente: API de Google Ads)`);
    for (const x of [...campanas].sort((a, b) => a.estado.localeCompare(b.estado))) console.log(`  · ${ESTADO[x.estado] ?? x.estado} · ${x.nombre} (${x.id}) · presupuesto diario ${pesos(x.presupuestoDiario)}${x.compartido ? " · compartido" : ""}`);
    return;
  }

  const texto = arg("--campana");
  if (!texto) throw new Error('Falta --campana "<nombre o id>"');
  const k = resolverCampana(campanas, texto);
  let descripcion: string;
  let aplicar: (soloValidar: boolean) => Promise<void>;
  let comprobar: (d: CampanaGoogle) => string;
  if (accion === "presupuesto") {
    const nuevo = Number(String(arg("--diario") ?? "").replace(/[.$\s]/g, ""));
    descripcion = `presupuesto diario de «${k.nombre}»: ${pesos(k.presupuestoDiario)} → ${pesos(nuevo)}`;
    if (k.compartido) {
      const hermanas = campanas.filter((x) => x.presupuestoRecurso === k.presupuestoRecurso && x.id !== k.id).map((x) => x.nombre);
      descripcion += `\n  ⚠️ Es un presupuesto COMPARTIDO: también cambia para ${hermanas.join(", ") || "otras campañas"}.`;
    }
    aplicar = (v) => mutarGoogle(cab, cid, "campaignBudgets:mutate", cuerpoPresupuesto(k, nuevo, v));
    comprobar = (d) => `presupuesto diario ahora: ${pesos(d.presupuestoDiario)}`;
  } else {
    const estado = accion === "pausar" ? "PAUSED" : "ENABLED";
    if (k.estado === estado) {
      console.log(`«${k.nombre}» ya está ${ESTADO[estado]}. No hay nada que cambiar.`);
      return;
    }
    descripcion = `${accion === "pausar" ? "PAUSAR" : "ACTIVAR"} «${k.nombre}» (hoy ${ESTADO[k.estado] ?? k.estado}, presupuesto diario ${pesos(k.presupuestoDiario)})`;
    aplicar = (v) => mutarGoogle(cab, cid, "campaigns:mutate", cuerpoEstado(cid, k, estado, v));
    comprobar = (d) => `estado ahora: ${ESTADO[d.estado] ?? d.estado}`;
  }

  console.log(`Google Ads · cambio pedido: ${descripcion}`);
  await aplicar(true);
  console.log("✓ Google lo valida (no se aplicó nada todavía).");
  if (!confirmar) {
    console.log("\nNO se cambió nada. Es un cambio real en Google Ads: di qué vas a cambiar, espera el «sí» de la persona y repite el comando con --confirmar.");
    return;
  }
  await aplicar(false);
  const despues = (await leer()).find((x) => x.id === k.id)!;
  anotar({ accion, campana: k.nombre, campanaId: k.id, antes: { estado: k.estado, presupuestoDiario: k.presupuestoDiario }, despues: { estado: despues.estado, presupuestoDiario: despues.presupuestoDiario } });
  console.log(`✓ Aplicado y comprobado en Google Ads · ${comprobar(despues)} · anotado en datos/experimentos.json`);
}

main().catch((err) => {
  console.error(`✗ ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
