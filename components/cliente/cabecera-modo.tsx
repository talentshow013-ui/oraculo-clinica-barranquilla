'use client'
import { usePathname } from 'next/navigation'
import type { ReactNode } from 'react'
import { modoDeRuta } from './selector-modo'

/**
 * La cabecera cambia de mundo con el desplegable: en Pauta muestra cuenta, campaña y plata en
 * riesgo; en Orgánico y Google esos controles no aplican y se muestra, en su lugar, lo que se está
 * mirando (redes conectadas / sitio web) y el periodo. Es un client component solo para leer la ruta.
 */
export default function CabeceraModo({ pauta, organico, google }: { pauta: ReactNode; organico: ReactNode; google: ReactNode }) {
  const modo = modoDeRuta(usePathname())
  return <>{modo === 'organico' ? organico : modo === 'google' ? google : pauta}</>
}
