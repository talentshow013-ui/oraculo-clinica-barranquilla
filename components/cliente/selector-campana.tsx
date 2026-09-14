'use client'
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { ResumenCampana } from '@/lib/tipos'

/**
 * FILTRO DE CAMPAÑA. Al lado del selector de cuenta: se elige UNA campaña y todo el panel se
 * recalcula solo con ella (sus anuncios, su embudo, sus alertas). «Todas» vuelve a la cuenta.
 * Viaja en la cookie `campana`, igual que la cuenta; el radar de mercado no cambia.
 */
export default function SelectorCampana({ campanas, actual }: { campanas: ResumenCampana[]; actual: ResumenCampana | null }) {
  const [abierto, setAbierto] = useState(false)
  const [foco, setFoco] = useState(actual ? campanas.findIndex((c) => c.id === actual.id) + 1 : 0)
  const [cambiando, setCambiando] = useState(false)
  const raiz = useRef<HTMLDivElement>(null)
  const router = useRouter()
  const opciones: (ResumenCampana | null)[] = [null, ...campanas]

  useEffect(() => {
    if (!abierto) return
    const fuera = (e: MouseEvent) => {
      if (!raiz.current?.contains(e.target as Node)) setAbierto(false)
    }
    document.addEventListener('mousedown', fuera)
    return () => document.removeEventListener('mousedown', fuera)
  }, [abierto])

  function elegir(c: ResumenCampana | null) {
    setAbierto(false)
    if ((c?.id ?? '') === (actual?.id ?? '')) return
    setCambiando(true)
    document.cookie = c ? `campana=${encodeURIComponent(c.id)}; path=/; max-age=31536000; samesite=lax` : 'campana=; path=/; max-age=0; samesite=lax'
    router.refresh()
    setTimeout(() => setCambiando(false), 1200)
  }
  function teclas(e: React.KeyboardEvent) {
    if (e.key === 'Escape') setAbierto(false)
    if (e.key === 'ArrowDown') { e.preventDefault(); setAbierto(true); setFoco((f) => Math.min(opciones.length - 1, f + 1)) }
    if (e.key === 'ArrowUp') { e.preventDefault(); setFoco((f) => Math.max(0, f - 1)) }
    if (e.key === 'Enter' && abierto) { e.preventDefault(); elegir(opciones[foco] ?? null) }
  }
  const etiqueta = actual ? actual.nombre : 'Todas las campañas'

  return (
    <div ref={raiz} className="relative min-w-0" onKeyDown={teclas}>
      <button type="button" aria-haspopup="listbox" aria-expanded={abierto} aria-label={`Campaña: ${etiqueta}. Cambiar`} onClick={() => setAbierto((v) => !v)} className={`group flex items-center gap-2 rounded-full py-1 pl-3 pr-2.5 text-left ring-1 transition-[box-shadow,background-color] duration-300 ${actual ? 'bg-acento/10 text-texto ring-acento/40 hover:bg-acento/15' : 'bg-superficie-2 text-texto-2 ring-borde hover:bg-hielo'} ${cambiando ? 'opacity-70' : ''}`}>
        <span className="leading-tight">
          <span className="hidden text-[10px] font-semibold uppercase tracking-[0.18em] text-texto-3 sm:block">Campaña</span>
          <span className="block max-w-[34vw] truncate text-[13px] font-medium sm:max-w-[260px]">{cambiando ? 'Cambiando…' : etiqueta}</span>
        </span>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" className={`ml-1 text-texto-3 transition-transform duration-300 ${abierto ? 'rotate-180' : ''}`} aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>
      </button>
      {abierto && (
        <ul role="listbox" aria-label="Campañas" className="absolute left-0 top-[calc(100%+8px)] z-50 min-w-[320px] overflow-hidden rounded-[16px] bg-superficie p-1.5 shadow-[0_24px_50px_-20px_rgba(11,29,58,0.5)] ring-1 ring-borde entra-zoom">
          {opciones.map((c, i) => {
            const activa = (c?.id ?? '') === (actual?.id ?? '')
            return (
              <li key={c?.id ?? 'todas'} role="option" aria-selected={activa} onMouseEnter={() => setFoco(i)} onClick={() => elegir(c)} className={`flex cursor-pointer items-center gap-2.5 rounded-[11px] px-2.5 py-2 transition-colors ${i === foco ? 'bg-superficie-2' : ''} ${activa ? 'text-texto' : 'text-texto-2'}`}>
                <span aria-hidden="true" className={`h-2 w-2 shrink-0 rounded-full ${c === null ? 'bg-marino' : c.alAire ? 'bg-bien' : 'bg-borde-fuerte'}`} />
                <span className="min-w-0 flex-1 leading-tight">
                  <span className="block truncate text-[13px] font-medium text-texto">{c ? c.nombre : 'Todas las campañas'}</span>
                  <span className="block text-[11px] text-texto-3">{c ? (c.alAire ? 'al aire' : c.estado === 'activo' ? 'activa, sin gasto reciente' : c.estado === 'pausado' ? 'pausada' : c.estado === 'archivado' ? 'archivada' : c.estado === 'en_revision' ? 'en revisión' : 'rechazada') + ` · ${c.diasConGasto} días con gasto` : 'la cuenta completa'}</span>
                </span>
                {activa && <span aria-hidden="true" className="text-acento"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M5 12l5 5L20 7" /></svg></span>}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
