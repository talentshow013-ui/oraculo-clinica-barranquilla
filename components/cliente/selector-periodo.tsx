'use client'
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { fechaCorta } from '@/lib/format/fechas'

/**
 * EL PERIODO SE ELIGE CON CALENDARIO. Antes era texto fijo. Ahora: dos fechas, «Aplicar» y
 * «Todo el periodo». Sin API propia: viajan en dos cookies (`periodo_desde`, `periodo_hasta`) y
 * la página se refresca; el motor las lee y recalcula todo el panel.
 * EN VIVO: si el final elegido es el último día con datos, no se guarda: el panel sigue avanzando
 * hasta hoy solo. Y las cookies duran lo que dura el navegador abierto, no un año.
 */
export default function SelectorPeriodo({ periodo }: { periodo: { desde: string; hasta: string; elegido: boolean; minimo: string; maximo: string } }) {
  const [abierto, setAbierto] = useState(false)
  const [desde, setDesde] = useState(periodo.desde)
  const [hasta, setHasta] = useState(periodo.hasta)
  const [cambiando, setCambiando] = useState(false)
  const raiz = useRef<HTMLDivElement>(null)
  const router = useRouter()
  useEffect(() => {
    setDesde(periodo.desde)
    setHasta(periodo.hasta)
  }, [periodo.desde, periodo.hasta])
  useEffect(() => {
    if (!abierto) return
    const fuera = (e: MouseEvent) => {
      if (!raiz.current?.contains(e.target as Node)) setAbierto(false)
    }
    document.addEventListener('mousedown', fuera)
    return () => document.removeEventListener('mousedown', fuera)
  }, [abierto])

  const valido = desde >= periodo.minimo && hasta <= periodo.maximo && desde <= hasta
  const refrescar = () => {
    setCambiando(true)
    setAbierto(false)
    router.refresh()
    setTimeout(() => setCambiando(false), 1200)
  }
  const aplicar = () => {
    if (!valido) return
    document.cookie = `periodo_desde=${desde}; path=/; samesite=lax`
    if (hasta >= periodo.maximo) document.cookie = 'periodo_hasta=; path=/; max-age=0'
    else document.cookie = `periodo_hasta=${hasta}; path=/; samesite=lax`
    refrescar()
  }
  const todo = () => {
    document.cookie = 'periodo_desde=; path=/; max-age=0'
    document.cookie = 'periodo_hasta=; path=/; max-age=0'
    refrescar()
  }

  return (
    <div ref={raiz} className="relative hidden md:block" onKeyDown={(e) => e.key === 'Escape' && setAbierto(false)}>
      <button type="button" aria-haspopup="dialog" aria-expanded={abierto} onClick={() => setAbierto((v) => !v)} className={`flex items-center gap-2 rounded-full px-2.5 py-1 text-[12.5px] text-texto-2 ring-1 ring-transparent transition-[background-color,box-shadow] duration-300 hover:bg-superficie-2 ${abierto ? 'bg-superficie-2 ring-borde' : ''} ${cambiando ? 'opacity-60' : ''}`}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="3" /><path d="M3 10h18M8 3v4M16 3v4" /></svg>
        <span className="rotulo">Periodo</span>
        <span className="num text-texto">{cambiando ? 'Cambiando…' : `${fechaCorta(periodo.desde)} – ${fechaCorta(periodo.hasta)}`}</span>
        {periodo.elegido && <span className="rounded-full bg-acento/10 px-2 py-0.5 text-[10.5px] font-semibold text-acento ring-1 ring-acento/25">personalizado</span>}
      </button>
      {abierto && (
        <div role="dialog" aria-label="Elegir periodo" className="absolute left-0 top-[calc(100%+8px)] z-50 w-[320px] rounded-[16px] bg-superficie p-4 shadow-[0_24px_50px_-20px_rgba(11,29,58,0.5)] ring-1 ring-borde entra-zoom">
          <p className="text-[11px] text-texto-3">Hay datos del {fechaCorta(periodo.minimo)} al {fechaCorta(periodo.maximo)}. Todo el panel se recalcula con lo que elijas.</p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <label className="block">
              <span className="rotulo">Desde</span>
              <input type="date" value={desde} min={periodo.minimo} max={periodo.maximo} onChange={(e) => setDesde(e.target.value)} className="num mt-1 block w-full rounded-[10px] bg-superficie-2 px-2.5 py-1.5 text-[13px] text-texto ring-1 ring-borde focus:outline-none focus:ring-2 focus:ring-acento" />
            </label>
            <label className="block">
              <span className="rotulo">Hasta</span>
              <input type="date" value={hasta} min={periodo.minimo} max={periodo.maximo} onChange={(e) => setHasta(e.target.value)} className="num mt-1 block w-full rounded-[10px] bg-superficie-2 px-2.5 py-1.5 text-[13px] text-texto ring-1 ring-borde focus:outline-none focus:ring-2 focus:ring-acento" />
            </label>
          </div>
          {!valido && <p className="mt-2 text-[11.5px] text-mal">La fecha de inicio debe ir antes que la final, y las dos dentro de los datos que hay.</p>}
          <div className="mt-3 flex items-center justify-between gap-2">
            <button type="button" onClick={todo} className="rounded-full px-3 py-1.5 text-[12.5px] font-medium text-texto-2 transition-colors hover:bg-superficie-2 hover:text-texto">Todo el periodo</button>
            <button type="button" onClick={aplicar} disabled={!valido} className="rounded-full bg-marino px-4 py-1.5 text-[12.5px] font-medium text-white transition-[box-shadow] hover:shadow-[0_12px_24px_-12px_rgba(11,29,58,0.6)] disabled:cursor-not-allowed disabled:opacity-50">Aplicar</button>
          </div>
        </div>
      )}
    </div>
  )
}
