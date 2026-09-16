import { Suspense } from 'react'
import { motor, campanasEnPeriodo, compararSeleccion, comoNosFue } from '@/lib/datos'
import { tasaAsistencia, tasaCierre } from '@/lib/resultados'
import { guardarResultadosPautaAccion } from './acciones'
import type { CreativoDeCampana, EstadoCampana, MetricaVarias, RegistroPauta, ResumenCampana, VeredictoCampana } from '@/lib/tipos'
import { cop, num, pct, ratio } from '@/lib/format'
import { fechaCorta, fechaHora } from '@/lib/format/fechas'
import { Aviso, Barra, Etiqueta, Miniatura, Panel, Titulo, Vacio, type Tono } from '@/components/ui'
import Ordenable, { type FilaOrdenable } from '@/components/cliente/ordenable'
import { IrAResultados, SelectorComparar, SelectorPeriodo } from '@/components/cliente/campanas-url'
import BloqueBitacora from '@/components/bitacora'

/**
 * CAMPAÑAS: cada pauta con su cara (al aire, pausada, archivada) en vez de la cuenta sumada, y dos
 * de ellas lado a lado. Periodo y elección viajan en la URL; los números ya vienen calculados.
 */
const ESTADO: Record<EstadoCampana, string> = { activo: 'Activa', pausado: 'Pausada', archivado: 'Archivada', en_revision: 'En revisión', rechazado: 'Rechazada' }
const tonoEstado = (c: ResumenCampana): Tono => (c.alAire ? 'bien' : c.estado === 'rechazado' ? 'mal' : c.estado === 'en_revision' ? 'ojo' : 'neutro')
const formato = (v: number | null, u: MetricaVarias['unidad']) => (u === 'cop' ? cop(v) : u === 'porcentaje' ? pct(v) : u === 'ratio' ? ratio(v) : num(v))
const n = (t: string) => <span className="whitespace-nowrap">{t}</span>
const rango = (c: ResumenCampana) => (c.primerDia && c.ultimoDia ? <><span className="whitespace-nowrap">{fechaCorta(c.primerDia)} →</span> <span className="whitespace-nowrap">{fechaCorta(c.ultimoDia)}</span></> : '—')

export default async function Campanas({ searchParams }: { searchParams: Promise<{ periodo?: string; comparar?: string; registrar?: string; guardada?: string; error?: string }> }) {
  const { periodo, comparar, registrar, guardada, error } = await searchParams
  const r = await motor()
  const vista = campanasEnPeriodo(r, periodo)
  const ids = (comparar ?? '').split(',').filter(Boolean)
  const lado = compararSeleccion(r, ids, periodo)
  const idRegistro = registrar ?? guardada
  /* la acción redirige sin periodo: si la campaña no gastó en este, se busca en «todo» para no perder el bloque */
  const cReg = idRegistro ? (vista.campanas.find((c) => c.id === idRegistro) ?? campanasEnPeriodo(r, 'todo').campanas.find((c) => c.id === idRegistro)) : undefined
  const registro = cReg ? r.resultadosPauta.find((x) => x.campanaId === cReg.id) ?? null : null
  const como = cReg ? comoNosFue(r, cReg.id) : null
  const alAire = vista.campanas.filter((c) => c.alAire).length
  const rotuloPeriodo = `${r.cuenta.nombre} · del ${fechaCorta(vista.desde)} al ${fechaCorta(vista.hasta)}`

  const columnas = [
    { id: 'nombre', nombre: 'Campaña', ancho: '20%' }, { id: 'periodo', nombre: 'Periodo' }, { id: 'gasto', nombre: 'Inversión', num: true },
    { id: 'parte', nombre: '% del gasto', ancho: '96px' }, { id: 'conv', nombre: 'Conversa­ciones', num: true }, { id: 'res', nombre: 'Resultados', num: true },
    { id: 'cr', nombre: 'Costo por resultado', num: true }, { id: 'cc', nombre: 'Costo por conversación', num: true },
    { id: 'citas', nombre: 'Citas asistidas', num: true }, { id: 'ccita', nombre: 'Costo por cita', num: true }, { id: 'ventas', nombre: 'Ventas', num: true }, { id: 'ctr', nombre: 'Clic en el enlace', num: true }, { id: 'frec', nombre: 'Frecuencia', num: true },
  ]
  const filas: FilaOrdenable[] = vista.campanas.map((c, i) => ({
    clave: c.id,
    crudo: { nombre: c.nombre, periodo: c.primerDia, gasto: c.total.gasto, parte: c.participacionGasto, conv: c.total.conversacionesIniciadas, res: c.total.resultados, cr: c.costoResultado, cc: c.costoConversacion, citas: c.citasAsistidas, ccita: c.costoCitaAsistida, ventas: c.ventas, ctr: c.ctrEnlace, frec: c.frecuencia },
    celdas: {
      nombre: (
        <span className="flex min-w-0 items-center gap-2">
          <span className="min-w-0 grow shrink basis-0">
            <span className="line-clamp-2 w-0 min-w-full font-medium leading-tight text-texto">{c.nombre}</span>
            <span className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5"><Etiqueta tono={tonoEstado(c)}>{c.alAire ? 'Al aire' : ESTADO[c.estado]}</Etiqueta><span className="whitespace-nowrap text-[11px] text-texto-3">{c.nConjuntos} conj. · {c.nAnuncios} anuncios</span><Suspense><IrAResultados id={c.id} activo={c.id === registrar} /></Suspense></span>
          </span>
        </span>
      ),
      periodo: <span className="block leading-tight"><span className="num block">{rango(c)}</span><span className="block whitespace-nowrap text-[11px] text-texto-3">{c.diasConGasto} días con gasto</span></span>,
      gasto: <span className="whitespace-nowrap font-medium text-texto">{cop(c.total.gasto)}</span>,
      parte: <Barra pct={c.participacionGasto} tono={i === 0 ? 'acento' : 'neutro'} valor={pct(c.participacionGasto, 0)} alto={5} retraso={120 + i * 40} />,
      conv: n(num(c.total.conversacionesIniciadas)), res: n(num(c.total.resultados)), cr: n(cop(c.costoResultado)), cc: n(cop(c.costoConversacion)), citas: n(num(c.citasAsistidas)), ccita: n(cop(c.costoCitaAsistida)), ventas: n(num(c.ventas)), ctr: n(pct(c.ctrEnlace)), frec: n(ratio(c.frecuencia)),
    },
  }))

  return (
    <>
      <Titulo rotulo={`Campañas · ${rotuloPeriodo}`} extra={<Suspense><SelectorPeriodo actual={vista.periodo} /></Suspense>}>¿Cómo le fue a cada pauta?</Titulo>

      {vista.campanas.length === 0 ? (
        <Vacio titulo="Ninguna campaña gastó en este periodo" texto="Amplía el periodo con las pastillas de arriba: una pauta pausada o archivada sigue apareciendo con su historia en los días en que sí gastó." />
      ) : (
        <Panel rotulo="Las pautas" titulo={<>{vista.campanas.length} {vista.campanas.length === 1 ? 'campaña gastó' : 'campañas gastaron'} en el periodo · {alAire} al aire</>} extra={<div className="flex flex-wrap items-center gap-3"><p className="max-w-[40ch] text-[12.5px] leading-snug text-texto-2">Las pausadas y archivadas se ven igual de claras: solo cambia la etiqueta.</p><Suspense><SelectorComparar campanas={vista.campanas.map((c) => ({ id: c.id, nombre: c.nombre, estado: ESTADO[c.estado], alAire: c.alAire }))} elegidas={ids} /></Suspense></div>}>
          <Ordenable columnas={columnas} filas={filas} inicial="gasto" minAncho={960} prefijoId="campana" />
        </Panel>
      )}

      {cReg && <Resultados c={cReg} registro={registro} guardada={guardada === cReg.id} error={error} como={como} />}

      <div className="mt-4"><BloqueBitacora b={r.bitacora} retraso={100} /></div>

      <div className="mt-4 grid grid-cols-1 items-start gap-3 lg:grid-cols-12">
        <div className="min-w-0 lg:col-span-8">
          {lado.metricas.length ? <LadoALado lado={lado} /> : (
            <Panel rotulo="Comparar varias" titulo="Lado a lado" retraso={120} extra={<p className="text-[12.5px] text-texto-2">¿Cómo le fue a la de junio contra la de ahora?</p>}>
              <Vacio titulo={ids.length === 1 ? 'Falta una más' : 'Elige dos o más campañas'} texto="Arriba, en «Comparar campañas», marca las que quieras ver lado a lado: dos, tres, las que sean. La mejor de cada métrica sale resaltada." />
            </Panel>
          )}
        </div>
        <Panel rotulo="Cómo se calcula" className="lg:col-span-4" retraso={200}>
          <ul className="space-y-2 text-[13.5px] leading-relaxed text-texto-2">
            <li className="flex gap-2"><span aria-hidden="true" className="mt-[9px] h-1.5 w-1.5 shrink-0 rounded-full bg-acento" />Cada campaña suma sus propios días de pauta; los costos y tasas se recalculan desde esas sumas.</li>
            <li className="flex gap-2"><span aria-hidden="true" className="mt-[9px] h-1.5 w-1.5 shrink-0 rounded-full bg-acento" />Comparar dos que corrieron días distintos: mira costos y tasas, no las sumas.</li>
            <li className="flex gap-2"><span aria-hidden="true" className="mt-[9px] h-1.5 w-1.5 shrink-0 rounded-full bg-acento" />Una campaña pausada sigue apareciendo con su historia; solo deja de estar «al aire».</li>
          </ul>
        </Panel>
      </div>
    </>
  )
}

/** La tarjeta marina de una campaña: nombre, estado, fechas y días. */
function Ficha({ x }: { x: ResumenCampana }) {
  return (
    <div className="pieza-marina entra-zoom flex min-h-[80px] items-start gap-3 p-4">
      <span className="min-w-0">
        <span className="block text-[16px] font-medium leading-tight text-white">{x.nombre}</span>
        <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-celeste">
          <Etiqueta tono={x.alAire ? 'bien' : 'neutro'}>{x.alAire ? 'Al aire' : ESTADO[x.estado]}</Etiqueta>
          <span className="num">{rango(x)}</span><span>· {x.diasConGasto} días con gasto</span>
        </span>
      </span>
    </div>
  )
}

/** Métrica × campañas: la mejor de cada fila resaltada y, debajo de cada valor, la distancia a la mejor. */
function LadoALado({ lado }: { lado: NonNullable<ReturnType<typeof compararSeleccion>> }) {
  const corto = (c: ResumenCampana) => c.nombre.replace(/ \(.*\)$/, '')
  return (
    <Panel rotulo={`Comparar varias · ${lado.campanas.length} campañas`} titulo="Lado a lado" retraso={120} extra={lado.diasDistintos ? <Etiqueta tono="ojo">Corrieron días distintos</Etiqueta> : <Etiqueta tono="bien">Mismos días: todo se compara</Etiqueta>}>
      {lado.aviso && <Aviso tono="ojo">{lado.aviso}</Aviso>}
      <div className="sin-barra mt-3 overflow-x-auto">
        <table className="w-full text-[12.5px] sm:text-[13px]" style={{ minWidth: 200 + lado.campanas.length * 150 }}>
          <thead>
            <tr>
              <th scope="col" className="border-b border-borde pb-2 pr-2 text-left text-[10.5px] font-semibold uppercase tracking-[0.16em] text-texto-2 sm:pr-3">Métrica</th>
              {lado.campanas.map((c) => (
                <th key={c.id} scope="col" className="border-b border-borde pb-2 pr-2 text-right align-bottom sm:pr-3">
                  <span className="block text-[12.5px] font-medium normal-case tracking-normal text-texto">{corto(c)}</span>
                  <span className="mt-0.5 flex items-center justify-end gap-1.5 text-[11px] font-normal normal-case tracking-normal text-texto-3"><Etiqueta tono={c.alAire ? 'bien' : 'neutro'}>{c.alAire ? 'Al aire' : ESTADO[c.estado]}</Etiqueta>{c.diasConGasto} d</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {lado.metricas.map((m) => (
              <tr key={m.id} className={`transition-colors hover:bg-superficie-2/60 ${m.comparable ? '' : 'text-texto-3'}`}>
                <td className="border-b border-borde/70 py-2 pr-2 leading-snug sm:pr-3">{m.nombre}{!m.comparable && <span className="ml-1.5 hidden whitespace-nowrap text-[11px] sm:inline">· suma, no se compara</span>}</td>
                {m.valores.map((v, i) => {
                  const mejor = m.mejorIndice === i
                  const d = m.deltasFrenteAlMejor[i]
                  return (
                    <td key={lado.campanas[i]!.id} className={`num whitespace-nowrap border-b border-borde/70 py-2 pr-2 text-right align-top sm:pr-3 ${mejor ? 'bg-bien/10 font-semibold text-texto' : m.comparable ? 'text-texto' : ''}`}>
                      {formato(v, m.unidad)}
                      {m.comparable && m.mejorIndice != null && (
                        <span className={`block text-[11px] font-normal ${mejor ? 'text-bien' : 'text-texto-3'}`}>{mejor ? 'mejor' : d == null ? '—' : `${d > 0 ? '+' : d < 0 ? '−' : ''}${pct(Math.abs(d))}`}</span>
                      )}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  )
}

const TONO_VEREDICTO: Record<VeredictoCampana['veredicto'], Tono> = { sirvio: 'bien', no_sirvio: 'mal', a_medias: 'ojo', sin_resultados: 'neutro' }
const TONO_CUADRANTE = (q: CreativoDeCampana['cuadrante']): Tono => (q === 'escalar' ? 'bien' : q === 'matar' ? 'mal' : q === 'sin_senal' ? 'neutro' : 'ojo')
const FONDO: Record<Tono, string> = { bien: 'bg-bien/10 ring-bien/25', mal: 'bg-mal/10 ring-mal/25', ojo: 'bg-ojo/10 ring-ojo/25', acento: 'bg-acento/10 ring-acento/25', neutro: 'bg-superficie-2 ring-borde' }
const TEXTO: Record<Tono, string> = { bien: 'text-bien', mal: 'text-mal', ojo: 'text-ojo', acento: 'text-acento', neutro: 'text-texto-2' }

/** El veredicto en grande, sus razones tal cual vienen, y qué funcionó de lo que se subió. */
function ComoNosFue({ como }: { como: { veredicto: VeredictoCampana; creativos: CreativoDeCampana[] } }) {
  const v = como.veredicto
  const tono = TONO_VEREDICTO[v.veredicto]
  return (
    <div className="mt-4 border-t border-borde pt-4">
      <p className="rotulo">Cómo nos fue</p>
      <div className={`mt-2 rounded-[16px] p-4 ring-1 ${FONDO[tono]}`}>
        <p className={`text-[clamp(1.2rem,2vw,1.6rem)] font-medium leading-tight ${TEXTO[tono]}`}>{v.titulo}</p>
        <ul className="mt-2.5 space-y-1.5 text-[13.5px] leading-relaxed text-texto">
          {v.razones.map((z) => <li key={z} className="flex gap-2"><span aria-hidden="true" className={`mt-[9px] h-1.5 w-1.5 shrink-0 rounded-full ${tono === 'neutro' ? 'bg-texto-3' : TEXTO[tono].replace('text-', 'bg-')}`} />{z}</li>)}
        </ul>
      </div>
      {v.faltan && <Aviso tono="ojo" className="mt-3">{v.faltan}</Aviso>}
      <p className="rotulo mt-4">Lo que se subió</p>
      {como.creativos.length === 0 ? (
        <p className="mt-2 rounded-[14px] bg-superficie-2 px-4 py-6 text-center text-[13px] text-texto-2">Esta campaña no tiene creativos evaluados en el periodo.</p>
      ) : (
        <ul className="mt-2 grid grid-cols-1 gap-3 md:grid-cols-2">
          {como.creativos.map((k) => {
            const t = TONO_CUADRANTE(k.cuadrante)
            return (
              <li key={k.anuncioId} className="pieza flex gap-3 p-3">
                <Miniatura url={k.urlMiniatura} tipo={k.formato} alt={`Miniatura de «${k.nombre}»`} className="h-24 w-20 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-[13.5px] font-medium leading-tight text-texto">{k.nombre}</p>
                  <p className={`mt-1 text-[12.5px] leading-snug ${TEXTO[t]}`}>{k.lectura}</p>
                  <dl className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[12px] text-texto-2">
                    <div><dt className="inline">Inversión </dt><dd className="num inline text-texto">{cop(k.gasto)}</dd></div>
                    <div><dt className="inline">Por resultado </dt><dd className="num inline text-texto">{cop(k.costoResultado)}</dd></div>
                    <div><dt className="inline">Clic en el enlace </dt><dd className="num inline text-texto">{pct(k.ctrEnlace)}</dd></div>
                  </dl>
                  <p className="mt-1.5 text-[11.5px] text-texto-3">{k.accion}</p>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

/** Los cinco números que Meta no ve. Formulario HTML nativo hacia la acción; nada de fetch. */
const CASILLAS: { name: string; rotulo: string; ayuda: string; valor: (r: RegistroPauta) => number | null; opcional?: boolean }[] = [
  { name: 'contactosCerrados', rotulo: 'Contactos cerrados', ayuda: 'Personas que escribieron y sí eran candidatas.', valor: (r) => r.contactosCerrados },
  { name: 'citasAgendadas', rotulo: 'Citas agendadas', ayuda: 'Valoraciones o procedimientos que quedaron en la agenda.', valor: (r) => r.citasAgendadas },
  { name: 'citasAsistidas', rotulo: 'Citas asistidas', ayuda: 'Las que de verdad llegaron a la clínica.', valor: (r) => r.citasAsistidas },
  { name: 'ventas', rotulo: 'Ventas', ayuda: 'Personas que pagaron un procedimiento tras la cita.', valor: (r) => r.ventas },
  { name: 'valorVentasCOP', rotulo: 'Valor vendido (pesos)', ayuda: 'Suma de lo facturado. Si no se sabe, en blanco.', valor: (r) => r.valorVentasCOP, opcional: true },
]
function Resultados({ c, registro, guardada, error, como }: { c: ResumenCampana; registro: RegistroPauta | null; guardada: boolean; error?: string; como: { veredicto: VeredictoCampana; creativos: CreativoDeCampana[] } | null }) {
  const asistencia = registro ? tasaAsistencia(registro) : null
  const cierre = registro ? tasaCierre(registro) : null
  return (
    <div id="resultados" className="mt-4 scroll-mt-20">
      <Panel rotulo="Resultados de la campaña · lo que Meta no ve" titulo={registro ? 'Corregir resultados' : 'Anotar resultados'} retraso={80} extra={registro ? <span className="flex flex-wrap items-center gap-1.5"><Etiqueta tono="neutro">registrados el {fechaHora(registro.registradoEn)}</Etiqueta><Etiqueta tono="acento">asisten {pct(asistencia, 0)}</Etiqueta><Etiqueta tono="bien">cierran {pct(cierre, 0)}</Etiqueta></span> : undefined}>
        <Ficha x={c} />
        {guardada && <Aviso tono="bien" className="mt-3">Resultados de «{c.nombre}» guardados. La tabla, la comparación y «Cómo nos fue» ya los usan.</Aviso>}
        {error && <Aviso tono="mal" className="mt-3">{error}</Aviso>}
        <form action={guardarResultadosPautaAccion} className="mt-3">
          <input type="hidden" name="campana" value={c.id} />
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {CASILLAS.map((k) => (
              <label key={k.name} className="block rounded-[14px] bg-superficie-2 p-3 ring-1 ring-borde transition-[box-shadow] focus-within:ring-2 focus-within:ring-acento">
                <span className="flex items-baseline justify-between gap-2"><span className="text-[13px] font-medium text-texto">{k.rotulo}</span>{k.opcional && <span className="text-[11px] text-texto-3">opcional</span>}</span>
                <input name={k.name} inputMode="numeric" required={!k.opcional} defaultValue={registro && k.valor(registro) != null ? (k.name === 'valorVentasCOP' ? num(k.valor(registro)) : String(k.valor(registro))) : ''} placeholder={k.opcional ? '—' : '0'} className="num mt-1.5 block w-full bg-transparent text-[28px] font-medium leading-none text-texto outline-none placeholder:text-texto-3" />
                <span className="mt-1.5 block text-[12px] leading-snug text-texto-2">{k.ayuda}</span>
              </label>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <p className="max-w-[60ch] text-[12px] leading-snug text-texto-3">Solo cantidades. Ni nombres, ni teléfonos, ni notas: aquí no caben y el sistema los rechaza.</p>
            <button type="submit" className="rounded-full bg-marino px-5 py-2.5 text-[13px] font-medium text-white transition-[box-shadow,transform] duration-300 hover:-translate-y-px hover:shadow-[0_12px_24px_-12px_rgba(11,29,58,0.6)]">Guardar resultados</button>
          </div>
        </form>
        {como && <ComoNosFue como={como} />}
      </Panel>
    </div>
  )
}
