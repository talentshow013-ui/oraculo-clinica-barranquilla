import type { CSSProperties } from 'react'
import { motor } from '@/lib/datos'
import { cop } from '@/lib/format'
import { AREAS, SEVERIDADES } from '@/lib/format/etiquetas'
import { Aviso, Etiqueta, Titulo, tonoSeveridad } from '@/components/ui'
import Plegable from '@/components/cliente/plegable'
import { FuenteDelHallazgo, TarjetaEvidencia } from '@/components/hallazgo-fuente'

/** DIAGNÓSTICO: cada hallazgo responde en orden qué pasa → cómo lo sabemos → qué hago → cuánta plata. */
export default async function Diagnostico() {
  const r = await motor()
  const conPlata = r.hallazgos.filter((h) => h.plataEnRiesgo).length
  return (
    <>
      <Titulo rotulo="Diagnóstico · reglas que se pueden auditar línea por línea" extra={<p className="num text-[12.5px] text-texto-2">{r.hallazgos.length} hallazgos · {conPlata} con plata · {cop(r.plataEnRiesgoTotal)} en riesgo</p>}>¿En qué estamos fallando?</Titulo>
      {r.erroresReglas.length > 0 && <Aviso tono="ojo" className="mb-3">{r.erroresReglas.map((e) => e.mensaje).join(' · ')} — esa regla no se evaluó; no significa que esté bien.</Aviso>}
      <ol className="flex flex-col gap-2.5">
        {r.hallazgos.map((h, i) => (
          <li key={h.reglaId} className={`${i % 2 ? 'entra-der' : 'entra-izq'} pieza p-4 sm:p-5`} style={{ '--retraso': `${60 + i * 70}ms` } as CSSProperties}>
            <Plegable abierto={i === 0} cabecera={
              <div className="grid grid-cols-[28px_1fr] gap-3">
                <span className={`grid h-7 w-7 place-items-center rounded-full text-[12px] font-bold text-white ${h.severidad === 'alta' ? 'bg-mal' : h.severidad === 'media' ? 'bg-ojo' : 'bg-borde-fuerte'}`}>{i + 1}</span>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
                    <h2 className="text-[clamp(1.05rem,1.5vw,1.25rem)] leading-tight">{h.titulo}</h2>
                    <span className={`num shrink-0 text-[20px] cifra ${h.plataEnRiesgo ? 'text-mal' : 'text-texto-3'}`}>{h.plataEnRiesgo ? cop(h.plataEnRiesgo) : '—'}</span>
                  </div>
                  <div className="mt-1.5 flex flex-wrap gap-1"><Etiqueta tono={tonoSeveridad(h.severidad)}>{SEVERIDADES[h.severidad]}</Etiqueta><Etiqueta tono="neutro">{AREAS[h.area]}</Etiqueta><span className="text-[11px] text-texto-3">regla {h.reglaId}</span></div>
                </div>
              </div>
            }>
              <div className="mt-3 grid grid-cols-1 gap-3 pl-0 sm:pl-10 lg:grid-cols-12">
                <div className="lg:col-span-5">
                  <p className="rotulo">Qué pasa</p>
                  <p className="mt-1 text-[13.5px] leading-snug">{h.explicacion}</p>
                  <p className="rotulo mt-3">Cómo lo sabemos · cada dato lleva a su tabla</p>
                  {/* una sola historia: primero los datos (tarjetas clicables), debajo la ficha técnica en hielo */}
                  <div className="mt-1.5 rounded-[14px] bg-superficie-2/60 p-2">
                    <ul className="grid grid-cols-1 gap-1.5 sm:grid-cols-3 lg:grid-cols-1">
                      {h.evidencia.map((e) => <TarjetaEvidencia key={e.etiqueta} e={e} />)}
                    </ul>
                    <div className="mt-2"><FuenteDelHallazgo fuente={h.fuente} /></div>
                  </div>
                </div>
                <div className="lg:col-span-7">
                  <p className="rotulo">Qué hago</p>
                  <ol className="mt-1.5 flex flex-col gap-1.5">
                    {h.acciones.map((a, j) => <li key={j} className="flex gap-2.5 rounded-[12px] bg-acento/[0.07] px-3 py-2 text-[13.5px] leading-snug ring-1 ring-acento/15"><span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-acento text-[11px] font-bold text-white">{j + 1}</span>{a}</li>)}
                  </ol>
                  <p className="mt-3 rounded-[12px] bg-mal/[0.06] px-3 py-2 text-[13px] ring-1 ring-mal/15"><span className="font-semibold text-mal">Cuánta plata.</span> {h.plataEnRiesgo ? `${cop(h.plataEnRiesgo)} en el periodo.` : 'No se valoriza en pesos directamente: es una condición que encarece todo lo demás.'} {h.nota}</p>
                </div>
              </div>
            </Plegable>
          </li>
        ))}
      </ol>
    </>
  )
}
