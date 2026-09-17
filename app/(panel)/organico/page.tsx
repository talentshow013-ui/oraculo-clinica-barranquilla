import type { CSSProperties } from 'react'
import Link from 'next/link'
import { motor } from '@/lib/datos'
import { num, pct, seg } from '@/lib/format'
import { fechaCorta, fechaHora } from '@/lib/format/fechas'
import { NOMBRE_FORMATO, NOMBRE_RED } from '@/lib/organico'
import type { GrupoOrganico, PublicacionEvaluada } from '@/lib/tipos'
import { Aviso, Barra, Celda, Etiqueta, Grid, Kpi, Panel, Tabla, Th, Titulo, Vacio } from '@/components/ui'
import { FuenteDelHallazgo } from '@/components/hallazgo-fuente'
import VerTodos from '@/components/cliente/ver-todos'

const TOPE = 15
const recortar = (t: string, n: number) => { const c = Array.from(t); return c.length > n ? c.slice(0, n).join('') + '…' : t }
const AVISO_SIN_DATOS = 'Todavía no se ha conectado el orgánico. Se conecta una vez desde el agente (guía: docs/CONEXION_ORGANICO.md) y después se trae solo cada día.'

/**
 * ORGÁNICO: lo que la clínica publica sin pagar en Instagram y Facebook. Solo dato propio de Meta:
 * resumen por red, mejores publicaciones, qué formato / día / franja rinde, qué merece pauta y
 * seguidores. Cada publicación es un enlace a la red; cada bloque dice de dónde sale.
 */
export default async function Organico() {
  const r = await motor()
  const o = r.organico
  const ig = o.redes.find((x) => x.red === 'instagram')
  const fb = o.redes.find((x) => x.red === 'facebook')
  const tt = o.redes.find((x) => x.red === 'tiktok')
  return (
    <>
      <Titulo rotulo="Orgánico · Instagram, Facebook y TikTok sin pauta" extra={o.sinDatos ? undefined : <p className="num text-[12.5px] text-texto-2">{num(o.publicaciones.length)} publicaciones · {fechaCorta(o.desde)} – {fechaCorta(o.hasta)}{o.capturadoEn ? ` · traído ${fechaHora(o.capturadoEn)}` : ''}</p>}>¿Qué publica la clínica y qué le funciona sin pagar?</Titulo>

      {o.sinDatos ? (
        <Panel id="resumen" rotulo="Orgánico" titulo="Falta conectar Instagram y Facebook" retraso={100}>
          <Vacio titulo="Todavía no hay datos orgánicos" texto={AVISO_SIN_DATOS} />
        </Panel>
      ) : (
        <>
          {o.avisos.map((a) => <Aviso key={a} tono="neutro" className="mb-3">{a}</Aviso>)}

          <Grid cols={4}>
            <Kpi nombre={`Seguidores en Instagram${ig?.alias ? ` · @${ig.alias}` : ''}`} valor={ig?.seguidores ?? null} unidad="numero" formula="Seguidores hoy, tal como los reporta Meta" retraso={40} />
            <Kpi nombre="Seguidores ganados (Instagram)" valor={ig?.seguidoresGanados ?? null} unidad="numero" mejorEs="mayor" tono={ig?.seguidoresGanados != null && ig.seguidoresGanados > 0 ? 'bien' : undefined} formula="Suma de seguidores nuevos por día en el periodo (Meta solo entrega los últimos 30 días)" retraso={80} />
            <Kpi nombre="Alcance orgánico (Instagram)" valor={ig?.alcance ?? null} unidad="numero" formula="Suma del alcance de las publicaciones del periodo" retraso={120} />
            <Kpi nombre="Tasa de interacción (Instagram)" valor={ig?.tasaInteraccion ?? null} unidad="porcentaje" formula="Interacciones ÷ alcance de las publicaciones con alcance" porQueImporta="Si sube, el contenido conecta; si baja, cambia el formato o el gancho antes de pagar por él" retraso={160} />
          </Grid>
          {fb && (
            <Grid cols={4} className="mt-3">
              <Kpi nombre={`Seguidores en Facebook${fb.alias ? ` · ${fb.alias}` : ''}`} valor={fb.seguidores} unidad="numero" formula="Seguidores hoy, tal como los reporta Meta" retraso={200} />
              <Kpi nombre="Seguidores ganados (Facebook)" valor={fb.seguidoresGanados} unidad="numero" mejorEs="mayor" formula="Último día del periodo menos el primero" retraso={240} />
              <Kpi nombre="Vistas orgánicas (Facebook)" valor={fb.vistas} unidad="numero" formula="Suma de vistas de las publicaciones del periodo" retraso={280} />
              <Kpi nombre="Interacciones (Facebook)" valor={fb.interacciones} unidad="numero" formula="Reacciones + comentarios + compartidos" retraso={320} />
            </Grid>
          )}

          {tt && (
            <Grid cols={4} className="mt-3">
              <Kpi nombre={`Seguidores en TikTok${tt.alias ? ` · @${tt.alias}` : ''}`} valor={tt.seguidores} unidad="numero" formula="Seguidores según la exportación de TikTok Studio" retraso={200} />
              <Kpi nombre="Seguidores ganados (TikTok)" valor={tt.seguidoresGanados} unidad="numero" mejorEs="mayor" formula="Suma de seguidores netos por día del resumen de TikTok Studio" retraso={240} />
              <Kpi nombre="Vistas (TikTok)" valor={tt.vistas} unidad="numero" formula="Suma de vistas de los videos del periodo" retraso={280} />
              <Kpi nombre="Tasa de interacción (TikTok)" valor={tt.tasaInteraccion} unidad="porcentaje" formula="Interacciones ÷ alcance de los videos con alcance (si TikTok no da alcance, «—»)" retraso={320} />
            </Grid>
          )}

          {o.lecturas.length > 0 && (
            <Panel id="resumen" className="mt-3" tono="marina" rotulo="Lo que dicen los números" titulo="Lectura del periodo" retraso={360}>
              <ul className="grid grid-cols-1 gap-1.5 md:grid-cols-2">{o.lecturas.map((l) => <li key={l} className="rounded-[12px] bg-white/[0.07] px-3 py-2 text-[13px] leading-snug text-white ring-1 ring-white/10">{l}</li>)}</ul>
            </Panel>
          )}

          <Panel id="para-pauta" className="mt-3" rotulo="Qué merece pauta (dato propio)" titulo="Publicaciones que ya probaron que gustan sin pagar" retraso={400} extra={<p className="max-w-[46ch] text-[12.5px] leading-snug text-texto-2">Últimos 30 días, tasa de interacción muy por encima de la mediana y alcance sobre la mediana. Con pauta llegan a quien no te sigue.</p>}>
            {o.paraPauta.length === 0 ? (
              <Aviso tono="neutro">Ninguna publicación reciente se despega lo suficiente del resto. Cuando una lo haga, aparece aquí con el porqué.</Aviso>
            ) : (
              <ol className="grid grid-cols-1 gap-2 md:grid-cols-2">
                {o.paraPauta.map((c, i) => (
                  <li key={c.publicacion.id} className="pieza entra-zoom p-3" style={{ '--retraso': `${80 + i * 60}ms` } as CSSProperties}>
                    <p className="flex flex-wrap items-center gap-2 text-[12px] text-texto-2"><Etiqueta tono="bien">{NOMBRE_FORMATO[c.publicacion.formato]} · {NOMBRE_RED[c.publicacion.red]}</Etiqueta><span className="num">{fechaCorta(c.publicacion.fecha)}</span></p>
                    <p className="mt-1 text-[14px] font-medium leading-snug">{recortar(c.publicacion.texto || '(sin texto)', 140)}</p>
                    <p className="mt-1 text-[12.5px] leading-snug text-texto-2">{c.porQue}</p>
                    <a href={c.publicacion.enlace} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block rounded-full bg-acento/[0.08] px-2.5 py-1 text-[12px] font-medium text-acento ring-1 ring-acento/20 hover:bg-acento/[0.14]">Ver la publicación ↗</a>
                  </li>
                ))}
              </ol>
            )}
          </Panel>

          <Panel id="mejores" className="mt-3" rotulo="Mejores publicaciones del periodo (dato propio)" titulo="Las que más lejos llegaron y las que más conversación generaron" retraso={440}>
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
              <div>
                <p className="rotulo mb-1.5">Por alcance</p>
                <TablaPublicaciones lista={o.mejores.porAlcance} prefijo="alcance" />
              </div>
              <div>
                <p className="rotulo mb-1.5">Por tasa de interacción</p>
                <TablaPublicaciones lista={o.mejores.porTasa} prefijo="tasa" />
              </div>
            </div>
          </Panel>

          <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-3">
            <Grupos id="formatos" titulo="Por formato" filas={o.porFormato} retraso={480} />
            <Grupos id="horario" titulo="Por franja del día" filas={o.porFranja} retraso={520} />
            <Grupos id="dias" titulo="Por día de la semana" filas={o.porDia} retraso={560} />
          </div>

          <Panel id="seguidores" className="mt-3" rotulo="Seguidores (dato propio)" titulo="Cómo crece la cuenta día a día" retraso={600}>
            {o.seguidores.serie.length === 0 ? (
              <Aviso tono="neutro">Meta no entregó la serie diaria de seguidores en este periodo.</Aviso>
            ) : (
              <Tabla minAncho={420}>
                <thead><tr><Th>Día</Th><Th num>Instagram · nuevos</Th><Th num>Facebook · total</Th><Th num>TikTok · nuevos</Th></tr></thead>
                <tbody>{o.seguidores.serie.slice(-31).map((d) => <tr key={d.fecha}><Celda>{fechaCorta(d.fecha)}</Celda><Celda num tono={d.instagramNuevos != null && d.instagramNuevos > 0 ? 'bien' : undefined}>{d.instagramNuevos == null ? '—' : num(d.instagramNuevos)}</Celda><Celda num>{d.facebookTotal == null ? '—' : num(d.facebookTotal)}</Celda><Celda num tono={d.tiktokNuevos != null && d.tiktokNuevos > 0 ? 'bien' : undefined}>{d.tiktokNuevos == null ? '—' : num(d.tiktokNuevos)}</Celda></tr>)}</tbody>
              </Tabla>
            )}
          </Panel>

          <Panel id="todas" className="mt-3" rotulo="Todas las publicaciones del periodo" titulo="De la más reciente a la más antigua" retraso={640}>
            <VerTodos total={o.publicaciones.length} primeros={<TablaPublicaciones lista={o.publicaciones.slice(0, TOPE)} prefijo="pub" />} resto={o.publicaciones.length > TOPE ? <TablaPublicaciones lista={o.publicaciones.slice(TOPE)} prefijo="pub" sinCabecera /> : null} className={o.publicaciones.length > TOPE ? '' : 'hidden'} />
          </Panel>

          <Panel id="fuente" className="mt-3" rotulo="De dónde sale" titulo="Fuente de esta pantalla" retraso={680}>
            <FuenteDelHallazgo fuente={o.fuente} />
            <p className="mt-2 text-[11.5px] text-texto-3">La pauta (lo que se paga) está en <Link href="/panel" className="font-medium text-acento">Centro de mando</Link>. Aquí nada tiene costo: es lo que la clínica publica en sus cuentas.</p>
          </Panel>
        </>
      )}
    </>
  )
}

function TablaPublicaciones({ lista, prefijo, sinCabecera = false }: { lista: PublicacionEvaluada[]; prefijo: string; sinCabecera?: boolean }) {
  if (!lista.length) return <Aviso tono="neutro">Sin publicaciones con este dato en el periodo.</Aviso>
  return (
    <Tabla minAncho={720}>
      {!sinCabecera && <thead><tr><Th>Publicación</Th><Th>Formato</Th><Th num>Alcance</Th><Th num>Vistas</Th><Th num>Me gusta</Th><Th num>Coment.</Th><Th num>Guard.</Th><Th num>Compart.</Th><Th num>Tasa</Th><Th num>Seg. prom.</Th></tr></thead>}
      <tbody>
        {lista.map((p) => (
          <tr key={p.id} id={`${prefijo}-${p.id}`}>
            <Celda>
              <a href={p.enlace} target="_blank" rel="noopener noreferrer" className="font-medium text-acento underline-offset-2 hover:underline" title="Abrir en la red social">{recortar(p.texto || '(sin texto)', 70)} ↗</a>
              <span className="num mt-0.5 block text-[11.5px] text-texto-3">{fechaCorta(p.fecha)} · {String(p.hora).padStart(2, '0')}:00 · {NOMBRE_RED[p.red]}</span>
            </Celda>
            <Celda><Etiqueta tono={p.red === 'tiktok' ? 'ojo' : p.formato === 'reel' ? 'acento' : 'neutro'}>{p.red === 'tiktok' ? 'TikTok' : NOMBRE_FORMATO[p.formato]}</Etiqueta></Celda>
            <Celda num>{p.alcance == null ? '—' : num(p.alcance)}</Celda>
            <Celda num>{p.vistas == null ? '—' : num(p.vistas)}</Celda>
            <Celda num>{p.meGusta == null ? '—' : num(p.meGusta)}</Celda>
            <Celda num>{p.comentarios == null ? '—' : num(p.comentarios)}</Celda>
            <Celda num>{p.guardados == null ? '—' : num(p.guardados)}</Celda>
            <Celda num>{p.compartidos == null ? '—' : num(p.compartidos)}</Celda>
            <Celda num tono={p.tasaInteraccion != null && p.tasaInteraccion >= 0.05 ? 'bien' : undefined}>{pct(p.tasaInteraccion)}</Celda>
            <Celda num>{p.segundosPromedio == null ? '—' : seg(p.segundosPromedio)}</Celda>
          </tr>
        ))}
      </tbody>
    </Tabla>
  )
}

function Grupos({ id, titulo, filas, retraso }: { id: string; titulo: string; filas: GrupoOrganico[]; retraso: number }) {
  const conDatos = filas.filter((g) => g.publicaciones > 0)
  const max = Math.max(...conDatos.map((g) => g.tasa ?? 0), 0)
  return (
    <Panel id={id} rotulo={titulo} titulo="Tasa de interacción por grupo" retraso={retraso}>
      {conDatos.length === 0 ? (
        <Aviso tono="neutro">Sin publicaciones en el periodo.</Aviso>
      ) : (
        <ul className="flex flex-col gap-2">
          {filas.filter((g) => g.publicaciones > 0 || id === 'dias').map((g) => (
            <li key={g.clave} className={g.mejor ? 'font-semibold' : ''}>
              <Barra pct={g.tasa == null || max === 0 ? null : g.tasa / max} tono={g.mejor ? 'bien' : 'acento'} etiqueta={`${g.etiqueta} · ${num(g.publicaciones)} ${g.publicaciones === 1 ? 'publicación' : 'publicaciones'}${g.alcanceMedio != null ? ` · alcance medio ${num(g.alcanceMedio)}` : ''}`} valor={g.tasa == null ? '—' : pct(g.tasa)} />
            </li>
          ))}
        </ul>
      )}
    </Panel>
  )
}
