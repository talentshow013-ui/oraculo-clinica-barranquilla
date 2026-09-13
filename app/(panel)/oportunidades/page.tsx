import type { CSSProperties } from 'react'
import { motor } from '@/lib/datos'
import { cop } from '@/lib/format'
import { ANGULOS } from '@/lib/format/etiquetas'
import { Barra, Etiqueta, Titulo } from '@/components/ui'

const ORIGEN = { hallazgo: 'Sale de un hallazgo', espacio_vacio: 'Sale de un espacio vacío del mercado', ganador_mercado: 'Sale de un ganador del mercado' }

/** OPORTUNIDADES: hipótesis, prueba y criterio de corte. Sin criterio de corte no es una idea, es una corazonada. */
export default async function Oportunidades() {
  const r = await motor()
  const maxIce = Math.max(1, ...r.oportunidades.map((o) => o.ice))
  return (
    <>
      <Titulo rotulo="Oportunidades · ordenadas por impacto × confianza ÷ esfuerzo" extra={<p className="text-[12.5px] text-texto-2">{r.oportunidades.filter((o) => o.yaProbada).length} ya probadas y marcadas</p>}>Qué probar, con su corte</Titulo>
      <ol className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {r.oportunidades.map((o, i) => (
          <li key={o.titulo} className={`${o.yaProbada ? 'pieza opacity-80' : i === 0 ? 'pieza-marina lg:col-span-2' : 'pieza'} entra-zoom flex flex-col p-4 sm:p-5`} style={{ '--retraso': `${60 + i * 80}ms` } as CSSProperties}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className={`rotulo ${i === 0 && !o.yaProbada ? 'text-celeste' : ''}`}>{ORIGEN[o.origen]} · {o.tipoPrueba}</p>
                <h2 className={`mt-1 text-[clamp(1.05rem,1.5vw,1.25rem)] leading-tight ${i === 0 && !o.yaProbada ? 'text-white' : ''}`}>{o.titulo}</h2>
              </div>
              <span className="flex shrink-0 flex-col items-end"><span className={`cifra num text-[26px] ${i === 0 && !o.yaProbada ? 'text-white' : ''}`}>{o.ice}</span><span className={`text-[10.5px] uppercase tracking-[0.12em] ${i === 0 && !o.yaProbada ? 'text-celeste' : 'text-texto-2'}`}>prioridad</span></span>
            </div>
            <p className={`mt-2 text-[13.5px] leading-snug ${i === 0 && !o.yaProbada ? 'text-[#EAF2FF]' : ''}`}>{o.hipotesis}</p>
            <div className="mt-2 flex flex-wrap gap-1">
              {o.basadaEn.map((b) => <Etiqueta key={b} tono={i === 0 && !o.yaProbada ? 'acento' : 'neutro'}>{b}</Etiqueta>)}
              {o.angulo && <Etiqueta tono="acento">{ANGULOS[o.angulo]}</Etiqueta>}
              {o.yaProbada && <Etiqueta tono="ojo">Ya se probó</Etiqueta>}
            </div>
            <div className={`mt-3 grid grid-cols-2 gap-2 rounded-[14px] p-3 sm:grid-cols-4 ${i === 0 && !o.yaProbada ? 'bg-white/[0.07] ring-1 ring-white/10' : 'bg-superficie-2'}`}>
              <Dato oscuro={i === 0 && !o.yaProbada} n={o.prueba.presupuestoCOP ? cop(o.prueba.presupuestoCOP) : 'Sin costo'} t="presupuesto" />
              <Dato oscuro={i === 0 && !o.yaProbada} n={`${o.prueba.duracionDias} días`} t="duración" />
              <Dato oscuro={i === 0 && !o.yaProbada} n={o.prueba.metricaExito} t="éxito si" chico />
              <Dato oscuro={i === 0 && !o.yaProbada} n={`${o.impacto}·${o.confianza}·${o.esfuerzo}`} t="impacto · confianza · esfuerzo" />
            </div>
            <p className={`mt-2.5 rounded-[12px] px-3 py-2 text-[13px] leading-snug ${i === 0 && !o.yaProbada ? 'bg-mal/20 text-white ring-1 ring-mal/40' : 'bg-mal/[0.06] ring-1 ring-mal/15'}`}><span className={`font-semibold ${i === 0 && !o.yaProbada ? 'text-[#FCA5A5]' : 'text-mal'}`}>Criterio de corte.</span> {o.prueba.criterioCorte}</p>
            {o.aprendizajePrevio && <p className="mt-2 rounded-[12px] bg-ojo/[0.08] px-3 py-2 text-[13px] leading-snug ring-1 ring-ojo/20"><span className="font-semibold text-ojo">Lo que ya aprendimos.</span> {o.aprendizajePrevio}</p>}
            <div className="mt-auto pt-3"><Barra pct={o.ice / maxIce} tono={o.yaProbada ? 'neutro' : 'acento'} etiqueta="Prioridad frente a la mejor" valor={`${Math.round((o.ice / maxIce) * 100)} %`} retraso={200 + i * 80} oscuro={i === 0 && !o.yaProbada} /></div>
          </li>
        ))}
      </ol>
    </>
  )
}
function Dato({ n, t, oscuro, chico }: { n: string; t: string; oscuro: boolean; chico?: boolean }) {
  return <span><span className={`num block ${chico ? 'text-[12.5px] font-semibold leading-tight' : 'cifra text-[17px]'} ${oscuro ? 'text-white' : ''}`}>{n}</span><span className={`block text-[10.5px] uppercase tracking-[0.1em] ${oscuro ? 'text-celeste' : 'text-texto-2'}`}>{t}</span></span>
}
