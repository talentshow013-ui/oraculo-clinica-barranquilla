import Link from 'next/link'
import type { Evidencia, FuenteHallazgo } from '@/lib/diagnostics/engine'
import { num } from '@/lib/format'
import { fechaCorta } from '@/lib/format/fechas'

/** Chip de evidencia: si trae ruta, es un enlace que lleva a la tabla donde está ese dato. */
export function ChipEvidencia({ e, tono = 'neutro' }: { e: Evidencia; tono?: 'neutro' | 'claro' }) {
  const base = `inline-flex max-w-full items-baseline gap-1 rounded-full px-2.5 py-1 text-[11.5px] leading-tight ring-1 ${tono === 'claro' ? 'bg-white/10 text-white ring-white/15' : 'bg-superficie-2 text-texto-2 ring-borde'}`
  const cuerpo = (
    <>
      <span className="truncate">{e.etiqueta}:</span>
      <span className={`num shrink-0 font-semibold ${tono === 'claro' ? 'text-white' : 'text-texto'}`}>{e.valor}</span>
    </>
  )
  if (!e.enlace) return <span className={base}>{cuerpo}</span>
  return (
    <Link href={e.enlace} className={`${base} transition hover:ring-acento`} title="Ir al dato en el panel">
      {cuerpo}
      <span aria-hidden="true" className="shrink-0 text-acento">→</span>
    </Link>
  )
}

/** Tarjeta de evidencia grande (Diagnóstico): etiqueta, valor y, si hay ruta, «ver el dato». */
export function TarjetaEvidencia({ e }: { e: Evidencia }) {
  const contenido = (
    <>
      <span className="block text-[11px] text-texto-2">{e.etiqueta}</span>
      <span className="num block text-[15px] font-semibold">{e.valor}</span>
    </>
  )
  if (!e.enlace) return <li className="rounded-[12px] bg-superficie-2 px-3 py-2">{contenido}</li>
  return (
    <li>
      <Link href={e.enlace} className="block rounded-[12px] bg-superficie-2 px-3 py-2 ring-1 ring-transparent transition hover:ring-acento" title="Ir al dato en el panel">
        {contenido}
        <span className="mt-0.5 block text-[11px] font-medium text-acento">Ver el dato →</span>
      </Link>
    </li>
  )
}

/** De dónde sale el hallazgo: origen, periodo, filas miradas, método y enlace a la tabla completa. */
export function FuenteDelHallazgo({ fuente, compacta = false }: { fuente: FuenteHallazgo; compacta?: boolean }) {
  if (compacta) {
    return (
      <p className="mt-1.5 text-[11.5px] text-texto-3">
        <span className="font-medium text-texto-2">De dónde sale:</span> {fuente.origen} · {fechaCorta(fuente.desde)} – {fechaCorta(fuente.hasta)} · {num(fuente.registros)} registros ·{' '}
        <Link href={fuente.enlace} className="font-medium text-acento">ver la tabla →</Link>
      </p>
    )
  }
  return (
    <div className="rounded-[12px] border border-borde bg-superficie px-3 py-2.5">
      <p className="rotulo">De dónde sale</p>
      <dl className="mt-1 grid grid-cols-1 gap-x-4 gap-y-1 text-[12.5px] sm:grid-cols-[auto_1fr]">
        <dt className="text-texto-2">Fuente</dt>
        <dd className="font-medium">{fuente.origen}</dd>
        <dt className="text-texto-2">Periodo mirado</dt>
        <dd className="num">{fechaCorta(fuente.desde)} – {fechaCorta(fuente.hasta)} · {num(fuente.registros)} registros</dd>
        <dt className="text-texto-2">Cómo se calcula</dt>
        <dd className="leading-snug">{fuente.metodo}</dd>
      </dl>
      <Link href={fuente.enlace} className="mt-2 inline-block text-[12.5px] font-medium text-acento">Ver la tabla completa →</Link>
    </div>
  )
}
