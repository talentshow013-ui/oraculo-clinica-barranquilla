import type { CSSProperties } from 'react'
import { motor } from '@/lib/datos'
import { Etiqueta, Titulo } from '@/components/ui'

/** MESA DE CONSULTORES: siete marcos publicados, con fuente, aplicados como lista de verificación sobre datos reales. */
export default async function Consejo() {
  const r = await motor()
  const total = r.lentes.reduce((s, l) => s + l.criterios.length, 0)
  const fallidos = r.lentes.reduce((s, l) => s + l.fallidos, 0)
  return (
    <>
      <Titulo rotulo="Mesa de consultores · 7 lentes con fuente citada" extra={<p className="num text-[12.5px] text-texto-2">{total} criterios · {fallidos} fallan · {r.lentes.reduce((s, l) => s + l.sinDato, 0)} sin dato</p>}>Auditar con criterio externo</Titulo>
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {r.lentes.map((l, i) => (
          <section key={l.nombre} className={`pieza ${i % 2 ? 'entra-der' : 'entra-izq'} p-4 sm:p-5`} style={{ '--retraso': `${60 + i * 70}ms` } as CSSProperties} aria-label={l.nombre}>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div><p className="rotulo">{l.fuente}</p><h2 className="mt-0.5 text-[18px]">{l.nombre}</h2><p className="text-[12.5px] text-texto-2">{l.paraQue}</p></div>
              <div className="flex overflow-hidden rounded-full ring-1 ring-borde" role="img" aria-label={`${l.cumplidos} cumplen, ${l.fallidos} fallan, ${l.sinDato} sin dato`}>
                {l.cumplidos > 0 && <span className="num bg-bien px-2 py-0.5 text-[11px] font-semibold text-white">{l.cumplidos} ✓</span>}
                {l.fallidos > 0 && <span className="num bg-mal px-2 py-0.5 text-[11px] font-semibold text-white">{l.fallidos} ✗</span>}
                {l.sinDato > 0 && <span className="num bg-superficie-2 px-2 py-0.5 text-[11px] font-semibold text-texto-2">{l.sinDato} —</span>}
              </div>
            </div>
            <ul className="mt-3 flex flex-col gap-1.5">
              {l.criterios.map((c) => (
                <li key={c.criterio} className={`grid grid-cols-[22px_1fr] gap-2 rounded-[12px] px-2.5 py-2 ${c.cumple === false ? 'bg-mal/[0.06] ring-1 ring-mal/15' : c.cumple === true ? 'bg-superficie-2/70' : 'bg-superficie-2/40'}`}>
                  <span role="img" aria-label={c.cumple === true ? 'cumple' : c.cumple === false ? 'falla' : 'sin dato'} className={`mt-0.5 grid h-5 w-5 place-items-center rounded-full text-[11px] font-bold ${c.cumple === true ? 'bg-bien text-white' : c.cumple === false ? 'bg-mal text-white' : 'bg-borde text-texto-2'}`}>{c.cumple === true ? '✓' : c.cumple === false ? '✗' : '—'}</span>
                  <div className="min-w-0 text-[13px] leading-snug">
                    <p className="font-medium">{c.criterio}</p>
                    <p className="text-[12.5px] text-texto-2">{c.datoPanel}</p>
                    {c.cumple === false && <p className="mt-1 text-[12.5px] text-mal"><span className="font-semibold">Si falla:</span> {c.accionSiFalla}</p>}
                    {c.cumple === null && <Etiqueta tono="neutro" className="mt-1">Sin dato: no se decide</Etiqueta>}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </>
  )
}
