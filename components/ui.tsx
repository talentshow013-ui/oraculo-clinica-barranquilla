import type { CSSProperties, ReactNode } from 'react'
import type { MejorEs, Severidad, Unidad } from '@/lib/tipos'
import { formatear, conSigno } from '@/lib/format'
import { delta } from '@/lib/metrics/core'
import Contar from './cliente/contar'
import Ayuda from './cliente/ayuda'

export { formatear }
export type Tono = 'bien' | 'mal' | 'ojo' | 'acento' | 'neutro'
const TONO: Record<Tono, string> = { bien: 'bg-bien/10 text-bien ring-bien/25', mal: 'bg-mal/10 text-mal ring-mal/25', ojo: 'bg-ojo/10 text-ojo ring-ojo/25', acento: 'bg-acento/10 text-acento ring-acento/25', neutro: 'bg-superficie-2 text-texto-2 ring-borde' }
export const PUNTO: Record<Tono, string> = { bien: 'bg-bien', mal: 'bg-mal', ojo: 'bg-ojo', acento: 'bg-acento', neutro: 'bg-borde-fuerte' }
export const tonoSeveridad = (s: Severidad): Tono => (s === 'alta' ? 'mal' : s === 'media' ? 'ojo' : 'neutro')
/** el tono de una variación según hacia dónde es mejor */
export function tonoDelta(delta: number | null, mejorEs: MejorEs): Tono {
  if (delta == null || Math.abs(delta) < 0.005) return 'neutro'
  if (mejorEs === 'rango' || mejorEs === 'informativo') return 'neutro'
  const mejora = mejorEs === 'mayor' ? delta > 0 : delta < 0
  return mejora ? 'bien' : 'mal'
}

export function Titulo({ rotulo, children, extra, className = '' }: { rotulo: string; children: ReactNode; extra?: ReactNode; className?: string }) {
  return (
    <div className={`entra mb-4 flex flex-wrap items-end justify-between gap-3 ${className}`}>
      <div>
        <p className="rotulo">{rotulo}</p>
        <h1 className="mt-1 text-[clamp(1.5rem,2.4vw,2rem)]">{children}</h1>
      </div>
      {extra}
    </div>
  )
}

export function Panel({ titulo, rotulo, extra, children, className = '', tono = 'blanco', retraso = 0, id }: { titulo?: ReactNode; rotulo?: string; extra?: ReactNode; children: ReactNode; className?: string; tono?: 'blanco' | 'marina' | 'hielo'; retraso?: number; id?: string }) {
  const piel = tono === 'marina' ? 'pieza-marina' : tono === 'hielo' ? 'pieza-hielo' : 'pieza'
  return (
    <section id={id} className={`${piel} entra p-4 sm:p-5 ${className}`} style={{ '--retraso': `${retraso}ms` } as CSSProperties} aria-label={typeof titulo === 'string' ? titulo : rotulo}>
      {(titulo || rotulo) && (
        <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
          <div>
            {rotulo && <p className={`rotulo ${tono === 'marina' ? 'text-celeste' : ''}`}>{rotulo}</p>}
            {titulo && <h2 className={`mt-0.5 text-[18px] ${tono === 'marina' ? 'text-white' : ''}`}>{titulo}</h2>}
          </div>
          {extra}
        </div>
      )}
      {children}
    </section>
  )
}

export function Grid({ cols = 3, children, className = '' }: { cols?: 2 | 3 | 4 | 6 | 12; children: ReactNode; className?: string }) {
  const c = { 2: 'md:grid-cols-2', 3: 'md:grid-cols-2 xl:grid-cols-3', 4: 'sm:grid-cols-2 xl:grid-cols-4', 6: 'grid-cols-2 sm:grid-cols-3 xl:grid-cols-6', 12: 'lg:grid-cols-12' }[cols]
  return <div className={`grid grid-cols-1 gap-3 ${c} ${className}`}>{children}</div>
}

/** KPI de instrumento: etiqueta chica, cifra grande contada, variación con su color según «mejor es». Al pasar, se levanta y enseña su fórmula y «qué decisión cambia» en un sobre-mensaje fijo (nunca debajo del vecino). */
export function Kpi({ nombre, valor, unidad, reciente, previo, mejorEs = 'rango', formula, porQueImporta, tono, className = '', grande = false, retraso = 0 }: { nombre: string; valor: number | null | undefined; unidad: Unidad; /** valor de la ventana reciente (14 d) cuando `valor` es del periodo completo */ reciente?: number | null; previo?: number | null; mejorEs?: MejorEs; formula?: string; porQueImporta?: string; tono?: Tono; className?: string; grande?: boolean; retraso?: number }) {
  const d = delta((reciente !== undefined ? reciente : valor) ?? null, previo ?? null)
  const t = tono ?? tonoDelta(d, mejorEs)
  const tarjeta = (
    <div className={`pieza instrumento entra-zoom flex h-full flex-col justify-between p-3.5 ${className}`} style={{ '--retraso': `${retraso}ms` } as CSSProperties}>
      <p className="text-[11.5px] leading-tight text-texto-2">{nombre}</p>
      <p className={`num mt-1.5 ${grande ? 'text-[34px]' : 'text-[24px]'} cifra ${t === 'mal' ? 'text-mal' : t === 'bien' ? 'text-bien' : 'text-texto'}`}>
        <Contar valor={valor} unidad={unidad} />
      </p>
      {previo !== undefined && (
        <p className="mt-1.5 flex items-center gap-1.5 text-[11px] text-texto-3">
          {d == null ? <span>sin comparación</span> : <><span className={`num rounded-full px-1.5 py-0.5 font-semibold ring-1 ${TONO[t]}`}>{conSigno(d)}</span><span>vs. 14 días antes</span></>}
        </p>
      )}
    </div>
  )
  /* el sobre-mensaje (fórmula + qué decisión cambia) va en un portal fijo: se ve SIEMPRE encima */
  return formula || porQueImporta ? <Ayuda titulo={formula} texto={porQueImporta ?? ''}>{tarjeta}</Ayuda> : tarjeta
}

export function Etiqueta({ tono = 'neutro', children, titulo, className = '' }: { tono?: Tono; children: ReactNode; titulo?: string; className?: string }) {
  return <span title={titulo} className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ${TONO[tono]} ${className}`}><span className={`h-1.5 w-1.5 rounded-full ${PUNTO[tono]}`} aria-hidden="true" />{children}</span>
}

/** Barra fina con su relleno que crece; `pct` 0–1; `null` → pista vacía y «—». */
export function Barra({ pct, tono = 'acento', etiqueta, valor, alto = 6, retraso = 100, oscuro = false }: { pct: number | null; tono?: Tono; etiqueta?: string; valor?: string; alto?: number; retraso?: number; oscuro?: boolean }) {
  return (
    <div>
      {(etiqueta || valor) && <div className="mb-1 flex items-baseline justify-between gap-2 text-[12.5px]"><span className={oscuro ? 'text-celeste' : 'text-texto-2'}>{etiqueta}</span><span className={`num font-medium ${oscuro ? 'text-white' : ''}`}>{valor ?? (pct == null ? '—' : '')}</span></div>}
      <div className={`overflow-hidden rounded-full ${oscuro ? 'bg-white/15' : 'bg-borde/60'}`} style={{ height: alto }} role="progressbar" aria-valuenow={pct == null ? undefined : Math.round(pct * 100)} aria-valuemin={0} aria-valuemax={100} aria-label={etiqueta}>
        {pct != null && <span className={`crece block h-full rounded-full ${PUNTO[tono]}`} style={{ width: `${Math.max(0, Math.min(100, pct * 100))}%`, '--retraso': `${retraso}ms` } as CSSProperties} />}
      </div>
    </div>
  )
}

export function Vacio({ titulo, texto }: { titulo: string; texto: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-1.5 rounded-[14px] border border-dashed border-borde-fuerte px-6 py-10 text-center">
      <p className="text-[15px]">{titulo}</p>
      <p className="max-w-[40ch] text-[13px] text-texto-2">{texto}</p>
    </div>
  )
}

export function Aviso({ tono = 'ojo', children, className = '' }: { tono?: Tono; children: ReactNode; className?: string }) {
  return <p role={tono === 'mal' ? 'alert' : 'note'} className={`flex items-start gap-2 rounded-[12px] px-3 py-2 text-[12.5px] leading-snug ring-1 ${TONO[tono]} ${className}`}><span className={`mt-[6px] h-1.5 w-1.5 shrink-0 rounded-full ${PUNTO[tono]}`} aria-hidden="true" />{children}</p>
}

/* ── tabla ── */
export function Tabla({ children, className = '', minAncho = 560 }: { children: ReactNode; className?: string; minAncho?: number }) {
  return <div className={`sin-barra overflow-x-auto ${className}`}><table className="w-full text-[13px]" style={{ minWidth: minAncho }}>{children}</table></div>
}
export function Th({ children, num = false, className = '' }: { children?: ReactNode; num?: boolean; className?: string }) {
  return <th scope="col" className={`border-b border-borde pb-2 pr-3 text-[10.5px] font-semibold uppercase tracking-[0.16em] text-texto-2 ${num ? 'text-right' : 'text-left'} ${className}`}>{children}</th>
}
export function Celda({ children, num = false, tono, className = '' }: { children?: ReactNode; num?: boolean; tono?: Tono; className?: string }) {
  const color = tono === 'mal' ? 'text-mal' : tono === 'bien' ? 'text-bien' : tono === 'ojo' ? 'text-ojo' : tono === 'acento' ? 'text-acento' : ''
  return <td className={`border-b border-borde/70 py-2 pr-3 align-middle ${num ? 'num text-right' : ''} ${color} ${className}`}>{children ?? '—'}</td>
}

/** Miniatura de un creativo o de un anuncio del radar: imagen local si la hay; si no, un marco con el tipo. */
export function Miniatura({ url, tipo, alt, className = '' }: { url: string | null; tipo: string; alt: string; className?: string }) {
  const local = url?.startsWith('/radar/') || url?.startsWith('/creativos/') || url?.startsWith('/organico/')
  return (
    <span className={`relative block overflow-hidden rounded-[12px] bg-superficie-2 ${className}`}>
      {local ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url!} alt={alt} className="h-full w-full object-cover" loading="lazy" />
      ) : (
        <span className="rejilla absolute inset-0 grid place-items-center text-[10.5px] font-semibold uppercase tracking-[0.18em] text-texto-3">{tipo}</span>
      )}
    </span>
  )
}
