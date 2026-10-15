/**
 * Resumen de las conversaciones de WhatsApp (webhook de Kommo) para `npm run conversaciones` en otros
 * equipos (el PC de la clínica): los datos viven en la VPS. Detrás del usuario y clave del panel.
 * Solo conteos y tiempos; nunca texto ni datos de pacientes.
 *   GET /api/conversaciones?desde=AAAA-MM-DD&hasta=AAAA-MM-DD
 */
import { resumenWhatsapp } from "@/lib/conversaciones";
import { hoyBogota, sumarDias } from "@/lib/format/fechas";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const FECHA = /^\d{4}-\d{2}-\d{2}$/;

export function GET(req: Request) {
  const u = new URL(req.url);
  const hoy = hoyBogota();
  const hasta = FECHA.test(u.searchParams.get("hasta") ?? "") ? u.searchParams.get("hasta")! : hoy;
  const desde = FECHA.test(u.searchParams.get("desde") ?? "") ? u.searchParams.get("desde")! : sumarDias(hasta, -6);
  const r = resumenWhatsapp({ desde, hasta });
  return Response.json(r ?? { vacio: true, desde, hasta });
}
