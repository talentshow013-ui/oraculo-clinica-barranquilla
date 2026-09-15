import Link from 'next/link'
import type { CSSProperties } from 'react'
import { motor } from '@/lib/datos'
import { cop, num } from '@/lib/format'
import { PASOS, SEVERIDADES } from '@/lib/format/etiquetas'
import { Etiqueta, Grid, Kpi, Panel, Titulo, tonoSeveridad } from '@/components/ui'
import Contar from '@/components/cliente/contar'
import EmbudoBarras from '@/components/graficas/embudo'
import Serie from '@/components/graficas/serie'

/** CENTRO DE MANDO: en cinco segundos, plata en riesgo, 3–5 hallazgos con acción, la fuga más cara y el próximo experimento. */
export default async function CentroDeMando() {
  const r = await motor()
  const top = r.hallazgos.slice(0, 5)
  const experimento = r.oportunidades.find((o) => !o.yaProbada) ?? r.oportunidades[0]
  return (
    <>
      <Titulo rotulo={`Centro de mando · ${r.cliente.nombre}`} extra={<p className="text-[12.5px] text-texto-2">{r.hallazgos.length} hallazgos abiertos · {r.oportunidades.filter((o) => !o.yaProbada).length} pruebas por hacer</p>}>Cómo va y qué hacer hoy</Titulo>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-12">
        <section className="pieza-marina rejilla-marina entra relative overflow-hidden p-5 sm:p-6 lg:col-span-7" aria-label="Plata en riesgo">
          <div aria-hidden="true" className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-mal/30 blur-3xl" />
          <div className="relative">
            <p className="rotulo text-celeste">Plata en riesgo · suma de los hallazgos abiertos</p>
            <p className="cifra num mt-2 text-[clamp(44px,6vw,84px)] text-white"><Contar valor={r.plataEnRiesgoTotal} unidad="cop" duracion={1500} /></p>
            <p className="mt-2 max-w-[52ch] text-[13.5px] leading-snug text-celeste">Es lo que se está perdiendo en el periodo entre citas que no llegan, pauta fuera del radio y del horario, y un creativo agotado. Cada peso tiene su hallazgo y su acción abajo.</p>
            <div className="mt-5 grid grid-cols-3 gap-2">
              <Dato n={r.fugaMasCara ? cop(r.fugaMasCara.fugaCOP) : '—'} t={r.fugaMasCara ? `fuga más cara · ${PASOS[r.fugaMasCara.paso].toLowerCase()}` : 'fuga más cara'} />
              <Dato n={String(r.hallazgos.filter((h) => h.severidad === 'alta').length)} t="hallazgos críticos o altos" />
              <Dato n={r.negocio.poas == null ? '—' : `${r.negocio.poas.toFixed(1).replace('.', ',')}×`} t="retorno sobre margen" />
            </div>
          </div>
        </section>

        <div className="flex flex-col gap-3 lg:col-span-5">
          <Panel rotulo="Próximo experimento" titulo={experimento?.titulo ?? '—'} tono="hielo" retraso={120} className="flex-1">
            {experimento && (
              <>
                <p className="text-[13px] leading-snug text-texto-2">{experimento.hipotesis}</p>
                <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                  <span className="rounded-[12px] bg-superficie p-2 ring-1 ring-borde"><span className="cifra num block text-[18px]">{experimento.prueba.presupuestoCOP ? cop(experimento.prueba.presupuestoCOP) : 'Sin costo'}</span><span className="text-[10.5px] uppercase tracking-[0.12em] text-texto-2">presupuesto</span></span>
                  <span className="rounded-[12px] bg-superficie p-2 ring-1 ring-borde"><span className="cifra num block text-[18px]">{experimento.prueba.duracionDias} d</span><span className="text-[10.5px] uppercase tracking-[0.12em] text-texto-2">duración</span></span>
                  <span className="rounded-[12px] bg-superficie p-2 ring-1 ring-borde"><span className="cifra num block text-[18px]">{experimento.ice}</span><span className="text-[10.5px] uppercase tracking-[0.12em] text-texto-2">prioridad</span></span>
                </div>
                <p className="mt-2.5 text-[12.5px] text-texto-2"><span className="font-semibold text-texto">Corte:</span> {experimento.prueba.criterioCorte}</p>
                <Link href="/oportunidades" className="group mt-3 inline-flex items-center gap-2 text-[13px] font-medium text-acento">Todas las pruebas <span className="transition-transform group-hover:translate-x-0.5">→</span></Link>
              </>
            )}
          </Panel>
        </div>
      </div>

      <section className="mt-5" aria-label="Métricas maestras">
        <div className="mb-3 flex items-end justify-between gap-3">
          <div><p className="rotulo">Instrumentos · últimos 14 días contra los 14 anteriores</p><h2 className="mt-0.5 text-[19px]">Las {r.maestras.length} cifras que mandan</h2></div>
          <Link href="/metricas" className="text-[13px] font-medium text-acento">Todas las métricas →</Link>
        </div>
        <Grid cols={6}>
          {r.maestras.map((m, i) => <Kpi key={m.id} nombre={m.nombre} valor={typeof m.valor === 'number' ? m.valor : null} unidad={m.unidad} reciente={m.valorReciente} previo={m.valorReciente !== undefined ? m.valorPrevio : undefined} mejorEs={m.mejorEs} formula={m.formula} porQueImporta={m.porQueImporta} retraso={80 + i * 35} />)}
        </Grid>
        <p className="mt-2 text-[12px] text-texto-3">Costo por cita, costo por paciente y retorno aparecen aquí cuando se anotan resultados en Campañas.</p>
      </section>

      <div className="mt-5 grid grid-cols-1 gap-3 lg:grid-cols-12">
        <Panel rotulo="Hallazgos · ordenados por plata" titulo="Qué está pasando y qué hacer" className="lg:col-span-7" retraso={200} extra={<Link href="/diagnostico" className="text-[13px] font-medium text-acento">Con toda la evidencia →</Link>}>
          <ol className="flex flex-col gap-2">
            {top.map((h, i) => (
              <li key={h.reglaId} className={`${i % 2 ? 'entra-der' : 'entra-izq'} brilla grid grid-cols-[4px_1fr] gap-3 rounded-[14px] bg-superficie-2/60 p-3`} style={{ '--retraso': `${260 + i * 90}ms` } as CSSProperties}>
                <span className={`rounded-full ${h.severidad === 'alta' ? 'bg-mal' : h.severidad === 'media' ? 'bg-ojo' : 'bg-borde-fuerte'}`} aria-hidden="true" />
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-[14.5px] leading-snug">{h.titulo}</p>
                    <span className={`num shrink-0 text-[15px] font-semibold ${h.plataEnRiesgo ? 'text-mal' : 'text-texto-3'}`}>{h.plataEnRiesgo ? cop(h.plataEnRiesgo) : 'sin plata directa'}</span>
                  </div>
                  <p className="mt-1 text-[12.5px] text-texto-2"><span className="font-semibold text-texto">Hacer:</span> {h.acciones[0]}</p>
                  <div className="mt-1.5 flex flex-wrap gap-1"><Etiqueta tono={tonoSeveridad(h.severidad)}>{SEVERIDADES[h.severidad]}</Etiqueta>{h.evidencia.slice(0, 2).map((e) => <Etiqueta key={e.etiqueta} tono="neutro">{e.etiqueta}: {e.valor}</Etiqueta>)}</div>
                </div>
              </li>
            ))}
          </ol>
        </Panel>
        <div className="flex flex-col gap-3 lg:col-span-5">
          <Panel rotulo="Dónde se pierde la plata" titulo="El embudo, en pesos" retraso={260} extra={<Link href="/embudo" className="text-[13px] font-medium text-acento">Abrir →</Link>}>
            <EmbudoBarras pasos={r.embudo} peor={r.fugaMasCara} compacto />
          </Panel>
          <Panel rotulo="Inversión diaria · 60 días" titulo={`${cop(r.reciente.gasto)} en los últimos 14`} retraso={320}>
            <Serie datos={r.serie} campo="gasto" unidad="cop" alto={170} dias={60} />
            <p className="mt-1 text-[11.5px] text-texto-3">{r.contexto.huecos.length} {r.contexto.huecos.length === 1 ? 'día rayado: sin datos' : 'días rayados: sin datos'} · no se rellenan · {num(r.total.impresiones)} impresiones en el periodo</p>
          </Panel>
        </div>
      </div>
    </>
  )
}
function Dato({ n, t }: { n: string; t: string }) {
  return <span className="rounded-[14px] bg-white/[0.07] p-3 ring-1 ring-white/10"><span className="cifra num block text-[clamp(16px,1.6vw,22px)] text-white">{n}</span><span className="mt-0.5 block text-[11px] leading-tight text-celeste">{t}</span></span>
}
