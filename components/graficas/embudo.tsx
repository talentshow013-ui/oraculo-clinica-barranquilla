import type { CSSProperties } from 'react'
import Link from 'next/link'
import type { PasoEmbudo } from '@/lib/tipos'
import { PASOS } from '@/lib/format/etiquetas'
import { cop, copCorto, num, pct } from '@/lib/format'

/**
 * EL EMBUDO DE 8 PASOS, en pesos. Las barras crecen en cascada; la anchura es la raíz de la
 * cantidad (con la escala lineal, del paso 4 en adelante no se vería nada). El paso con la
 * fuga más cara va en rojo: es el que se ataca primero.
 */
export default function EmbudoBarras({ pasos, peor, compacto = false }: { pasos: PasoEmbudo[]; peor: PasoEmbudo | null; compacto?: boolean }) {
  const max = Math.sqrt(Math.max(1, ...pasos.map((p) => p.cantidad ?? 0)))
  return (
    <ol className="flex flex-col gap-1.5">
      {pasos.map((p, i) => {
        const w = p.cantidad == null ? 0 : (Math.sqrt(p.cantidad) / max) * 100
        const esPeor = peor?.paso === p.paso
        return (
          <li key={p.paso} className={`grid items-center gap-x-2 sm:gap-x-3 ${compacto ? 'grid-cols-[96px_1fr_84px] sm:grid-cols-[120px_1fr_96px]' : 'grid-cols-[96px_1fr_84px] sm:grid-cols-[150px_1fr_120px_120px]'}`}>
            <span className="flex items-center gap-2 text-[12.5px]"><span className={`grid h-5 w-5 shrink-0 place-items-center rounded-full text-[10px] font-bold ${esPeor ? 'bg-mal text-white' : 'bg-superficie-2 text-texto-2'}`}>{p.orden}</span><span className="truncate">{PASOS[p.paso]}</span></span>
            <span className="relative h-7 overflow-hidden rounded-[8px] bg-superficie-2">
              <span className={`crece absolute inset-y-0 left-0 rounded-[8px] ${esPeor ? 'bg-mal' : i >= 5 ? 'bg-marino' : 'bg-acento'}`} style={{ width: `${Math.max(3, w)}%`, '--retraso': `${120 + i * 90}ms` } as CSSProperties} />
              <span className={`num absolute inset-y-0 left-2 flex items-center text-[12px] font-semibold ${w > 22 ? 'text-white' : 'text-texto'}`} style={w <= 22 ? { left: `calc(${Math.max(3, w)}% + 8px)` } : undefined}>{num(p.cantidad)}</span>
              {p.tasaPaso != null && <span className="num absolute inset-y-0 right-2 flex items-center text-[11px] text-texto-2">{pct(p.tasaPaso, 0)} del anterior</span>}
            </span>
            <span className={`num text-right text-[13px] ${esPeor ? 'font-semibold text-mal' : p.fugaCOP ? 'text-texto' : 'text-texto-3'}`} title={p.metodoValorizacion === 'margen_unitario' ? 'perdidos × margen unitario' : p.metodoValorizacion === 'costo_paso_anterior' ? 'perdidos × costo del paso anterior' : 'sin dato'}>{p.fugaCOP == null ? '—' : `−${compacto ? copCorto(p.fugaCOP) : cop(p.fugaCOP)}`}</span>
            {!compacto && <span className="num hidden text-right text-[12px] text-texto-2 sm:block">{p.costoUnitario == null ? '—' : `${cop(p.costoUnitario)} c/u`}</span>}
          </li>
        )
      })}
      {peor && <li className="mt-1 text-[12px] text-texto-2">La fuga más cara está en <Link href="/embudo" className="font-semibold text-mal underline-offset-2 hover:underline">{PASOS[peor.paso].toLowerCase()}</Link>: {num(peor.perdidos)} perdidos valen {cop(peor.fugaCOP)}{peor.metodoValorizacion === 'margen_unitario' ? ' de margen' : ' de costo de adquisición'}.</li>}
    </ol>
  )
}
