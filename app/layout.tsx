import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Oráculo · Inteligencia de marketing",
  description: "Panel de decisiones para la clínica",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es-CO">
      <body className="min-h-screen bg-fondo text-texto">{children}</body>
    </html>
  );
}
