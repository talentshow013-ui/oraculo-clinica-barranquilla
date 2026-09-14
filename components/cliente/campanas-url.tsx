'use client'
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

/** Dos botones discretos por fila: ponen esa campaña como A o como B en la comparación. */
export function ElegirAB({ id, esA, esB }: { id: string; esA: boolean; esB: boolean }) {
  const ir = useIrCon()
  const base = 'grid h-6 w-6 place-items-center rounded-full text-[11px] font-bold ring-1 transition-[background-color,color,transform] duration-300 hover:-translate-y-px'
  return (
    <span className="inline-flex shrink-0 items-center gap-1" aria-label="Poner en la comparación">
      <button type="button" aria-pressed={esA} aria-label={esA ? 'Es la A de la comparación' : 'Ponerla como A'} onClick={() => ir({ a: esA ? null : id })} className={`${base} ${esA ? 'bg-marino text-white ring-marino' : 'bg-superficie text-texto-2 ring-borde hover:text-marino'}`}>A</button>
      <button type="button" aria-pressed={esB} aria-label={esB ? 'Es la B de la comparación' : 'Ponerla como B'} onClick={() => ir({ b: esB ? null : id })} className={`${base} ${esB ? 'bg-acento text-white ring-acento' : 'bg-superficie text-texto-2 ring-borde hover:text-acento'}`}>B</button>
    </span>
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
