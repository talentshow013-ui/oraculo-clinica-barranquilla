import Link from 'next/link'
import { motor } from '@/lib/datos'
import { cop, num, pct } from '@/lib/format'
import { fechaCorta, fechaHora } from '@/lib/format/fechas'
import { NOMBRE_FUENTE } from '@/lib/pacientes'
import { Aviso, Barra, Celda, Etiqueta, Grid, Kpi, Panel, Tabla, Th, Titulo, Vacio } from '@/components/ui'
import { FuenteDelHallazgo } from '@/components/hallazgo-fuente'

const AVISO_SIN_DATOS = 'Todavía no se ha conectado Kommo. Se conecta una vez con el token de la integración «Oráculo» (guía: docs/CONEXION_KOMMO.md) y después se trae solo cada día.'

/**
 * PACIENTES (Kommo): qué pasa después del clic. Leads → cita agendada → asistió → venta, por
 * periodo, por fuente y por semana. Todo agregado: nunca una persona. Cada bloque dice de dónde sale.
 */
export default async function Pacientes() {
  const r = await motor()
  const p = r.pacientes
  const t = p.totales
  return (
    <>
      <Titulo rotulo="Pacientes · lo que pasa después del clic (Kommo)" extra={p.sinDatos ? undefined : <p className="num text-[12.5px] text-texto-2">{num(t.leads)} leads · {fechaCorta(p.desde)} – {fechaCorta(p.hasta)}{p.capturadoEn ? ` · traído ${fechaHora(p.capturadoEn)}` : ''}</p>}>¿Cuántos de los que escriben terminan en cita y en venta?</Titulo>

      {p.sinDatos ? (
        <Panel id="resumen" rotulo="Pacientes" titulo="Falta conectar Kommo" retraso={100}>
          <Vacio titulo="Todavía no hay datos de pacientes" texto={AVISO_SIN_DATOS} />
        </Panel>
      ) : (
        <>
          {p.avisos.map((a) => <Aviso key={a} tono="neutro" className="mb-3">{a}</Aviso>)}

          <Grid cols={4}>
            <Kpi nombre="Leads (escribieron)" valor={t.leads} unidad="numero" formula="Leads creados en Kommo en el periodo" retraso={40} />
            <Kpi nombre="Citas agendadas" valor={t.citas} unidad="numero" mejorEs="mayor" formula="Leads que llegaron a una etapa de cita en Kommo" retraso={80} />
            <Kpi nombre="Asistieron" valor={t.asistieron} unidad="numero" mejorEs="mayor" formula="Leads en etapa de paciente / asistió" retraso={120} />
            <Kpi nombre="Ventas" valor={t.ventas} unidad="numero" mejorEs="mayor" formula="Leads ganados en Kommo" porQueImporta="Es el único número que paga la pauta" retraso={160} />
          </Grid>
          <Grid cols={4} className="mt-3">
            <Kpi nombre="De lead a cita" valor={p.tasas.leadACita} unidad="porcentaje" mejorEs="mayor" formula="Citas ÷ leads" porQueImporta="Si es baja, la fuga está en la conversación, no en la pauta" retraso={200} />
            <Kpi nombre="De cita a asistencia" valor={p.tasas.citaAAsistencia} unidad="porcentaje" mejorEs="mayor" formula="Asistieron ÷ citas" porQueImporta="Recordatorio 24 h antes y confirmación suben esto sin gastar" retraso={240} />
            <Kpi nombre="De lead a venta" valor={p.tasas.leadAVenta} unidad="porcentaje" mejorEs="mayor" formula="Ventas ÷ leads" retraso={280} />
            <Kpi nombre="Valor de las ventas" valor={t.valorVentas || null} unidad="cop" mejorEs="mayor" formula="Suma del precio de los leads ganados (si en Kommo lo llenan)" retraso={320} />
          </Grid>

          {p.lecturas.length > 0 && (
            <Panel id="lectura" className="mt-3" tono="marina" rotulo="Lo que dicen los números" titulo="Lectura del periodo" retraso={360}>
              <ul className="grid grid-cols-1 gap-1.5 md:grid-cols-2">{p.lecturas.map((l) => <li key={l} className="rounded-[12px] bg-white/[0.07] px-3 py-2 text-[13px] leading-snug text-white ring-1 ring-white/10">{l}</li>)}</ul>
            </Panel>
          )}

          <Panel id="embudo" className="mt-3" rotulo="Lead → cita → asistió → venta (dato propio)" titulo="Dónde se quedan los pacientes" retraso={400}>
            <ul className="flex flex-col gap-2">
              {[
                { n: 'Escribieron (leads)', v: t.leads },
                { n: 'Agendaron cita', v: t.citas },
                { n: 'Asistieron', v: t.asistieron },
                { n: 'Compraron', v: t.ventas },
              ].map((x, i) => <li key={x.n}><Barra pct={t.leads ? x.v / t.leads : null} tono={i === 3 ? 'bien' : 'acento'} etiqueta={x.n} valor={`${num(x.v)}${t.leads && i > 0 ? ` · ${pct(x.v / t.leads)} de los leads` : ''}`} /></li>)}
            </ul>
          </Panel>

          <div className="mt-3 grid grid-cols-1 gap-3 xl:grid-cols-2">
            <Panel id="fuentes" rotulo="Por fuente (dato propio)" titulo="De dónde vienen los que sí compran" retraso={440}>
              <Tabla minAncho={520}>
                <thead><tr><Th>Fuente</Th><Th num>Leads</Th><Th num>Citas</Th><Th num>Asistieron</Th><Th num>Ventas</Th><Th num>Lead → cita</Th></tr></thead>
                <tbody>{p.porFuente.map((f) => <tr key={f.fuente}><Celda><Etiqueta tono={f.fuente === 'meta' ? 'acento' : f.fuente === 'desconocido' ? 'ojo' : 'neutro'}>{NOMBRE_FUENTE[f.fuente]}</Etiqueta></Celda><Celda num>{num(f.leads)}</Celda><Celda num>{num(f.citas)}</Celda><Celda num>{num(f.asistieron)}</Celda><Celda num tono={f.ventas ? 'bien' : undefined}>{num(f.ventas)}</Celda><Celda num>{pct(f.leadACita)}</Celda></tr>)}</tbody>
              </Tabla>
              {p.porFuente.some((f) => f.fuente === 'desconocido') && <p className="mt-2 text-[11.5px] text-texto-3">«Sin fuente» = Kommo no dice si vino de la pauta o de orgánico. Se arregla nombrando los canales en Kommo (guía en docs/CONEXION_KOMMO.md).</p>}
            </Panel>
            <Panel id="semanas" rotulo="Semana a semana (dato propio)" titulo="Leads, citas y ventas por semana" retraso={480}>
              <Tabla minAncho={460}>
                <thead><tr><Th>Semana</Th><Th num>Leads</Th><Th num>Citas</Th><Th num>Asistieron</Th><Th num>Ventas</Th><Th num>Valor</Th></tr></thead>
                <tbody>{p.porSemana.slice(-14).map((s) => <tr key={s.semana}><Celda>{fechaCorta(s.desde)}</Celda><Celda num>{num(s.leads)}</Celda><Celda num>{num(s.citas)}</Celda><Celda num>{num(s.asistieron)}</Celda><Celda num tono={s.ventas ? 'bien' : undefined}>{num(s.ventas)}</Celda><Celda num>{s.valorVentas ? cop(s.valorVentas) : '—'}</Celda></tr>)}</tbody>
              </Tabla>
            </Panel>
          </div>

          <Panel id="etapas" className="mt-3" rotulo="Cómo se leyó Kommo" titulo="Etapas de Kommo y a qué paso cuentan" retraso={520} extra={<p className="max-w-[46ch] text-[12.5px] leading-snug text-texto-2">Si una etapa debe contar distinto, se ajusta en config/kommo.json.</p>}>
            <ul className="flex flex-wrap gap-1.5">{p.etapas.map((e, i) => <li key={`${e.nombre}-${i}`} className="flex items-center gap-1.5 rounded-full bg-superficie-2 px-2.5 py-1 text-[12px] ring-1 ring-borde"><span>{e.nombre}</span><span className="text-texto-3">→</span><span className="font-medium">{e.paso}</span></li>)}</ul>
          </Panel>

          <Panel id="fuente" className="mt-3" rotulo="De dónde sale" titulo="Fuente de esta pantalla" retraso={560}>
            <FuenteDelHallazgo fuente={p.fuente} />
            <p className="mt-2 text-[11.5px] text-texto-3">La pauta está en <Link href="/panel" className="font-medium text-acento">Centro de mando</Link>; el embudo completo (impresión → venta) en <Link href="/embudo" className="font-medium text-acento">Embudo</Link>. Aquí nunca aparece una persona: solo conteos.</p>
          </Panel>
        </>
      )}
    </>
  )
}
