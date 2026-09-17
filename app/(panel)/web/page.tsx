import Link from 'next/link'
import { motor } from '@/lib/datos'
import { num, pct, seg } from '@/lib/format'
import { fechaCorta, fechaHora } from '@/lib/format/fechas'
import { Aviso, Barra, Celda, Etiqueta, Grid, Kpi, Panel, Tabla, Th, Titulo, Vacio } from '@/components/ui'
import { FuenteDelHallazgo } from '@/components/hallazgo-fuente'

const AVISO_SIN_DATOS = 'Todavía no se ha conectado Google Analytics. Se conecta una vez con una llave de solo lectura (guía: docs/CONEXION_GA4.md) y después se trae solo cada día.'

/**
 * GOOGLE (sitio web): de dónde llega la gente al sitio, qué canal y qué página convierten en
 * contacto, qué eventos clave se disparan y desde qué ciudad. Solo dato propio de Google Analytics.
 * Cruza con la pauta: cuánto del tráfico y de los contactos los trae Meta.
 */
export default async function Web() {
  const r = await motor()
  const w = r.web
  const ciudad = r.cliente.ciudad.split(',')[0]!.trim()
  return (
    <>
      <Titulo rotulo="Google · sitio web de la clínica" extra={w.sinDatos ? undefined : <p className="num text-[12.5px] text-texto-2">{num(w.resumen.sesiones)} visitas · {fechaCorta(w.desde)} – {fechaCorta(w.hasta)}{w.capturadoEn ? ` · traído ${fechaHora(w.capturadoEn)}` : ''}</p>}>¿Quién llega al sitio y quién termina escribiendo?</Titulo>

      {w.sinDatos ? (
        <Panel id="resumen" rotulo="Sitio web" titulo="Falta conectar Google Analytics" retraso={100}>
          <Vacio titulo="Todavía no hay datos del sitio web" texto={AVISO_SIN_DATOS} />
        </Panel>
      ) : (
        <>
          {w.avisos.map((a) => <Aviso key={a} tono="neutro" className="mb-3">{a}</Aviso>)}

          <Grid cols={4}>
            <Kpi nombre="Visitas (sesiones)" valor={w.resumen.sesiones} unidad="numero" formula="Sesiones del periodo, tal como las cuenta Google" retraso={40} />
            <Kpi nombre="Personas" valor={w.resumen.usuarios} unidad="numero" formula="Usuarios distintos del periodo" retraso={80} />
            <Kpi nombre="Contactos (eventos clave)" valor={w.resumen.eventosClave} unidad="numero" mejorEs="mayor" formula="Eventos clave definidos por la clínica en Google Analytics (clic a WhatsApp, formulario…)" porQueImporta="Es la única forma de saber qué visita se volvió conversación" retraso={120} />
            <Kpi nombre="Visitas que escriben" valor={w.resumen.tasaConversion} unidad="porcentaje" mejorEs="mayor" formula="Eventos clave ÷ sesiones" porQueImporta="Si baja con más tráfico, la pauta está trayendo gente que no es" retraso={160} />
          </Grid>
          <Grid cols={4} className="mt-3">
            <Kpi nombre="Visitas que se quedan" valor={w.resumen.tasaCompromiso} unidad="porcentaje" mejorEs="mayor" formula="Sesiones con interacción ÷ sesiones" retraso={200} />
            <Kpi nombre="Tiempo promedio" valor={w.resumen.duracionMedia} unidad="segundos" formula="Duración media de la sesión, ponderada por sesiones" retraso={240} />
            <Kpi nombre="Visitas que trae la pauta de Meta" valor={w.pautaMeta?.participacionSesiones ?? null} unidad="porcentaje" formula="Sesiones de facebook/instagram pagado ÷ todas" retraso={280} />
            <Kpi nombre="Contactos que trae la pauta de Meta" valor={w.pautaMeta?.participacionEventos ?? null} unidad="porcentaje" formula="Eventos clave de facebook/instagram pagado ÷ todos" porQueImporta="Si la pauta trae el 60 % de las visitas pero el 20 % de los contactos, el problema es a quién le llega" retraso={320} />
          </Grid>

          {w.lecturas.length > 0 && (
            <Panel id="lectura" className="mt-3" tono="marina" rotulo="Lo que dicen los números" titulo="Lectura del periodo" retraso={360}>
              <ul className="grid grid-cols-1 gap-1.5 md:grid-cols-2">{w.lecturas.map((l) => <li key={l} className="rounded-[12px] bg-white/[0.07] px-3 py-2 text-[13px] leading-snug text-white ring-1 ring-white/10">{l}</li>)}</ul>
            </Panel>
          )}

          <div className="mt-3 grid grid-cols-1 gap-3 xl:grid-cols-2">
            <Panel id="canales" rotulo="Por canal (dato propio)" titulo="De dónde llega la gente y qué canal convierte" retraso={400}>
              <ul className="flex flex-col gap-2">
                {w.porCanal.map((c) => (
                  <li key={c.canal} className={c.mejor ? 'font-semibold' : ''}>
                    <Barra pct={c.participacion} tono={c.mejor ? 'bien' : 'acento'} etiqueta={`${c.canal} · ${num(c.sesiones)} visitas · ${c.eventosClave == null ? '—' : num(c.eventosClave)} contactos`} valor={c.tasaConversion == null ? pct(c.participacion) : `${pct(c.participacion)} · convierte ${pct(c.tasaConversion)}`} />
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-[11.5px] text-texto-3">La barra es la participación en visitas; «convierte» es contactos ÷ visitas (mínimo 30 visitas). En negrita el canal que mejor convierte.</p>
            </Panel>
            <Panel id="fuentes" rotulo="Por fuente (dato propio)" titulo="Las diez fuentes que más visitas traen" retraso={440}>
              <Tabla minAncho={480}>
                <thead><tr><Th>Fuente</Th><Th>Canal</Th><Th num>Visitas</Th><Th num>Contactos</Th><Th num>Convierte</Th></tr></thead>
                <tbody>{w.porFuente.map((f) => <tr key={f.fuente}><Celda>{f.fuente}</Celda><Celda><Etiqueta tono={/paid/i.test(f.canal) ? 'acento' : 'neutro'}>{f.canal}</Etiqueta></Celda><Celda num>{num(f.sesiones)}</Celda><Celda num>{f.eventosClave == null ? '—' : num(f.eventosClave)}</Celda><Celda num tono={f.tasaConversion != null && f.tasaConversion >= (w.resumen.tasaConversion ?? 0) ? 'bien' : undefined}>{pct(f.tasaConversion)}</Celda></tr>)}</tbody>
              </Tabla>
            </Panel>
          </div>

          <div className="mt-3 grid grid-cols-1 gap-3 xl:grid-cols-2">
            <Panel id="paginas" rotulo="Páginas de entrada (dato propio)" titulo="Qué página convierte y cuál solo recibe visitas" retraso={480}>
              <Tabla minAncho={520}>
                <thead><tr><Th>Página</Th><Th num>Visitas</Th><Th num>Se quedan</Th><Th num>Contactos</Th><Th num>Convierte</Th></tr></thead>
                <tbody>{w.paginas.map((p) => <tr key={p.pagina}><Celda><span className="num break-all">{p.pagina}</span></Celda><Celda num>{num(p.sesiones)}</Celda><Celda num>{p.sesionesComprometidas == null ? '—' : num(p.sesionesComprometidas)}</Celda><Celda num>{p.eventosClave == null ? '—' : num(p.eventosClave)}</Celda><Celda num tono={p.tasaConversion != null && p.tasaConversion >= (w.resumen.tasaConversion ?? 0) ? 'bien' : undefined}>{pct(p.tasaConversion)}</Celda></tr>)}</tbody>
              </Tabla>
            </Panel>
            <div className="grid grid-cols-1 gap-3">
              <Panel id="eventos" rotulo="Eventos clave (dato propio)" titulo="Qué cuenta Google como contacto" retraso={520}>
                {w.eventosClave.length === 0 ? (
                  <Aviso tono="ojo">Google no tiene eventos clave configurados. Sin eso no se sabe qué visita se volvió contacto: hay que marcar «clic a WhatsApp» y «formulario» como eventos clave en Google Analytics.</Aviso>
                ) : (
                  <ul className="flex flex-col gap-1.5">{w.eventosClave.map((e) => <li key={e.evento} className="flex items-center justify-between rounded-[12px] bg-superficie-2 px-3 py-2 text-[13px]"><span className="num">{e.evento}</span><span className="num font-semibold">{num(e.veces)}</span></li>)}</ul>
                )}
              </Panel>
              <Panel id="ciudades" rotulo="Ciudades (dato propio)" titulo={`Desde dónde llegan · ${w.fueraDeCiudad == null ? '—' : pct(w.fueraDeCiudad)} fuera de ${ciudad}`} retraso={560}>
                <ul className="flex flex-col gap-2">{w.ciudades.map((c) => <li key={c.ciudad}><Barra pct={c.participacion} tono={c.ciudad.toLowerCase() === ciudad.toLowerCase() ? 'bien' : 'neutro'} etiqueta={`${c.ciudad || '(sin ciudad)'} · ${c.eventosClave == null ? '—' : num(c.eventosClave)} contactos`} valor={`${num(c.sesiones)} · ${pct(c.participacion)}`} /></li>)}</ul>
                <p className="mt-2 text-[11.5px] text-texto-3">Cruza con <Link href="/audiencias#zona" className="font-medium text-acento">Audiencias</Link>: si la pauta gasta en ciudades desde donde nadie viene, aquí se ve si al menos visitan.</p>
              </Panel>
            </div>
          </div>

          <Panel id="serie" className="mt-3" rotulo="Día a día (dato propio)" titulo="Visitas y contactos por día" retraso={600}>
            <Tabla minAncho={360}>
              <thead><tr><Th>Día</Th><Th num>Visitas</Th><Th num>Contactos</Th></tr></thead>
              <tbody>{w.serie.slice(-31).map((d) => <tr key={d.fecha}><Celda>{fechaCorta(d.fecha)}</Celda><Celda num>{num(d.sesiones)}</Celda><Celda num tono={d.eventosClave ? 'bien' : undefined}>{d.eventosClave == null ? '—' : num(d.eventosClave)}</Celda></tr>)}</tbody>
            </Tabla>
          </Panel>

          <Panel id="fuente" className="mt-3" rotulo="De dónde sale" titulo="Fuente de esta pantalla" retraso={640}>
            <FuenteDelHallazgo fuente={w.fuente} />
            <p className="mt-2 text-[11.5px] text-texto-3">Tiempo promedio en {seg(w.resumen.duracionMedia)}. La pauta (lo que se paga) está en <Link href="/panel" className="font-medium text-acento">Centro de mando</Link>; lo orgánico en <Link href="/organico" className="font-medium text-acento">Orgánico</Link>.</p>
          </Panel>
        </>
      )}
    </>
  )
}
