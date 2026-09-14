import { motor } from '@/lib/datos'
import { semanasRecientes, tasaAsistencia, tasaCierre } from '@/lib/agenda'
import { cop, num, pct } from '@/lib/format'
import { fechaCorta, fechaHora } from '@/lib/format/fechas'
import { Aviso, Celda, Etiqueta, Panel, Tabla, Th, Titulo, Vacio } from '@/components/ui'
import { guardarSemanaAccion } from './acciones'

/**
 * AGENDA SEMANAL: lo que Meta no ve. Cinco números por semana, dos minutos cada lunes. Con esto el
 * embudo llega hasta la venta y la fuga se pone en pesos. Sin nombres, sin planillas.
 */
const CAMPOS: { id: string; nombre: string; ayuda: string; opcional?: boolean }[] = [
  { id: 'contactosCalificados', nombre: 'Contactos calificados', ayuda: 'Personas que escribieron y sí eran candidatas (no spam, no curiosos).' },
  { id: 'citasAgendadas', nombre: 'Citas agendadas', ayuda: 'Valoraciones o procedimientos que quedaron en la agenda.' },
  { id: 'citasAsistidas', nombre: 'Citas asistidas', ayuda: 'Las que de verdad llegaron a la clínica.' },
  { id: 'ventas', nombre: 'Ventas', ayuda: 'Personas que pagaron un procedimiento tras la cita.' },
  { id: 'valorVentasCOP', nombre: 'Valor vendido (pesos)', ayuda: 'Suma de lo facturado a esas personas. Si no se sabe, en blanco.', opcional: true },
  { id: 'recompras', nombre: 'Recompras', ayuda: 'Pacientes anteriores que volvieron a comprar. Si no se lleva, en blanco.', opcional: true },
]

export default async function Agenda({ searchParams }: { searchParams: Promise<{ semana?: string; guardada?: string; error?: string }> }) {
  const { semana, guardada, error } = await searchParams
  const r = await motor()
  const opciones = semanasRecientes(r.hoy, 10)
  const elegida = opciones.find((s) => s.desde === semana) ?? opciones[0]!
  const existente = r.agenda.find((s) => s.desde === elegida.desde)
  const valor = (id: string) => (existente ? ((existente as unknown as Record<string, number | null>)[id] ?? '') : '')
  const campo = 'num w-full rounded-[12px] border border-borde bg-superficie px-3 py-2 text-[15px] text-texto outline-none ring-acento/30 focus:border-acento focus:ring-4'

  return (
    <>
      <Titulo rotulo="Agenda semanal · lo que Meta no ve" extra={<p className="max-w-[46ch] text-[12.5px] leading-snug text-texto-2">Cada lunes, cinco números de la semana anterior. Con eso el embudo llega hasta la venta y la fuga se muestra en pesos.</p>}>¿Qué pasó después de la conversación?</Titulo>

      {guardada && <Aviso tono="bien" className="mb-3">Semana del {fechaCorta(guardada)} guardada. El panel ya la está usando.</Aviso>}
      {error && <Aviso tono="mal" className="mb-3">No se guardó: {error}.</Aviso>}

      <div className="grid grid-cols-1 items-start gap-3 lg:grid-cols-12">
        <Panel rotulo="Registrar" titulo={existente ? 'Corregir una semana ya registrada' : 'Una semana nueva'} className="lg:col-span-7">
          <form action={guardarSemanaAccion} className="space-y-4">
            <label className="block">
              <span className="rotulo">Semana (lunes a domingo)</span>
              <select name="semana" defaultValue={elegida.desde} className={`${campo} mt-1.5`}>
                {opciones.map((s) => {
                  const hecha = r.agenda.some((a) => a.desde === s.desde)
                  return <option key={s.desde} value={s.desde}>{fechaCorta(s.desde)} → {fechaCorta(s.hasta)}{hecha ? ' · registrada' : ''}</option>
                })}
              </select>
              <span className="mt-1 block text-[11.5px] text-texto-3">Para corregir otra semana, elígela en la tabla de la derecha.</span>
            </label>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {CAMPOS.map((c) => (
                <label key={c.id} className="block">
                  <span className="rotulo">{c.nombre}{c.opcional && <span className="ml-1 font-normal normal-case tracking-normal text-texto-3">· opcional</span>}</span>
                  <input name={c.id} type="text" inputMode="numeric" pattern="[0-9.\s]*" defaultValue={valor(c.id)} placeholder={c.opcional ? '—' : '0'} required={!c.opcional} className={`${campo} mt-1.5`} />
                  <span className="mt-1 block text-[11.5px] leading-snug text-texto-3">{c.ayuda}</span>
                </label>
              ))}
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-borde pt-3">
              <p className="text-[12px] leading-snug text-texto-3">Solo cantidades. Ni nombres, ni teléfonos, ni notas: aquí no caben y el sistema los rechaza.</p>
              <button type="submit" className="rounded-full bg-marino px-5 py-2 text-[13.5px] font-medium text-white shadow-[0_10px_20px_-12px_rgba(11,29,58,0.8)] transition-transform hover:-translate-y-px">Guardar semana</button>
            </div>
          </form>
        </Panel>

        <Panel rotulo="Registradas" titulo={r.agenda.length ? `${r.agenda.length} ${r.agenda.length === 1 ? 'semana' : 'semanas'}` : 'Todavía ninguna'} className="lg:col-span-5" retraso={120}>
          {r.agenda.length === 0 ? (
            <Vacio titulo="El embudo termina en la conversación" texto="Mientras no haya semanas registradas, cita, asistencia y venta se muestran como «—». Registra la semana pasada para empezar." />
          ) : (
            <Tabla minAncho={420}>
              <thead><tr><Th>Semana</Th><Th num>Agendadas</Th><Th num>Asistieron</Th><Th num>Ventas</Th><Th num>Valor</Th></tr></thead>
              <tbody>
                {r.agenda.map((s) => {
                  const asis = tasaAsistencia(s)
                  return (
                    <tr key={s.desde}>
                      <Celda>
                        <a href={`/agenda?semana=${s.desde}`} className="font-medium text-texto underline-offset-2 hover:underline">{fechaCorta(s.desde)} → {fechaCorta(s.hasta)}</a>
                        <span className="block text-[11px] text-texto-3">registrada {fechaHora(s.registradoEn)}</span>
                      </Celda>
                      <Celda num>{num(s.citasAgendadas)}</Celda>
                      <Celda num>{num(s.citasAsistidas)} <Etiqueta tono={asis === null ? 'neutro' : asis >= 0.75 ? 'bien' : asis >= 0.6 ? 'ojo' : 'mal'} className="ml-1">{pct(asis, 0)}</Etiqueta></Celda>
                      <Celda num>{num(s.ventas)} <span className="text-[11px] text-texto-3">{pct(tasaCierre(s), 0)}</span></Celda>
                      <Celda num>{cop(s.valorVentasCOP)}</Celda>
                    </tr>
                  )
                })}
              </tbody>
            </Tabla>
          )}
          <p className="mt-3 text-[12px] leading-snug text-texto-2">Una semana registrada aquí manda sobre cualquier otro dato de agenda de esa misma semana. Lo de pauta (impresiones, clics, conversaciones) siempre viene de Meta.</p>
        </Panel>
      </div>
    </>
  )
}
