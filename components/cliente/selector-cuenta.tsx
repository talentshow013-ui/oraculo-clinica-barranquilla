'use client'
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { CuentaPublicitaria } from '@/lib/tipos'

/**
 * SELECTOR DE CUENTA PUBLICITARIA. La clínica tiene varias cuentas de Meta: se elige UNA y todo
 * el panel se recalcula para ella. Sin API propia: la elección viaja en la cookie `cuenta` y la
 * página se refresca (los Server Components vuelven a pedir `motor()`). Desplegable propio,
 * con teclado (flechas, Enter, Escape) y cierre al pulsar fuera.
 */
export default function SelectorCuenta({ cuentas, actual }: { cuentas: CuentaPublicitaria[]; actual: CuentaPublicitaria }) {
  const [abierto, setAbierto] = useState(false)
  const [foco, setFoco] = useState(cuentas.findIndex((c) => c.id === actual.id))
  const [cambiando, setCambiando] = useState(false)
  const raiz = useRef<HTMLDivElement>(null)
  const router = useRouter()

  useEffect(() => {
    if (!abierto) return
    const fuera = (e: MouseEvent) => {
      if (!raiz.current?.contains(e.target as Node)) setAbierto(false)
    }
    document.addEventListener('mousedown', fuera)
    return () => document.removeEventListener('mousedown', fuera)
  }, [abierto])

  function elegir(c: CuentaPublicitaria) {
    setAbierto(false)
    if (c.id === actual.id) return
    setCambiando(true)
    document.cookie = `cuenta=${encodeURIComponent(c.id)}; path=/; max-age=31536000; samesite=lax`
    router.refresh()
    setTimeout(() => setCambiando(false), 1200)
  }
  function teclas(e: React.KeyboardEvent) {
    if (e.key === 'Escape') setAbierto(false)
    if (e.key === 'ArrowDown') { e.preventDefault(); setAbierto(true); setFoco((f) => Math.min(cuentas.length - 1, f + 1)) }
    if (e.key === 'ArrowUp') { e.preventDefault(); setFoco((f) => Math.max(0, f - 1)) }
    if (e.key === 'Enter' && abierto) { e.preventDefault(); elegir(cuentas[foco]!) }
  }

  return (
    <div ref={raiz} className="relative min-w-0" onKeyDown={teclas}>
      <button type="button" aria-haspopup="listbox" aria-expanded={abierto} aria-label={`Cuenta publicitaria: ${actual.nombre}. Cambiar`} onClick={() => setAbierto((v) => !v)} className={`group flex items-center gap-2.5 rounded-full bg-marino py-1 pl-1.5 pr-3 text-left text-white transition-[box-shadow,transform] duration-300 hover:shadow-[0_12px_24px_-12px_rgba(11,29,58,0.6)] ${cambiando ? 'opacity-70' : ''}`}>
        <span aria-hidden="true" className="grid h-7 w-7 place-items-center rounded-full bg-white/12 text-[10px] font-bold text-celeste">{actual.nombre.split(' ').map((p) => p[0]).slice(0, 2).join('')}</span>
        <span className="leading-tight">
          <span className="hidden text-[10px] font-semibold uppercase tracking-[0.18em] text-celeste sm:block">Cuenta publicitaria</span>
          <span className="block max-w-[38vw] truncate text-[13px] font-medium sm:max-w-none">{cambiando ? 'Cambiando…' : actual.nombre}<span className="num ml-1.5 hidden text-[11px] text-celeste/80 md:inline">{actual.id}</span></span>
        </span>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" className={`ml-1 text-celeste transition-transform duration-300 ${abierto ? 'rotate-180' : ''}`} aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>
      </button>
      {abierto && (
        <ul role="listbox" aria-label="Cuentas publicitarias" className="absolute left-0 top-[calc(100%+8px)] z-50 max-h-[70vh] min-w-[300px] overflow-y-auto rounded-[16px] bg-superficie p-1.5 shadow-[0_24px_50px_-20px_rgba(11,29,58,0.5)] ring-1 ring-borde entra-zoom">
          {cuentas.map((c, i) => {
            const activa = c.id === actual.id
            return (
              <li key={c.id} role="option" aria-selected={activa} onMouseEnter={() => setFoco(i)} onClick={() => elegir(c)} className={`flex cursor-pointer items-center gap-2.5 rounded-[11px] px-2.5 py-2 transition-colors ${i === foco ? 'bg-superficie-2' : ''} ${activa ? 'text-texto' : 'text-texto-2'}`}>
                <span aria-hidden="true" className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-[10px] font-bold ${activa ? 'bg-marino text-celeste' : 'bg-superficie-2 text-cobalto'}`}>{c.nombre.split(' ').map((p) => p[0]).slice(0, 2).join('')}</span>
                <span className="min-w-0 flex-1 leading-tight">
                  <span className="block truncate text-[13px] font-medium text-texto">{c.nombre}</span>
                  <span className="num block text-[11px] text-texto-3">{c.id} · {c.plataforma === 'meta' ? 'Meta' : 'TikTok'} · {c.activa ? 'activa' : 'sin pauta'}</span>
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
