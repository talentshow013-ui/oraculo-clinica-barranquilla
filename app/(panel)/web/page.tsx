import Link from 'next/link'
import { motor } from '@/lib/datos'
import { num, pct, seg } from '@/lib/format'
import { fechaCorta, fechaHora } from '@/lib/format/fechas'
import type { CSSProperties } from 'react'
import { Aviso, Barra, Celda, Etiqueta, Grid, Kpi, Panel, Tabla, Th, Titulo, Vacio } from '@/components/ui'
import Contar from '@/components/cliente/contar'
import Ayuda from '@/components/cliente/ayuda'
import { FuenteDelHallazgo } from '@/components/hallazgo-fuente'
import IrACuenta from '@/components/cliente/ir-a-cuenta'

const AVISO_SIN_DATOS = 'Todavía no se ha conectado Google Analytics. Se conecta una vez con una llave de solo lectura (guía: docs/CONEXION_GA4.md) y después se trae solo cada día.'

/* Los canales, como los nombra Google, traducidos en la vista (el dato queda intacto). */
const NOMBRE_CANAL: Record<string, string> = {
  'Paid Social': 'Redes pagadas', 'Organic Social': 'Redes orgánicas', 'Organic Search': 'Búsqueda orgánica', 'Paid Search': 'Búsqueda pagada',
  Direct: 'Directo', Referral: 'Referidos', Email: 'Correo', Unassigned: 'Sin asignar', 'Organic Video': 'Video orgánico', 'Paid Video': 'Video pagado',
  Display: 'Display', 'Cross-network': 'Varias redes', 'Paid Other': 'Otros pagados', 'Organic Shopping': 'Compras orgánicas', 'Paid Shopping': 'Compras pagadas', Affiliates: 'Afiliados', Audio: 'Audio', SMS: 'SMS', 'Mobile Push Notifications': 'Notificaciones',
}
const canal = (c: string) => NOMBRE_CANAL[c] ?? c

/** El logo de Meta (el infinito), para la tarjeta que cruza el sitio con la pauta. */
const LogoMeta = () => <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><path d="M3 15c0-3.3 1.7-8 4.5-8S11 13 12 13s2-6 4.5-6S21 11.7 21 15c0 1.8-1 3-2.5 3-2.5 0-3.5-5-6.5-5s-4 5-6.5 5C4 18 3 16.8 3 15z" /></svg>

/**
 * GOOGLE (sitio web): de dónde llega la gente al sitio, qué canal y qué página convierten en
 * contacto, qué eventos clave se disparan y desde qué ciudad. Solo dato propio de Google Analytics.
 * Cruza con la pauta: cuánto del tráfico y de los contactos los trae Meta.
 */
export default async function Web() {
  const r = await motor()
  const w = r.web
  const ciudad = r.cliente.ciudad.split(',')[0]!.trim()
  const googleAds = r.cuentas.find((c) => c.plataforma === 'google')
  const avisoPauta = (
    <Aviso tono="acento" className="mb-3">
      <span>Esta pantalla es el <strong>sitio web</strong> (Google Analytics): quién entra a la página y quién escribe. <strong>La pauta de Google Ads</strong> (campañas, gasto, anuncios) está en Pauta, eligiendo la cuenta de Google Ads.{googleAds ? <> <IrACuenta cuentaId={googleAds.id} className="ml-1 rounded-full bg-acento px-2.5 py-0.5 text-[12px] font-semibold text-white hover:opacity-90">Ver la pauta de Google Ads →</IrACuenta></> : ' Todavía no está conectada.'}</span>
    </Aviso>
  )
  return (
    <>
      <Titulo rotulo="Sitio web de la clínica · Google Analytics (no es la pauta de Google Ads)" extra={w.sinDatos ? undefined : <p className="num text-[12.5px] text-texto-2">{num(w.resumen.sesiones)} visitas · {fechaCorta(w.desde)} – {fechaCorta(w.hasta)}{w.capturadoEn ? ` · traído ${fechaHora(w.capturadoEn)}` : ''}</p>}>¿Quién llega al sitio y quién termina escribiendo?</Titulo>

      {avisoPauta}
      {w.sinDatos ? (
        <Panel id="resumen" rotulo="Sitio web" titulo="Falta conectar Google Analytics" retraso={100}>
          <Vacio titulo="Todavía no hay datos del sitio web" texto={AVISO_SIN_DATOS} />
        </Panel>
      ) : (
        <>
          {w.avisos.map((a) => <Aviso key={a} tono="neutro" className="mb-3">{a}</Aviso>)}

          <div id="resumen">
          <Grid cols={4}>
            <Kpi nombre="Visitas (sesiones)" valor={w.resumen.sesiones} unidad="numero" formula="Sesiones del periodo, tal como las cuenta Google" retraso={40} />
            <Kpi nombre="Personas" valor={w.resumen.usuarios} unidad="numero" formula="Usuarios distintos del periodo" retraso={80} />
            <Kpi nombre="Contactos (eventos clave)" valor={w.resumen.eventosClave} unidad="numero" mejorEs="mayor" formula="Eventos clave definidos por la clínica en Google Analytics (clic a WhatsApp, formulario…)" porQueImporta="Es la única forma de saber qué visita se volvió conversación" retraso={120} />
            <Kpi nombre="Visitas que escriben" valor={w.resumen.tasaConversion} unidad="porcentaje" mejorEs="mayor" formula="Eventos clave ÷ sesiones" porQueImporta="Si baja con más tráfico, la pauta está trayendo gente que no es" retraso={160} />
          </Grid>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Kpi nombre="Visitas que se quedan" valor={w.resumen.tasaCompromiso} unidad="porcentaje" mejorEs="mayor" formula="Sesiones con interacción ÷ sesiones" retraso={200} />
            <Kpi nombre="Tiempo promedio" valor={w.resumen.duracionMedia} unidad="segundos" formula="Duración media de la sesión, ponderada por sesiones" retraso={240} />
            {/* lo que la pauta de Meta trae al sitio, en UNA tarjeta con su logo y el enlace a la pauta */}
            <article className="pieza entra-zoom flex flex-col p-3.5 sm:col-span-2" style={{ '--retraso': '280ms' } as CSSProperties} aria-label="Lo que trae la pauta de Meta al sitio">
              <div className="flex items-center justify-between gap-3">
                <p className="flex items-center gap-2 text-[11.5px] text-texto-2"><span className="text-acento"><LogoMeta /></span>Lo que trae la pauta de Meta al sitio</p>
                <Link href="/panel" className="rounded-full bg-acento/[0.08] px-2.5 py-1 text-[12px] font-medium text-acento ring-1 ring-acento/20 hover:bg-acento/[0.14]">Ver la pauta →</Link>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-4">
                <Ayuda titulo="Sesiones de facebook/instagram pagado ÷ todas" texto=""><div><p className="text-[11.5px] text-texto-2">Visitas que trae</p><p className="num cifra mt-1 text-[24px] text-texto"><Contar valor={w.pautaMeta?.participacionSesiones ?? null} unidad="porcentaje" /></p><p className="num mt-1 text-[11px] text-texto-3">{w.pautaMeta ? `${num(w.pautaMeta.sesiones)} visitas` : 'sin visitas de pauta'}</p></div></Ayuda>
                <Ayuda titulo="Eventos clave de facebook/instagram pagado ÷ todos" texto="Si la pauta trae el 60 % de las visitas pero el 20 % de los contactos, el problema es a quién le llega"><div><p className="text-[11.5px] text-texto-2">Contactos que trae</p><p className="num cifra mt-1 text-[24px] text-texto"><Contar valor={w.pautaMeta?.participacionEventos ?? null} unidad="porcentaje" /></p><p className="num mt-1 text-[11px] text-texto-3">{w.pautaMeta?.eventosClave != null ? `${num(w.pautaMeta.eventosClave)} contactos` : 'sin eventos clave'}</p></div></Ayuda>
              </div>
            </article>
          </div>
          </div>

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
                    <Barra pct={c.participacion} tono={c.mejor ? 'bien' : 'acento'} etiqueta={`${canal(c.canal)} · ${num(c.sesiones)} visitas · ${c.eventosClave == null ? '—' : num(c.eventosClave)} contactos`} valor={c.tasaConversion == null ? pct(c.participacion) : `${pct(c.participacion)} · convierte ${pct(c.tasaConversion)}`} />
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-[11.5px] text-texto-3">La barra es la participación en visitas; «convierte» es contactos ÷ visitas (mínimo 30 visitas). En negrita el canal que mejor convierte.</p>
            </Panel>
            <Panel id="fuentes" rotulo="Por fuente (dato propio)" titulo="Las diez fuentes que más visitas traen" retraso={440}>
              <Tabla minAncho={480}>
                <thead><tr><Th>Fuente</Th><Th>Canal</Th><Th num>Visitas</Th><Th num>Contactos</Th><Th num>Convierte</Th></tr></thead>
                <tbody>{w.porFuente.map((f) => <tr key={f.fuente}><Celda>{f.fuente}</Celda><Celda><Etiqueta tono={/paid/i.test(f.canal) ? 'acento' : 'neutro'}>{canal(f.canal)}</Etiqueta></Celda><Celda num>{num(f.sesiones)}</Celda><Celda num>{f.eventosClave == null ? '—' : num(f.eventosClave)}</Celda><Celda num tono={f.tasaConversion != null && f.tasaConversion >= (w.resumen.tasaConversion ?? 0) ? 'bien' : undefined}>{pct(f.tasaConversion)}</Celda></tr>)}</tbody>
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
              <Panel id="eventos" rotulo="Eventos clave (dato propio)" titulo="Qué cuenta Google como contacto" retraso={520} tono={w.eventosClave.length === 0 ? 'hielo' : 'blanco'}>
                {w.eventosClave.length === 0 ? (
                  /* vacío como tarjeta destacada: sin eventos clave no se sabe qué visita se volvió contacto */
                  <div className="flex flex-col gap-3 rounded-[14px] bg-white p-4 ring-1 ring-ojo/30">
                    <p className="flex items-center gap-2 text-[15px] font-medium"><span className="grid h-8 w-8 place-items-center rounded-full bg-ojo/10 text-ojo" aria-hidden="true"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="9" /><path d="M12 8v5M12 16v.5" /></svg></span>Google todavía no sabe qué visita se volvió contacto</p>
                    <p className="text-[13px] leading-snug text-texto-2">Sin eventos clave, «Contactos» y «Visitas que escriben» quedan en «—». El paso a seguir toma diez minutos en Google Analytics:</p>
                    <ol className="grid gap-1.5 text-[13px] leading-snug">
                      <li className="flex gap-2"><span className="num font-semibold text-ojo">1.</span><span>Administrar → Eventos: crear «clic a WhatsApp» (clic en el enlace de wa.me) y «formulario enviado».</span></li>
                      <li className="flex gap-2"><span className="num font-semibold text-ojo">2.</span><span>Marcar los dos como <strong>eventos clave</strong> (el interruptor de la derecha).</span></li>
                      <li className="flex gap-2"><span className="num font-semibold text-ojo">3.</span><span>Al día siguiente esta tarjeta se llena sola; no hay que tocar nada aquí.</span></li>
                    </ol>
                  </div>
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
