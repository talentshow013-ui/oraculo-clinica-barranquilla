/**
 * Dirección que recibe los avisos de Kommo (webhook): cada mensaje de WhatsApp que entra o sale.
 * https://oraculo.vivantemedicinaestetica.com/api/kommo/webhook/<KOMMO_WEBHOOK_SECRETO>
 * De cada mensaje se saca el anuncio y la hora (lib/adapters/kommo.webhook.ts); el texto se guarda solo si
 * hay CHATS_LLAVE: cifrado, sin teléfonos ni correos, 30 días (lib/adapters/chats.ts).
 * Kommo exige respuesta 2xx en menos de 2 s; un error nuestro devuelve 500 para que reintente.
 * Esta ruta no está detrás del usuario y clave del panel (Kommo no puede ponerlos): la protege el
 * secreto de la dirección. Sin KOMMO_WEBHOOK_SECRETO configurado responde 404 y no hace nada.
 */
import { dirname, join } from "node:path";
import { RUTA_CONVERSACIONES } from "@/lib/adapters/conversaciones.archivo";
import { anunciosConMensaje, procesarAviso, secretoValido } from "@/lib/adapters/kommo.webhook";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const NO = () => new Response("no encontrado", { status: 404 });
type Contexto = { params: Promise<{ secreto: string }> };

export async function GET(_req: Request, { params }: Contexto) {
  const { secreto } = await params;
  return secretoValido(secreto, process.env.KOMMO_WEBHOOK_SECRETO) ? Response.json({ ok: true }) : NO();
}

export async function POST(req: Request, { params }: Contexto) {
  const { secreto } = await params;
  const esperado = process.env.KOMMO_WEBHOOK_SECRETO;
  if (!esperado || !secretoValido(secreto, esperado)) return NO();
  try {
    const cuerpo = (await req.text()).slice(0, 262_144);
    const r = await procesarAviso({
      contentType: req.headers.get("content-type"),
      cuerpo,
      ruta: RUTA_CONVERSACIONES,
      secreto: esperado,
      subdominio: process.env.KOMMO_SUBDOMINIO ?? null,
      anuncios: anunciosConMensaje(),
      prueba: req.headers.get("x-oraculo-prueba") === "1",
      /* el texto (cifrado, sin teléfonos, 30 días) solo si hay CHATS_LLAVE: así se pueden leer y analizar las conversaciones */
      chats: /^[0-9a-f]{64}$/i.test(process.env.CHATS_LLAVE ?? "") ? { dir: join(dirname(RUTA_CONVERSACIONES), "chats"), llave: process.env.CHATS_LLAVE! } : undefined,
    });
    return Response.json({ ok: true, ...r });
  } catch {
    // sin detalles en la respuesta ni en el registro: el aviso trae datos de pacientes
    return new Response("error", { status: 500 });
  }
}
