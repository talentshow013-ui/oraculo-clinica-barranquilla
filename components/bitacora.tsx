import Link from 'next/link'
import type { ResumenBitacora } from '@/lib/tipos'
import { num } from '@/lib/format'
import { fechaCorta } from '@/lib/format/fechas'
import { Aviso, Barra, Celda, Etiqueta, Panel, Tabla, Th } from '@/components/ui'

/**
 * QUIÉN CAMBIÓ QUÉ. El historial de cambios de Meta, resumido: personas que operan, campañas que se
 * prenden y apagan, y el ritmo por semana. Es la explicación de muchas caídas que «nadie tocó».
 */
export default function BloqueBitacora({ b, retraso = 0 }: { b: { reciente: ResumenBitacora; periodo: ResumenBitacora } | null; retraso?: number }) {
  if (!b) {
    return (
      <Panel id="bitacora" rotulo="Quién cambió qué" titulo="Historial de cambios de la cuenta" retraso={retraso}>
        <Aviso tono="neutro">Meta no entregó historial de cambios para esta cuenta (el conector lo está habilitando cuenta por cuenta). No se inventa: cuando llegue, aparece aquí.</Aviso>
      </Panel>
    )
  }
  const r = b.reciente
  const maxSemana = Math.max(1, ...b.periodo.porSemana.map((s) => s.cambios))
  const maxActor = Math.max(1, ...r.porActor.map((a) => a.cambios))
  return (
    <Panel id="bitacora" rotulo={`Quién cambió qué · últimos 14 días (${fechaCorta(r.desde)} – ${fechaCorta(r.hasta)})`} titulo={`${num(r.total)} cambios entre ${num(r.porActor.length)} ${r.porActor.length === 1 ? 'persona' : 'personas'}`} retraso={retraso} extra={<p className="max-w-[44ch] text-[12.5px] leading-snug text-texto-2">Fuente: historial de cambios de Meta (el mismo del administrador de anuncios). Cada apagado/prendido reinicia el aprendizaje de la campaña.</p>}>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <div className="lg:col-span-5">
          <p className="rotulo">Por persona</p>
          <ul className="mt-2 flex flex-col gap-1.5">
            {r.porActor.slice(0, 8).map((a, i) => (
              <li key={a.actor} className="grid grid-cols-[160px_minmax(0,1fr)] items-center gap-2 text-[13px]">
                <span className="truncate font-medium" title={a.actor}>{a.actor}</span>
                <Barra pct={a.cambios / maxActor} tono={a.actor === 'Meta' ? 'neutro' : 'acento'} valor={`${num(a.cambios)} · ${num(a.apagados)} apagó · ${num(a.prendidos)} prendió`} alto={8} retraso={80 + i * 40} />
              </li>
            ))}
          </ul>
          {(b.periodo.personasAgregadas > 0 || b.periodo.personasEliminadas > 0) && (
            <p className="mt-3 text-[12.5px] text-texto-2">En todo el periodo se agregaron <span className="font-semibold text-texto">{num(b.periodo.personasAgregadas)}</span> personas a la cuenta y se quitaron {num(b.periodo.personasEliminadas)}.</p>
          )}
          <p className="rotulo mt-4">Cambios por semana · todo el periodo</p>
          <ul className="mt-2 flex flex-col gap-1">
            {b.periodo.porSemana.map((s, i) => (
              <li key={s.semana} className="grid grid-cols-[64px_1fr] items-center gap-2 text-[12px]"><span className="num text-texto-2">{s.semana.slice(5)}</span><Barra pct={s.cambios / maxSemana} tono="neutro" valor={`${num(s.cambios)} cambios · ${num(s.actores)} personas`} alto={6} retraso={60 + i * 30} /></li>
            ))}
          </ul>
        </div>
        <div className="lg:col-span-7">
          <p className="rotulo">Campañas y conjuntos que más se prendieron y apagaron</p>
          {r.interruptores.length === 0 ? (
            <p className="mt-2 text-[13px] text-texto-2">Ninguna campaña cambió de estado en estos 14 días.</p>
          ) : (
            <Tabla minAncho={520} className="mt-2">
              <thead><tr><Th>Campaña / conjunto</Th><Th num>Apagados</Th><Th num>Prendidos</Th><Th>Quiénes</Th><Th>Último</Th></tr></thead>
              <tbody>
                {r.interruptores.slice(0, 10).map((i) => (
                  <tr key={`${i.objetoTipo}-${i.objetoId}`} className={i.apagados + i.prendidos >= 3 ? 'bg-mal/[0.04]' : ''}>
                    <Celda>
                      <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                        {i.campanaId ? <Link href={`/campanas#campana-${i.campanaId}`} className="font-medium text-acento decoration-acento underline-offset-2 hover:underline">{i.nombre.slice(0, 70)}</Link> : <span className="font-medium">{i.nombre.slice(0, 70)}</span>}
                        {i.apagados + i.prendidos >= 3 && <Etiqueta tono="mal" titulo="Tres o más cambios de estado en 14 días: cada uno reinicia el aprendizaje de la campaña">reinicia aprendizaje</Etiqueta>}
                      </span>
                      <span className="block text-[11px] text-texto-3">{i.objetoTipo === 'campana' ? 'campaña' : 'conjunto'}</span>
                    </Celda>
                    <Celda num tono={i.apagados >= 2 ? 'mal' : undefined}>{num(i.apagados)}</Celda>
                    <Celda num>{num(i.prendidos)}</Celda>
                    <Celda><span className="text-[12px]">{i.actores.join(', ')}</span></Celda>
                    <Celda><span className="num text-[12px]">{fechaCorta(i.ultimo)}</span></Celda>
                  </tr>
                ))}
              </tbody>
            </Tabla>
          )}
        </div>
      </div>
    </Panel>
  )
}
