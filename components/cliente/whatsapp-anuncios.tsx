import { cop, num, pct } from '@/lib/format'
import { fechaCorta, fechaHora } from '@/lib/format/fechas'
import { resumenWhatsapp } from '@/lib/conversaciones'
import { duracion } from '@/lib/notificaciones/whatsapp'
import { Aviso, Celda, Etiqueta, Grid, Kpi, Panel, Tabla, Th, Vacio } from '@/components/ui'

/**
 * WHATSAPP POR ANUNCIO (webhook de Kommo): de qué anuncio vino cada conversación, cuánto tardó la
 * primera respuesta y en qué terminó su lead (cita, asistió, venta), con el gasto del anuncio en el
 * mismo periodo. Solo conteos y tiempos: el texto de los mensajes nunca se guarda. Sigue el calendario.
 */
export default function WhatsappAnuncios({ desde, hasta, retraso = 0 }: { desde: string; hasta: string; retraso?: number }) {
  const r = resumenWhatsapp({ desde, hasta })
  if (!r) {
    return (
      <Panel id="whatsapp" className="mt-3" rotulo="WhatsApp por anuncio (webhook de Kommo)" titulo="Qué anuncio trae conversaciones, citas y ventas" retraso={retraso}>
        <Vacio titulo="Todavía no llegan conversaciones" texto="Las conversaciones llegan solas desde Kommo por el webhook (activo desde el 15 de octubre de 2026) y se ven en el panel de la VPS." />
      </Panel>
    )
  }
  const at = r.atencion
  const em = r.embudo
  const medianaMin = at.medianaSeg == null ? null : Math.round(at.medianaSeg / 60)
  return (
    <Panel
      id="whatsapp"
      className="mt-3"
      rotulo="WhatsApp por anuncio (webhook de Kommo · dato propio)"
      titulo="Qué anuncio trae conversaciones, citas y ventas"
      retraso={retraso}
      extra={<p className="num max-w-[52ch] text-[12.5px] leading-snug text-texto-2">Guardando desde {fechaCorta(r.primerDia)}{r.cruceEn ? ` · cruce con Kommo ${fechaHora(r.cruceEn)}` : ''}</p>}
    >
      {r.primerDia > desde && <Aviso tono="neutro" className="mb-3">Solo cuenta desde el {fechaCorta(r.primerDia)}, cuando se activó el webhook: lo anterior a esa fecha no llegó por esta vía.</Aviso>}

      <Grid cols={4}>
        <Kpi nombre="Conversaciones nuevas" valor={r.nuevas} unidad="numero" formula="Chats de WhatsApp que empezaron en el periodo (primer mensaje que llegó a Kommo)" retraso={retraso + 40} />
        <Kpi nombre="Vienen de un anuncio identificado" valor={r.identificadas} unidad="numero" mejorEs="mayor" formula="El primer mensaje coincide con el mensaje predeterminado (y su emoji) de un anuncio" porQueImporta={`${pct(r.nuevas ? r.identificadas / r.nuevas : null)} del total. Lo demás llega con un mensaje genérico, repetido en varias campañas o escrito a mano`} retraso={retraso + 80} />
        <Kpi nombre="Primera respuesta: la mitad en menos de (min)" valor={medianaMin} unidad="numero" mejorEs="menor" formula="Mediana del tiempo entre el primer mensaje y la primera respuesta de una persona (los bots no cuentan). Incluye noches y fines de semana" retraso={retraso + 120} />
        <Kpi nombre="Sin respuesta (más de 1 h)" valor={at.sinRespuesta} unidad="numero" mejorEs="menor" tono={at.sinRespuesta ? 'mal' : 'bien'} formula="Conversaciones sin respuesta de una persona, sin cerrar en Kommo, con más de 1 hora de espera" porQueImporta="Un lead que espera se enfría: es plata de pauta que se pierde" retraso={retraso + 160} />
      </Grid>

      <p className="mt-3 text-[12.5px] text-texto-2">
        En qué terminaron (etapa del lead en Kommo): <span className="num font-semibold text-texto">{num(em.citas)}</span> citas · <span className="num font-semibold text-texto">{num(em.asistieron)}</span> asistieron · <span className="num font-semibold text-bien">{num(em.ventas)}</span> ventas{em.valor ? ` (${cop(em.valor)})` : ''} · {num(em.conLead)} de {num(em.conversaciones)} conversaciones ya cruzadas con su lead.
      </p>

      {r.porAnuncio.length > 0 ? (
        <div className="mt-3">
          <Tabla minAncho={860}>
            <thead><tr><Th>Anuncio</Th><Th num>Conversaciones</Th><Th num>Citas</Th><Th num>Asistieron</Th><Th num>Ventas</Th><Th num>Gasto</Th><Th num>Por conversación</Th><Th num>Por cita</Th><Th num>Por venta</Th></tr></thead>
            <tbody>
              {r.porAnuncio.slice(0, 15).map((a) => (
                <tr key={a.anuncioId ?? `${a.cuenta}|${a.campana}|${a.anuncio}`}>
                  <Celda>
                    <span className="block max-w-[34ch] truncate font-medium" title={a.anuncio ?? a.campana}>{a.anuncio ?? a.campana}</span>
                    <span className="block max-w-[34ch] truncate text-[11px] text-texto-3" title={`${a.cuenta} · ${a.campana}`}>{a.cuenta} · {a.campana}</span>
                    {a.certeza !== 'exacto' && <Etiqueta tono="ojo" className="mt-1">{a.certeza === 'activo' ? 'el activo con ese mensaje' : a.certeza === 'parecido' ? 'mensaje parecido' : 'solo la campaña'}</Etiqueta>}
                  </Celda>
                  <Celda num>{num(a.conversaciones)}</Celda>
                  <Celda num>{num(a.citas)}</Celda>
                  <Celda num>{num(a.asistieron)}</Celda>
                  <Celda num tono={a.ventas ? 'bien' : undefined}>{num(a.ventas)}</Celda>
                  <Celda num>{a.gasto == null ? '—' : cop(a.gasto)}</Celda>
                  <Celda num>{a.costoConversacion == null ? '—' : cop(a.costoConversacion)}</Celda>
                  <Celda num>{a.costoCita == null ? '—' : cop(a.costoCita)}</Celda>
                  <Celda num tono={a.costoVenta != null ? 'bien' : undefined}>{a.costoVenta == null ? '—' : cop(a.costoVenta)}</Celda>
                </tr>
              ))}
            </tbody>
          </Tabla>
          {r.porAnuncio.length > 15 && <p className="mt-1.5 text-[11.5px] text-texto-3">… y {r.porAnuncio.length - 15} anuncios más.</p>}
        </div>
      ) : (
        <p className="mt-3 text-[12.5px] text-texto-3">Ninguna conversación del periodo trae el mensaje de un anuncio identificado.</p>
      )}

      {r.sinIdentificar.total > 0 && (
        <p className="mt-2 flex items-start gap-1.5 rounded-[10px] bg-hielo-pac px-2.5 py-1.5 text-[11.5px] leading-snug text-texto-2">
          <span aria-hidden="true" className="mt-1 h-2 w-2 shrink-0 rounded-full bg-ojo" />
          {num(r.sinIdentificar.total)} sin anuncio identificado: {num(r.sinIdentificar.genericas)} con mensaje genérico, {num(r.sinIdentificar.ambiguas)} con un mensaje que tienen varias campañas y {num(r.sinIdentificar.ninguno)} escritas a mano. Se arregla con un mensaje predeterminado distinto (con su emoji) en cada anuncio.
        </p>
      )}

      {at.porAsesora.length > 0 && (
        <div className="mt-4">
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-texto-2">Por asesora · primera respuesta</p>
          <Tabla minAncho={460}>
            <thead><tr><Th>Asesora</Th><Th num>Atendidas</Th><Th num>La mitad en menos de</Th><Th num>En 15 min o menos</Th></tr></thead>
            <tbody>
              {at.porAsesora.map((a) => (
                <tr key={a.asesoraId}>
                  <Celda>{a.asesora ?? `Usuario ${a.asesoraId}`}</Celda>
                  <Celda num>{num(a.atendidas)}</Celda>
                  <Celda num>{duracion(a.medianaSeg)}</Celda>
                  <Celda num>{pct(a.atendidas ? a.hasta15min / a.atendidas : null)}</Celda>
                </tr>
              ))}
            </tbody>
          </Tabla>
        </div>
      )}
    </Panel>
  )
}
