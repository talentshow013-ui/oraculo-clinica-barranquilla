'use client'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

/**
 * Sobre-mensaje que SÍ se ve: se pinta en un portal al final del <body>, con posición fija y
 * z-index alto, así nunca queda debajo de la tarjeta vecina ni lo recorta un overflow. Sale al
 * pasar el mouse o al enfocar con teclado; se coloca debajo de la tarjeta, o encima si no cabe.
 */
export default function Ayuda({ titulo, texto, children, className = '' }: { titulo?: string; texto: string; children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ x: number; y: number; arriba: boolean } | null>(null)
  const mostrar = () => {
    const r = ref.current?.getBoundingClientRect()
    if (!r) return
    const arriba = window.innerHeight - r.bottom < 120
    setPos({ x: Math.min(Math.max(8, r.left), window.innerWidth - 308), y: arriba ? r.top - 8 : r.bottom + 8, arriba })
  }
  const ocultar = () => setPos(null)
  useEffect(() => {
    if (!pos) return
    window.addEventListener('scroll', ocultar, { passive: true })
    return () => window.removeEventListener('scroll', ocultar)
  }, [pos])
  return (
    <div ref={ref} className={className} onMouseEnter={mostrar} onMouseLeave={ocultar} onFocus={mostrar} onBlur={ocultar} tabIndex={0} aria-describedby={undefined}>
      {children}
      {pos && typeof document !== 'undefined' && createPortal(
        <div role="tooltip" className="ayuda" style={{ left: pos.x, top: pos.y, transform: pos.arriba ? 'translateY(-100%)' : undefined }}>
          {titulo && <b>{titulo}</b>}
          {texto}
        </div>,
        document.body,
      )}
    </div>
  )
}
