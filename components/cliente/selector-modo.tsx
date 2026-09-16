'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'

/** Los dos mundos del panel: la pauta (todo lo que se paga) y el orgánico (lo que se publica sin pagar). */
export const MODOS = [
  { id: 'pauta', nombre: 'Pauta', detalle: 'Anuncios que se pagan', a: '/panel' },
  { id: 'organico', nombre: 'Orgánico', detalle: 'Instagram y Facebook sin pagar', a: '/organico' },
] as const
export type Modo = (typeof MODOS)[number]['id']
export const modoDeRuta = (ruta: string): Modo => (ruta.startsWith('/organico') ? 'organico' : 'pauta')

/**
 * DESPLEGABLE DE MODO bajo el nombre ORÁCULO: Pauta / Orgánico. Es navegación (no cookie): cada
 * modo tiene su pantalla de entrada. Teclado y cierre al pulsar fuera, como los demás selectores.
 */
export default function SelectorModo({ claro = false }: { claro?: boolean }) {
  const ruta = usePathname()
  const actual = MODOS.find((m) => m.id === modoDeRuta(ruta))!
  const [abierto, setAbierto] = useState(false)
  const raiz = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!abierto) return
    const fuera = (e: MouseEvent) => { if (!raiz.current?.contains(e.target as Node)) setAbierto(false) }
    document.addEventListener('mousedown', fuera)
    return () => document.removeEventListener('mousedown', fuera)
  }, [abierto])
  return (
    <div ref={raiz} className="relative">
      <button type="button" aria-haspopup="listbox" aria-expanded={abierto} onClick={() => setAbierto((v) => !v)} onKeyDown={(e) => e.key === 'Escape' && setAbierto(false)} className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11.5px] font-semibold ring-1 transition-colors ${claro ? 'bg-superficie-2 text-texto ring-borde hover:bg-hielo' : 'bg-white/10 text-white ring-white/15 hover:bg-white/15'}`}>
        {actual.nombre}
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true"><path d={abierto ? 'M6 15l6-6 6 6' : 'M6 9l6 6 6-6'} /></svg>
      </button>
      {abierto && (
        <ul role="listbox" aria-label="Modo del panel" className="absolute left-0 top-[calc(100%+6px)] z-40 w-[220px] overflow-hidden rounded-[14px] bg-white p-1 text-texto shadow-xl ring-1 ring-borde">
          {MODOS.map((m) => (
            <li key={m.id} role="option" aria-selected={m.id === actual.id}>
              <Link href={m.a} onClick={() => setAbierto(false)} className={`block rounded-[10px] px-3 py-2 ${m.id === actual.id ? 'bg-acento/[0.08]' : 'hover:bg-superficie-2'}`}>
                <span className="block text-[13px] font-medium">{m.nombre}</span>
                <span className="block text-[11.5px] text-texto-2">{m.detalle}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
