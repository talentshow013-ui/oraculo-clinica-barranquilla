/**
 * Google Ads · ver y EDITAR campañas (presupuesto diario, pausar, activar), directo por la API.
 *
 *   npm run google -- campanas                                              → todas, con estado y presupuesto
 *   npm run google -- presupuesto --campana "Facial" --diario 50000         → muestra el cambio y NO cambia nada
 *   npm run google -- pausar  --campana "Corporal"                          → ídem
 *   npm run google -- activar --campana "24313804767"                       → ídem (también por id)
 *   … --confirmar                                                           → lo aplica (solo tras el «sí» de una persona)
 *
 * Siempre valida primero con Google sin aplicar (validateOnly). Con --confirmar aplica, vuelve a leer la
 * campaña para comprobar y lo anota en datos/experimentos.json. Las llaves viven en la configuración local
 * y no se imprimen.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { cargarEnv } from "@/lib/adapters/env";
import { crearConsultaGoogle, tokenDeAcceso, type CredencialesGoogleAds } from "@/lib/adapters/google.ads";
import { GAQL_CAMPANAS, cuerpoEstado, cuerpoPresupuesto, mapearCampanas, mutarGoogle, resolverCampana, type CampanaGoogle } from "@/lib/adapters/google.ads.editar";

cargarEnv();
const e = process.env;
const arg = (n: string) => {
  const i = process.argv.indexOf(n);
  return i >= 0 ? process.argv[i + 1] : undefined;
};
const accion = process.argv.slice(2).find((x) => !x.startsWith("--") && ["campanas", "presupuesto", "pausar", "activar"].includes(x)) ?? "campanas";
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
