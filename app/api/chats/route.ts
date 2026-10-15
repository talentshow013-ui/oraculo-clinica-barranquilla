/**
 * El texto de las conversaciones de WhatsApp para `npm run chats` en otros equipos (el PC de la clínica):
 * vive solo en la VPS. Detrás del usuario y clave del panel. Sin teléfonos ni nombres de contacto.
 *   GET /api/chats?desde=&hasta=&anuncio=&asesora=&resultado=cita|venta|sin-cita&sin-respuesta=1&max=40
 */
import { conversacionesLegibles } from "@/lib/conversaciones";
import { hoyBogota } from "@/lib/format/fechas";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const FECHA = /^\d{4}-\d{2}-\d{2}$/;

export function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  const hoy = hoyBogota();
  const hasta = FECHA.test(q.get("hasta") ?? "") ? q.get("hasta")! : hoy;
  const desde = FECHA.test(q.get("desde") ?? "") ? q.get("desde")! : hasta;
  const resultado = q.get("resultado");
  const r = conversacionesLegibles({
    desde,
    hasta,
    max: Math.min(500, Math.max(1, Number(q.get("max")) || 40)),
    filtro: {
      texto: q.get("anuncio") || undefined,
      asesora: q.get("asesora") || undefined,
      resultado: resultado === "cita" || resultado === "venta" || resultado === "sin-cita" ? resultado : undefined,
      sinRespuesta: q.get("sin-respuesta") === "1",
    },
  });
  return Response.json(r ?? { vacio: true });
}
