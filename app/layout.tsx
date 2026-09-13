import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Oráculo · Panel',
  description: 'Inteligencia de marketing de la clínica: dónde se pierde la plata y qué hacer.',
  robots: { index: false, follow: false },
  icons: { icon: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='9' fill='%230B1D3A'/%3E%3Ccircle cx='16' cy='16' r='7' fill='none' stroke='%2393C5FD' stroke-width='2.2'/%3E%3Ccircle cx='16' cy='16' r='2.4' fill='%232563EB'/%3E%3C/svg%3E" },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <head>
        <link rel="preload" href="/fuentes/geist.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
      </head>
      <body>{children}</body>
    </html>
  )
}
