import { NextResponse, type NextRequest } from "next/server";
import { autorizar, cabeceraDesafio } from "@/lib/acceso";

/**
 * Candado del panel en internet. Con ORACULO_USUARIO y ORACULO_CLAVE definidos (VPS), el navegador
 * pide usuario y clave una vez y las recuerda. Sin ellos (PC local), no molesta.
 * Cloudflare Access puede ir por delante como segunda puerta; este candado es el respaldo.
 */
export function middleware(req: NextRequest) {
  const decision = autorizar(req.headers.get("authorization"), {
    usuario: process.env.ORACULO_USUARIO,
    clave: process.env.ORACULO_CLAVE,
  });
  if (decision === "pedir") {
    return new NextResponse("Este panel es privado. Ingresa usuario y clave.", {
      status: 401,
      headers: { "WWW-Authenticate": cabeceraDesafio(), "Content-Type": "text/plain; charset=utf-8" },
    });
  }
  return NextResponse.next();
}

export const config = {
  // Todo menos los archivos estáticos de Next y los creativos del radar (imágenes públicas de la Biblioteca).
  matcher: ["/((?!_next/static|_next/image|favicon.ico|radar/).*)"],
};
