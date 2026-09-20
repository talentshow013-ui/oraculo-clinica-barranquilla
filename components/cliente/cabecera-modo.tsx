'use client'
import { usePathname } from 'next/navigation'
import type { ReactNode } from 'react'
import { modoDeRuta } from './selector-modo'

/**
 * La cabecera cambia de mundo con el desplegable: en Pauta muestra cuenta, campaña y plata en
 * riesgo; en Orgánico y Google esos controles no aplican y se muestra, en su lugar, lo que se está
 * mirando (redes conectadas / sitio web) y el periodo. Y el FONDO de la barra cambia con el mundo
 * (blanco · violeta pálido · verde-azul pálido), igual que el riel. Es un client component solo
 * para leer la ruta; la barra entera vive aquí para poder pintarla según el modo.
 */
const FONDO = {
  pauta: 'bg-superficie/92',
  organico: 'bg-hielo-org/92',
  google: 'bg-hielo-goo/92',
} as const

export default function CabeceraModo({ menu, pauta, organico, google }: { menu: ReactNode; pauta: ReactNode; organico: ReactNode; google: ReactNode }) {
  const modo = modoDeRuta(usePathname())
  return (
    <header className={`no-imprimir sticky top-0 z-30 border-b border-borde backdrop-blur-md transition-colors duration-500 ${FONDO[modo]}`} data-modo={modo}>
      <div className="mx-auto flex h-[60px] max-w-[1400px] items-center gap-3 px-4 sm:px-6">
        {menu}
        {modo === 'organico' ? organico : modo === 'google' ? google : pauta}
      </div>
    </header>
  )
}
