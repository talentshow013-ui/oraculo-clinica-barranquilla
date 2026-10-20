/**
 * Leer las conversaciones de WhatsApp (webhook de Kommo) para analizarlas: «revisa las de ayer»,
 * «las que vienen de este anuncio», «las que no terminaron en cita». Guardadas desde el 15-oct-2026,
 * solo 30 días, sin teléfonos ni nombres de contacto.
 *
 *   npm run chats -- --ayer
 *   npm run chats -- --hoy
 *   npm run chats -- --fecha 2026-10-16            (o --desde X --hasta Y)
 *   npm run chats -- --ayer --anuncio "Criolipolisis"         (nombre de anuncio o campaña, o el mensaje predeterminado pegado tal cual)
 *   npm run chats -- --ayer --asesora "Laura"
 *   npm run chats -- --ayer --resultado cita | venta | sin-cita
 *   npm run chats -- --ayer --sin-respuesta
 *   npm run chats -- --desde 2026-10-18 --hasta 2026-10-20 --buscar "precio"          (solo las que contienen ese texto; se repite)
 *   npm run chats -- --ayer --excluir "lo que digas importa" --excluir "0391"          (quita las que lo contienen; se repite)
 *   npm run chats -- --ayer --sin-difusion                    (solo las que empezó la persona: fuera difusiones y chats que abrió la clínica)
 *   npm run chats -- --ayer --contar                          (solo los números, sin el texto)
 *   npm run chats -- --ayer --max 100                         (por defecto TODAS)
 *
 * En la VPS los lee del disco; en otro equipo los pide a la VPS con la clave del panel
 * (VPS_PANEL_USUARIO / VPS_PANEL_CLAVE). Para analizar: resume y saca patrones; no copies a
 * ningún archivo ni respuesta nombres, teléfonos o datos de salud de una persona.
 */
import { cargarEnv } from "@/lib/adapters/env";
import { conversacionesLegibles } from "@/lib/conversaciones";
import { hoyBogota, sumarDias } from "@/lib/format/fechas";

cargarEnv();
const e = process.env;
const arg = (n: string) => {
  const i = process.argv.indexOf(n);
  return i >= 0 ? process.argv[i + 1] : undefined;
};
const tiene = (n: string) => process.argv.includes(n);

async function main() {
  const hoy = hoyBogota();
  let desde = hoy;
  let hasta = hoy;
  if (tiene("--ayer")) desde = hasta = sumarDias(hoy, -1);
  if (arg("--fecha")) desde = hasta = arg("--fecha")!;
  if (arg("--desde")) desde = arg("--desde")!;
  if (arg("--hasta")) hasta = arg("--hasta")!;
  if (arg("--dias")) desde = sumarDias(hoy, -(Number(arg("--dias")) || 1) + 1);
  const resultado = arg("--resultado") as "cita" | "venta" | "sin-cita" | undefined;
  const max = Number(arg("--max")) || undefined;
  const todos = (n: string) => process.argv.flatMap((x, i, t) => (t[i - 1] === n ? [x] : []));
  const filtro = { texto: arg("--anuncio"), asesora: arg("--asesora"), resultado, sinRespuesta: tiene("--sin-respuesta"), escribioPrimero: tiene("--sin-difusion"), buscar: todos("--buscar"), excluir: todos("--excluir") };

  let r = tiene("--remoto") ? null : conversacionesLegibles({ desde, hasta, filtro, max });
  let deVps = false;
  if (!r) {
    const usuario = e.ORACULO_USUARIO?.trim() || e.VPS_PANEL_USUARIO?.trim();
    const clave = e.ORACULO_CLAVE?.trim() || e.VPS_PANEL_CLAVE?.trim();
    if (!usuario || !clave) throw new Error("Las conversaciones viven en la VPS y aquí falta con qué pedirlas: agrega VPS_PANEL_USUARIO y VPS_PANEL_CLAVE (usuario y clave del panel) al .env.");
    let origen = "https://oraculo.vivantemedicinaestetica.com";
    try {
      if (e.ORACULO_URL_PANEL) origen = new URL(e.ORACULO_URL_PANEL).origin;
    } catch {}
    const q = new URLSearchParams({ desde, hasta });
    if (max) q.set("max", String(max));
    for (const b of filtro.buscar) q.append("buscar", b);
    for (const x of filtro.excluir) q.append("excluir", x);
    if (filtro.texto) q.set("anuncio", filtro.texto);
    if (filtro.asesora) q.set("asesora", filtro.asesora);
    if (resultado) q.set("resultado", resultado);
    if (filtro.sinRespuesta) q.set("sin-respuesta", "1");
    if (filtro.escribioPrimero) q.set("sin-difusion", "1");
    const res = await fetch(`${origen}/api/chats?${q}`, { headers: { authorization: `Basic ${Buffer.from(`${usuario}:${clave}`).toString("base64")}` } });
    if (res.status === 401) throw new Error("La VPS no aceptó el usuario y clave del panel (VPS_PANEL_USUARIO / VPS_PANEL_CLAVE).");
    if (!res.ok) throw new Error(`La VPS respondió ${res.status}.`);
    const j = (await res.json()) as { total: number; mostradas: number; texto: string } | { vacio: true };
    if ("vacio" in j) {
      console.log("La VPS todavía no tiene texto de conversaciones guardado.");
      return;
    }
    r = j;
    deVps = true;
  }
  console.log(`Conversaciones de WhatsApp · ${desde === hasta ? desde : `${desde} → ${hasta}`}${filtro.texto ? ` · anuncio «${filtro.texto}»` : ""}${filtro.asesora ? ` · asesora ${filtro.asesora}` : ""}${resultado ? ` · resultado ${resultado}` : ""}${filtro.sinRespuesta ? " · sin respuesta" : ""}${filtro.escribioPrimero ? " · sin difusiones (las empezó la persona)" : ""}${filtro.buscar.length ? ` · con «${filtro.buscar.join("» y «")}»` : ""}${filtro.excluir.length ? ` · sin «${filtro.excluir.join("», «")}»` : ""}${deVps ? " (de la VPS)" : ""}`);
  console.log(`${r.total} conversaciones${r.mostradas < r.total ? ` · se muestran las últimas ${r.mostradas}` : ""}. Fuente: webhook de Kommo (texto completo guardado desde el 15-oct-2026).\n`);
  if (!tiene("--contar")) console.log(r.texto || "(ninguna con ese filtro)");
}

main().catch((err) => {
  console.error(`✗ ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
