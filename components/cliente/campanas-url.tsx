'use client'
import { useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import type { PeriodoCampanas } from '@/lib/tipos'

/**
 * Lo único con estado en Campañas vive en la URL: `?periodo=30&a=<id>&b=<id>`. Cambiar una
 * pastilla o pulsar A/B empuja la URL y el Server Component vuelve a pedir los datos. Así el
 * enlace se puede copiar y enseñar tal cual, y no hay estado global ni fetch propio.
 */
function useIrCon() {
  const router = useRouter()
  const actual = useSearchParams()
  return (cambios: Record<string, string | null>) => {
    const q = new URLSearchParams(actual.toString())
    for (const [k, v] of Object.entries(cambios)) v == null ? q.delete(k) : q.set(k, v)
    const s = q.toString()
    router.push(s ? `/campanas?${s}${cambios.registrar ? '#resultados' : ''}` : '/campanas', { scroll: false })
  }
}

const PERIODOS: { v: PeriodoCampanas; t: string }[] = [{ v: '14', t: '14 días' }, { v: '30', t: '30 días' }, { v: '90', t: '90 días' }, { v: 'todo', t: 'Todo' }]
export function SelectorPeriodo({ actual }: { actual: PeriodoCampanas }) {
  const ir = useIrCon()
  return (
    <div role="radiogroup" aria-label="Periodo" className="inline-flex items-center gap-0.5 rounded-full bg-superficie-2 p-1 ring-1 ring-borde">
      {PERIODOS.map((p) => {
        const activo = p.v === actual
        return (
          <button key={p.v} type="button" role="radio" aria-checked={activo} onClick={() => ir({ periodo: p.v === 'todo' ? null : p.v })} className={`rounded-full px-3 py-1 text-[12.5px] font-medium transition-[background-color,color,box-shadow] duration-300 ${activo ? 'bg-marino text-white shadow-[0_8px_18px_-10px_rgba(11,29,58,0.7)]' : 'text-texto-2 hover:bg-white hover:text-texto'}`}>
            {p.t}
          </button>
        )
      })}
    </div>
  )
}

/** Elegir las campañas que se quieran comparar: casillas en un desplegable propio; lo elegido viaja en `?comparar=`. */
export function SelectorComparar({ campanas, elegidas }: { campanas: { id: string; nombre: string; estado: string; alAire: boolean }[]; elegidas: string[] }) {
  const ir = useIrCon()
  const [abierto, setAbierto] = useState(false)
  /* la casilla se marca al instante; la URL (y el servidor) la siguen */
  const [marcadas, setMarcadas] = useState(elegidas)
  useEffect(() => setMarcadas(elegidas), [elegidas])
  const raiz = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!abierto) return
    const fuera = (e: MouseEvent) => { if (!raiz.current?.contains(e.target as Node)) setAbierto(false) }
    document.addEventListener('mousedown', fuera)
    return () => document.removeEventListener('mousedown', fuera)
  }, [abierto])
  const alternar = (id: string) => {
    const nuevas = marcadas.includes(id) ? marcadas.filter((x) => x !== id) : [...marcadas, id]
    setMarcadas(nuevas)
    ir({ comparar: nuevas.length ? nuevas.join(',') : null })
  }
  return (
    <div ref={raiz} className="relative" onKeyDown={(e) => e.key === 'Escape' && setAbierto(false)}>
      <button type="button" aria-haspopup="listbox" aria-expanded={abierto} onClick={() => setAbierto((v) => !v)} className={`flex items-center gap-2 rounded-full px-3.5 py-1.5 text-[12.5px] font-medium ring-1 transition-[background-color,box-shadow] duration-300 ${marcadas.length ? 'bg-marino text-white ring-marino hover:shadow-[0_12px_24px_-12px_rgba(11,29,58,0.6)]' : 'bg-superficie text-texto ring-borde hover:bg-superficie-2'}`}>
        Comparar campañas{marcadas.length ? <span className="num rounded-full bg-white/15 px-1.5 text-[11px]">{marcadas.length}</span> : null}
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" className={`transition-transform duration-300 ${abierto ? 'rotate-180' : ''}`} aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>
      </button>
      {abierto && (
        <div role="listbox" aria-multiselectable="true" aria-label="Campañas a comparar" className="absolute right-0 top-[calc(100%+8px)] z-50 w-[320px] rounded-[16px] bg-superficie p-1.5 shadow-[0_24px_50px_-20px_rgba(11,29,58,0.5)] ring-1 ring-borde entra-zoom">
          <p className="px-2.5 pb-1.5 pt-1 text-[11px] text-texto-3">Marca dos o más para verlas lado a lado.</p>
          <ul className="max-h-[300px] overflow-y-auto">
            {campanas.map((c) => {
              const si = marcadas.includes(c.id)
              return (
                <li key={c.id} role="option" aria-selected={si}>
                  <label className="flex cursor-pointer items-center gap-2.5 rounded-[11px] px-2.5 py-2 transition-colors hover:bg-superficie-2">
                    <input type="checkbox" checked={si} onChange={() => alternar(c.id)} className="h-4 w-4 accent-[#2563EB]" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-medium text-texto">{c.nombre}</span>
                      <span className="block text-[11px] text-texto-3">{c.alAire ? 'Al aire' : c.estado}</span>
                    </span>
                  </label>
                </li>
              )
            })}
          </ul>
          {marcadas.length > 0 && (
            <button type="button" onClick={() => { setMarcadas([]); ir({ comparar: null }); setAbierto(false) }} className="mt-1 w-full rounded-[11px] px-2.5 py-2 text-left text-[12px] font-medium text-texto-2 transition-colors hover:bg-superficie-2 hover:text-texto">Limpiar</button>
          )}
        </div>
      )}
    </div>
  )
}

/** Lleva al bloque de resultados de esa campaña, conservando periodo y A/B. */
export function IrAResultados({ id, activo }: { id: string; activo: boolean }) {
  const ir = useIrCon()
  return (
    <button type="button" aria-pressed={activo} onClick={() => ir({ registrar: activo ? null : id, guardada: null, error: null })} className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 transition-[background-color,color] duration-300 ${activo ? 'bg-marino text-white ring-marino' : 'bg-superficie text-texto-2 ring-borde hover:text-marino'}`}>
      Resultados
    </button>
  )
}
