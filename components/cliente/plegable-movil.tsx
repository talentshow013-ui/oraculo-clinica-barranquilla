'use client'
import { useEffect, useState, type ReactNode } from 'react'
import Plegable from './plegable'

/**
 * En pantallas chicas (< 768 px) la tarjeta se pliega y solo se ve la cabecera; en escritorio se
 * muestra entera. Se decide con `matchMedia` al montar (no con un `hidden md:block` duplicado:
 * eso deja el texto dos veces en el DOM). Del lado del servidor se pinta abierta.
 */
export default function PlegableEnMovil({ cabecera, children, className = '' }: { cabecera: ReactNode; children: ReactNode; className?: string }) {
  const [movil, setMovil] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)')
    const leer = () => setMovil(mq.matches)
    leer()
    mq.addEventListener('change', leer)
    return () => mq.removeEventListener('change', leer)
  }, [])
  if (!movil) {
    return (
      <div className={className}>
        {cabecera}
        {children}
      </div>
    )
  }
  return <Plegable cabecera={cabecera} className={className}>{children}</Plegable>
}
