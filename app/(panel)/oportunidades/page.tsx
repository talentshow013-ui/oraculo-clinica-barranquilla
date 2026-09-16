import type { CSSProperties } from 'react'
import Link from 'next/link'
import { motor } from '@/lib/datos'
import { cop } from '@/lib/format'
import { ANGULOS } from '@/lib/format/etiquetas'
import type { Oportunidad } from '@/lib/opportunities'
import { Aviso, Barra, Etiqueta, Titulo } from '@/components/ui'

const ORIGEN = { hallazgo: 'Sale de un hallazgo de tus datos', espacio_vacio: 'Sale de un espacio vacío del mercado', ganador_mercado: 'Sale de un ganador del mercado' }

/**
 * OPORTUNIDADES: hipótesis, prueba y criterio de corte. Sin criterio de corte no es una idea, es una corazonada.
 * Dos bloques que nunca se mezclan: lo que nace del análisis de los datos propios y lo que nace de mirar al mercado.
 */
export default async function Oportunidades() {
  const r = await motor()
  const propias = r.oportunidades.filter((o) => o.ambito === 'propio')
  const mercado = r.oportunidades.filter((o) => o.ambito === 'mercado')
  const maxIce = Math.max(1, ...r.oportunidades.map((o) => o.ice))
  return (
    <>
      <Titulo rotulo="Oportunidades · ordenadas por impacto × confianza ÷ esfuerzo" extra={<p className="text-[12.5px] text-texto-2">{r.oportunidades.filter((o) => o.yaProbada).length} ya probadas y marcadas</p>}>Qué probar, con su corte</Titulo>

      <section aria-labelledby="propias">
        <div className="mb-2 flex flex-wrap items-end justify-between gap-2">
          <div>
            <p className="rotulo">Bloque 1 · sale de tus propios datos</p>
            <h2 id="propias" className="text-[18px]">Lo que tus números piden probar</h2>
          </div>
          <p className="max-w-[52ch] text-[12.5px] text-texto-2">Cada una nace de un hallazgo del Diagnóstico. «Ver el dato» abre la tabla exacta en la que se basa.</p>
        </div>
        {propias.length === 0 ? (
          <Aviso tono="neutro">Ningún hallazgo con plantilla de prueba en este periodo.</Aviso>
        ) : (
          <ol className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {propias.map((o, i) => <Tarjeta key={o.id} o={o} i={i} destacada={i === 0 && !o.yaProbada} maxIce={maxIce} />)}
          </ol>
        )}
      </section>

      <section aria-labelledby="mercado" className="mt-8">
        <div className="mb-2 flex flex-wrap items-end justify-between gap-2">
          <div>
            <p className="rotulo">Bloque 2 · sale del mercado, no de tus datos</p>
            <h2 id="mercado" className="text-[18px]">Lo que hace la competencia y tú no</h2>
          </div>
          <p className="max-w-[52ch] text-[12.5px] text-texto-2">Viene del Radar (Biblioteca de anuncios de Meta, pública). Cada tarjeta tiene su enlace para verificar afuera lo que aquí se afirma.</p>
        </div>
        {r.radar.sinDatos ? (
          <Aviso tono="neutro">Todavía no se ha capturado la competencia. Se hace en la sincronización semanal.</Aviso>
        ) : mercado.length === 0 ? (
          <Aviso tono="neutro">El radar no propone nada nuevo en este periodo.</Aviso>
        ) : (
          <ol className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {mercado.map((o, i) => <Tarjeta key={o.id} o={o} i={i} destacada={false} maxIce={maxIce} />)}
          </ol>
        )}
      </section>
    </>
  )
}

function Tarjeta({ o, i, destacada, maxIce }: { o: Oportunidad; i: number; destacada: boolean; maxIce: number }) {
  const oscuro = destacada
  return (
    <li className={`${o.yaProbada ? 'pieza opacity-80' : oscuro ? 'pieza-marina lg:col-span-2' : 'pieza'} entra-zoom flex flex-col p-4 sm:p-5`} style={{ '--retraso': `${60 + i * 80}ms` } as CSSProperties}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className={`rotulo ${oscuro ? 'text-celeste' : ''}`}>{ORIGEN[o.origen]} · {o.tipoPrueba}</p>
          <h3 className={`mt-1 text-[clamp(1.05rem,1.5vw,1.25rem)] leading-tight ${oscuro ? 'text-white' : ''}`}>{o.titulo}</h3>
        </div>
        <span className="flex shrink-0 flex-col items-end"><span className={`cifra num text-[26px] ${oscuro ? 'text-white' : ''}`}>{o.ice}</span><span className={`text-[10.5px] uppercase tracking-[0.12em] ${oscuro ? 'text-celeste' : 'text-texto-2'}`}>prioridad</span></span>
      </div>
      <p className={`mt-2 text-[13.5px] leading-snug ${oscuro ? 'text-[#EAF2FF]' : ''}`}>{o.hipotesis}</p>
      <div className="mt-2 flex flex-wrap gap-1">
        {o.basadaEn.map((b) => <Etiqueta key={b} tono={oscuro ? 'acento' : 'neutro'}>{b}</Etiqueta>)}
        {o.angulo && <Etiqueta tono="acento">{ANGULOS[o.angulo]}</Etiqueta>}
        {o.yaProbada && <Etiqueta tono="ojo">Ya se probó</Etiqueta>}
      </div>
      <div className={`mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[12.5px] font-medium ${oscuro ? 'text-celeste' : 'text-acento'}`}>
        <Link href={o.verEn}>{o.ambito === 'propio' ? 'Ver el dato en el panel →' : 'Ver en el Radar →'}</Link>
        {o.verificar && <a href={o.verificar} target="_blank" rel="noopener noreferrer">Verificar en la Biblioteca de anuncios de Meta ↗</a>}
      </div>
      <div className={`mt-3 grid grid-cols-2 gap-2 rounded-[14px] p-3 sm:grid-cols-4 ${oscuro ? 'bg-white/[0.07] ring-1 ring-white/10' : 'bg-superficie-2'}`}>
        <Dato oscuro={oscuro} n={o.prueba.presupuestoCOP ? cop(o.prueba.presupuestoCOP) : 'Sin costo'} t="presupuesto" />
        <Dato oscuro={oscuro} n={`${o.prueba.duracionDias} días`} t="duración" />
        <Dato oscuro={oscuro} n={o.prueba.metricaExito} t="éxito si" chico />
        <Dato oscuro={oscuro} n={`${o.impacto}·${o.confianza}·${o.esfuerzo}`} t="impacto · confianza · esfuerzo" />
      </div>
      <p className={`mt-2.5 rounded-[12px] px-3 py-2 text-[13px] leading-snug ${oscuro ? 'bg-mal/20 text-white ring-1 ring-mal/40' : 'bg-mal/[0.06] ring-1 ring-mal/15'}`}><span className={`font-semibold ${oscuro ? 'text-[#FCA5A5]' : 'text-mal'}`}>Criterio de corte.</span> {o.prueba.criterioCorte}</p>
      {o.aprendizajePrevio && <p className="mt-2 rounded-[12px] bg-ojo/[0.08] px-3 py-2 text-[13px] leading-snug ring-1 ring-ojo/20"><span className="font-semibold text-ojo">Lo que ya aprendimos.</span> {o.aprendizajePrevio}</p>}
      <div className="mt-auto pt-3"><Barra pct={o.ice / maxIce} tono={o.yaProbada ? 'neutro' : 'acento'} etiqueta="Prioridad frente a la mejor" valor={`${Math.round((o.ice / maxIce) * 100)} %`} retraso={200 + i * 80} oscuro={oscuro} /></div>
    </li>
  )
}

function Dato({ n, t, oscuro, chico }: { n: string; t: string; oscuro: boolean; chico?: boolean }) {
  return <span><span className={`num block ${chico ? 'text-[12.5px] font-semibold leading-tight' : 'cifra text-[17px]'} ${oscuro ? 'text-white' : ''}`}>{n}</span><span className={`block text-[10.5px] uppercase tracking-[0.1em] ${oscuro ? 'text-celeste' : 'text-texto-2'}`}>{t}</span></span>
}
