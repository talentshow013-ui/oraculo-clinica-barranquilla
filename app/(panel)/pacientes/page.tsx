import Link from 'next/link'
import { motor } from '@/lib/datos'
import { cop, num, pct } from '@/lib/format'
import { fechaCorta, fechaHora } from '@/lib/format/fechas'
import { NOMBRE_FUENTE } from '@/lib/pacientes'
import { Aviso, Celda, Etiqueta, Grid, Kpi, Panel, Tabla, Th, Titulo, Vacio, type Tono } from '@/components/ui'
import Ayuda from '@/components/cliente/ayuda'
import type { CSSProperties } from 'react'
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
            <Tasa nombre="De lead a cita" valor={p.tasas.leadACita} semaforo={semaforoLeadCita(p.tasas.leadACita)} umbral="Menos de 5 % flojo · 5 a 10 % regular · más de 10 % bien" formula="Citas ÷ leads" porQueImporta="Si es baja, la fuga está en la conversación, no en la pauta" retraso={200} />
            <Tasa nombre="De cita a asistencia" valor={p.tasas.citaAAsistencia} semaforo={semaforoAsistencia(p.tasas.citaAAsistencia)} umbral="Menos de 60 % flojo · 60 a 80 % regular · más de 80 % bien" formula="Asistieron ÷ citas" porQueImporta="Recordatorio 24 h antes y confirmación suben esto sin gastar" retraso={240} />
            <Tasa nombre="De lead a venta" valor={p.tasas.leadAVenta} semaforo={null} umbral="Sin umbral fijo: depende del ticket del servicio" formula="Ventas ÷ leads" retraso={280} />
            <Kpi nombre="Valor de las ventas" valor={t.valorVentas || null} unidad="cop" mejorEs="mayor" formula="Suma del precio de los leads ganados (si en Kommo lo llenan)" retraso={320} grande />
          </Grid>

          {p.lecturas.length > 0 && (
            <Panel id="lectura" className="mt-3" tono="marina" rotulo="Lo que dicen los números" titulo="Lectura del periodo" retraso={360}>
              <ul className="grid grid-cols-1 gap-1.5 md:grid-cols-2">{p.lecturas.map((l) => <li key={l} className="rounded-[12px] bg-white/[0.07] px-3 py-2 text-[13px] leading-snug text-white ring-1 ring-white/10">{l}</li>)}</ul>
            </Panel>
          )}

          <Panel id="embudo" className="mt-3" rotulo="Lead → cita → asistió → venta (dato propio)" titulo="Dónde se quedan los pacientes" retraso={400}>
            <Embudo pasos={[
              { n: 'Escribieron (leads)', v: t.leads },
              { n: 'Agendaron cita', v: t.citas },
              { n: 'Asistieron', v: t.asistieron },
              { n: 'Compraron', v: t.ventas },
            ]} />
          </Panel>

          <div className="mt-3 grid grid-cols-1 gap-3 xl:grid-cols-2">
            <Panel id="fuentes" rotulo="Por fuente (dato propio)" titulo="De dónde vienen los que sí compran" retraso={440}>
              <Tabla minAncho={520}>
                <thead><tr><Th>Fuente</Th><Th num>Leads</Th><Th num>Citas</Th><Th num>Asistieron</Th><Th num>Ventas</Th><Th num>Lead → cita</Th></tr></thead>
                <tbody>{p.porFuente.map((f) => <tr key={f.fuente} className={f.fuente === 'desconocido' ? 'bg-hielo-pac' : undefined}><Celda className={f.fuente === 'desconocido' ? 'pl-2' : ''}><Etiqueta tono={f.fuente === 'meta' ? 'acento' : f.fuente === 'desconocido' ? 'ojo' : 'neutro'}>{NOMBRE_FUENTE[f.fuente]}</Etiqueta></Celda><Celda num>{num(f.leads)}</Celda><Celda num>{num(f.citas)}</Celda><Celda num>{num(f.asistieron)}</Celda><Celda num tono={f.ventas ? 'bien' : undefined}>{num(f.ventas)}</Celda><Celda num>{pct(f.leadACita)}</Celda></tr>)}</tbody>
              </Tabla>
              {p.porFuente.some((f) => f.fuente === 'desconocido') && <p className="mt-2 flex items-start gap-1.5 rounded-[10px] bg-hielo-pac px-2.5 py-1.5 text-[11.5px] leading-snug text-texto-2"><span aria-hidden="true" className="mt-1 h-2 w-2 shrink-0 rounded-full bg-ojo" />«Sin fuente» = Kommo no dice si ese paciente vino de la pauta o de orgánico. Mientras esa fila sea grande, no se puede saber qué canal paga. Se arregla nombrando los canales en Kommo (guía en docs/CONEXION_KOMMO.md).</p>}
            </Panel>
            <Panel id="semanas" rotulo="Semana a semana (dato propio)" titulo="Leads, citas y ventas por semana" retraso={480}>
              <Tabla minAncho={460}>
                <thead><tr><Th>Semana</Th><Th num>Leads</Th><Th num>Citas</Th><Th num>Asistieron</Th><Th num>Ventas</Th><Th num>Valor</Th></tr></thead>
                <tbody>{p.porSemana.slice(-14).map((s) => <tr key={s.semana}><Celda>{fechaCorta(s.desde)}</Celda><Celda num>{num(s.leads)}</Celda><Celda num>{num(s.citas)}</Celda><Celda num>{num(s.asistieron)}</Celda><Celda num tono={s.ventas ? 'bien' : undefined}>{num(s.ventas)}</Celda><Celda num>{s.valorVentas ? cop(s.valorVentas) : '—'}</Celda></tr>)}</tbody>
              </Tabla>
            </Panel>
          </div>

          <Panel id="etapas" className="mt-3" rotulo="Cómo se leyó Kommo" titulo="Etapas de Kommo y a qué paso cuentan" retraso={520} extra={<p className="max-w-[46ch] text-[12.5px] leading-snug text-texto-2">Si una etapa debe contar distinto, se ajusta en config/kommo.json.</p>}>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4">
              {PASOS_KOMMO.map((paso, i) => {
                /* Kommo repite la misma etapa en cada embudo: se muestra una vez y se dice en cuántos está */
                const lista = agrupar(p.etapas.filter((e) => e.paso === paso))
                return (
                  <div key={paso} className="rounded-[14px] bg-superficie-2 p-3 ring-1 ring-borde">
                    <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-texto-2"><span className="grid h-5 w-5 place-items-center rounded-full bg-marino-pac text-[10px] text-ambar">{i + 1}</span>{paso}</p>
                    <ul className="mt-2 flex flex-wrap gap-1.5">
                      {lista.map((e) => <li key={e.nombre} className="rounded-full bg-white px-2.5 py-1 text-[12px] ring-1 ring-borde">{e.nombre}{e.veces > 1 && <span className="num ml-1 text-[10.5px] text-texto-3">×{e.veces}</span>}</li>)}
                      {lista.length === 0 && <li className="text-[12px] text-texto-3">Ninguna etapa de Kommo cuenta aquí.</li>}
                    </ul>
                  </div>
                )
              })}
            </div>
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

const PASOS_KOMMO = ['Lead', 'Cita agendada', 'Asistió', 'Venta']

/** Mismo nombre (sin importar mayúsculas ni espacios) = una sola ficha con cuántas veces aparece. */
function agrupar(etapas: { nombre: string }[]): { nombre: string; veces: number }[] {
  const m = new Map<string, { nombre: string; veces: number }>()
  for (const e of etapas) {
    const k = e.nombre.trim().toLowerCase().replace(/\s+/g, ' ')
    const x = m.get(k)
    if (x) x.veces += 1
    else m.set(k, { nombre: e.nombre.trim(), veces: 1 })
  }
  return [...m.values()].sort((a, b) => b.veces - a.veces || a.nombre.localeCompare(b.nombre, 'es'))
}

/* semáforos de las tasas (umbrales del prompt): lead→cita < 5 % rojo, 5–10 ámbar, > 10 verde; cita→asistencia < 60 % rojo */
const semaforoLeadCita = (v: number | null): Tono | null => (v == null ? null : v < 0.05 ? 'mal' : v <= 0.1 ? 'ojo' : 'bien')
const semaforoAsistencia = (v: number | null): Tono | null => (v == null ? null : v < 0.6 ? 'mal' : v <= 0.8 ? 'ojo' : 'bien')
const NOMBRE_SEMAFORO: Record<Tono, string> = { mal: 'Flojo', ojo: 'Regular', bien: 'Bien', acento: '', neutro: 'Sin umbral' }

/** Una tasa entre pasos como tarjeta grande: la cifra en el color del semáforo y la etiqueta que lo dice con palabras. */
function Tasa({ nombre, valor, semaforo, umbral, formula, porQueImporta, retraso }: { nombre: string; valor: number | null; semaforo: Tono | null; umbral: string; formula: string; porQueImporta?: string; retraso: number }) {
  const t: Tono = semaforo ?? 'neutro'
  const color = t === 'mal' ? 'text-mal' : t === 'bien' ? 'text-bien' : t === 'ojo' ? 'text-ojo' : 'text-texto'
  return (
    <Ayuda titulo={formula} texto={`${porQueImporta ? porQueImporta + '. ' : ''}${umbral}.`}>
      <div className="pieza instrumento entra-zoom flex h-full flex-col justify-between p-3.5" style={{ '--retraso': `${retraso}ms` } as CSSProperties}>
        <p className="text-[11.5px] leading-tight text-texto-2">{nombre}</p>
        <p className={`num cifra mt-1.5 text-[34px] ${color}`}>{valor == null ? '—' : pct(valor)}</p>
        <div className="mt-2 flex items-center justify-between gap-2">
          {semaforo ? <Etiqueta tono={semaforo}>{NOMBRE_SEMAFORO[semaforo]}</Etiqueta> : <span className="text-[11px] text-texto-3">{valor == null ? 'Sin dato' : 'Sin umbral fijo'}</span>}
          <span className="hidden text-[10.5px] text-texto-3 lg:inline">{semaforo === 'mal' ? 'Fuga grande aquí' : semaforo === 'ojo' ? 'Se puede subir' : semaforo === 'bien' ? 'Va bien' : ''}</span>
        </div>
      </div>
    </Ayuda>
  )
}

/** Embudo de verdad: barras decrecientes centradas y, entre barra y barra, cuántos se pierden en ese paso. */
function Embudo({ pasos }: { pasos: { n: string; v: number }[] }) {
  const base = pasos[0]?.v ?? 0
  return (
    <ol className="mx-auto flex max-w-[760px] flex-col items-center">
      {pasos.map((x, i) => {
        /* proporcional, pero con piso: con tasas de 1–2 % la barra real mediría un dedo y no cabría ni el nombre */
        const ancho = base ? Math.max(0.42 - i * 0.06, x.v / base) : 0.42 - i * 0.06
        const anterior = i > 0 ? pasos[i - 1]!.v : null
        const caida = anterior ? 1 - x.v / anterior : null
        const ultimo = i === pasos.length - 1
        return (
          <li key={x.n} className="contents">
            {i > 0 && (
              <div className="flex items-center gap-2 py-1 text-[11.5px] text-texto-3" aria-label={`Del paso ${i} al ${i + 1}`}>
                <span aria-hidden="true" className="h-4 w-px bg-borde-fuerte" />
                {caida == null ? <span>sin dato del paso anterior</span> : <span><span className={`num font-semibold ${caida > 0.9 ? 'text-mal' : caida > 0.5 ? 'text-ojo' : 'text-texto-2'}`}>−{pct(caida)}</span> se quedan aquí</span>}
                <span aria-hidden="true" className="h-4 w-px bg-borde-fuerte" />
              </div>
            )}
            <div className={`crece flex h-12 items-center justify-between gap-3 rounded-[12px] px-3.5 text-[13px] text-white ${ultimo ? 'bg-bien' : i === 0 ? 'bg-marino-pac' : 'bg-marino-pac-2'}`} style={{ width: `${ancho * 100}%`, minWidth: 230, transformOrigin: 'center', '--retraso': `${420 + i * 90}ms` } as CSSProperties} role="img" aria-label={`${x.n}: ${num(x.v)}`}>
              <span className="truncate">{x.n}</span>
              <span className="num shrink-0 text-[15px] font-semibold">{num(x.v)}<span className="ml-1.5 text-[11px] font-normal opacity-75">{base && i > 0 ? pct(x.v / base) : ''}</span></span>
            </div>
          </li>
        )
      })}
    </ol>
  )
}
