import Link from 'next/link'
import { motor } from '@/lib/datos'
import { num, pct } from '@/lib/format'
import { fechaCorta, fechaHora } from '@/lib/format/fechas'
import { NOMBRE_RED } from '@/lib/organico'
import type { GrupoOrganico } from '@/lib/tipos'
import { Aviso, Barra, Celda, Panel, Tabla, Th, Titulo, Vacio } from '@/components/ui'
import { FuenteDelHallazgo } from '@/components/hallazgo-fuente'
import VerTodos from '@/components/cliente/ver-todos'
import { CarrilPublicaciones, RejillaPublicaciones, TarjetaPublicacion } from '@/components/tarjeta-publicacion'
import { RejillaCuentas, TarjetaCuenta } from '@/components/tarjeta-cuenta'
import { IconoRed } from '@/components/iconos-redes'
import type { RedOrganico } from '@/lib/adapters/types'

const TOPE = 15
const AVISO_SIN_DATOS = 'Todavía no se ha conectado el orgánico. Se conecta una vez desde el agente (guía: docs/CONEXION_ORGANICO.md) y después se trae solo cada día.'

/**
 * ORGÁNICO: lo que la clínica publica sin pagar en Instagram, Facebook y TikTok. Se lee como una
 * red social, no como un tablero: una TARJETA DE CUENTA por red (ícono, @usuario, seguidores y
 * tres métricas), primero «Qué merece pauta» (lo más valioso: ya demostraron que gustan), la
 * lectura, las mejores en dos carriles, formatos/horarios/días, seguidores, y todas las
 * publicaciones con pestañas por red. Cada publicación es un enlace a la red; cada bloque dice
 * de dónde sale. Solo dato propio.
 */
export default async function Organico({ searchParams }: { searchParams: Promise<{ red?: string }> }) {
  const { red } = await searchParams
  const redElegida = (['instagram', 'facebook', 'tiktok'] as const).find((x) => x === red) as RedOrganico | undefined
  const r = await motor()
  const o = r.organico
  const todas = redElegida ? o.publicaciones.filter((p) => p.red === redElegida) : o.publicaciones
  const nPauta = o.paraPauta.length
  return (
    <>
      <Titulo rotulo="Orgánico · Instagram, Facebook y TikTok sin pauta" extra={o.sinDatos ? undefined : <p className="num text-[12.5px] text-texto-2">{num(o.publicaciones.length)} publicaciones · {fechaCorta(o.desde)} – {fechaCorta(o.hasta)}{o.capturadoEn ? ` · traído ${fechaHora(o.capturadoEn)}` : ''}</p>}>¿Qué publica la clínica y qué le funciona sin pagar?</Titulo>

      {o.sinDatos ? (
        <Panel id="resumen" rotulo="Orgánico" titulo="Falta conectar Instagram y Facebook" retraso={100}>
          <Vacio titulo="Todavía no hay datos orgánicos" texto={AVISO_SIN_DATOS} icono={<IconoRed red="instagram" tam={24} />} />
        </Panel>
      ) : (
        <>
          {o.avisos.map((a) => <Aviso key={a} tono="neutro" className="mb-3">{a}</Aviso>)}

          {/* 1 · las cuentas: una tarjeta por red, a la misma altura */}
          <div id="resumen">
            <RejillaCuentas n={o.redes.length}>
              {o.redes.map((x, i) => <TarjetaCuenta key={x.red} red={x} retraso={40 + i * 60} />)}
            </RejillaCuentas>
          </div>

          {/* 2 · lo más valioso: las que ya demostraron que gustan */}
          <Panel id="para-pauta" className="mt-3" tono="hielo" rotulo="Qué merece pauta (dato propio)" titulo={nPauta === 0 ? 'Todavía ninguna se despega lo suficiente para ponerle pauta' : nPauta === 1 ? 'Esta ya demostró que gusta: ponle pauta' : `Estas ${nPauta} ya demostraron que gustan: ponles pauta`} retraso={240} extra={<p className="max-w-[46ch] text-[12.5px] leading-snug text-texto-2">Últimos 30 días, tasa de interacción muy por encima de la mediana y alcance sobre la mediana. Con pauta llegan a quien no te sigue.</p>}>
            {nPauta === 0 ? (
              <Aviso tono="neutro">Ninguna publicación reciente se despega lo suficiente del resto. Cuando una lo haga, aparece aquí con el porqué.</Aviso>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
                {o.paraPauta.map((c, i) => <TarjetaPublicacion key={c.publicacion.id} p={{ ...c.publicacion, queHacer: c.porQue }} id={`pauta-${c.publicacion.id}`} retraso={80 + i * 60} destacado />)}
              </div>
            )}
          </Panel>

          {o.lecturas.length > 0 && (
            <Panel id="lectura" className="mt-3" tono="marina" rotulo="Lo que dicen los números" titulo="Lectura del periodo" retraso={320}>
              <ul className="grid grid-cols-1 gap-1.5 md:grid-cols-2">{o.lecturas.map((l) => <li key={l} className="rounded-[12px] bg-white/[0.07] px-3 py-2 text-[13px] leading-snug text-white ring-1 ring-white/10">{l}</li>)}</ul>
            </Panel>
          )}

          {/* 3 · las mejores, en dos carriles que se deslizan de lado */}
          <Panel id="mejores" className="mt-3" rotulo="Mejores publicaciones del periodo (dato propio)" titulo="Las que más lejos llegaron y las que más conversación generaron" retraso={400} extra={<p className="text-[12px] text-texto-3">Desliza de lado para ver las cinco de cada carril.</p>}>
            <div className="grid grid-cols-1 gap-4">
              <div>
                <p className="rotulo mb-2">Por alcance</p>
                <CarrilPublicaciones lista={o.mejores.porAlcance.slice(0, 5)} prefijo="alcance" />
              </div>
              <div>
                <p className="rotulo mb-2">Por tasa de interacción</p>
                <CarrilPublicaciones lista={o.mejores.porTasa.slice(0, 5)} prefijo="tasa" />
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

          {/* 4 · todas, con las pestañas por red pegadas arriba de la rejilla */}
          <Panel id="todas" className="mt-3" rotulo="Todas las publicaciones del periodo" titulo={redElegida ? <span className="flex items-center gap-2"><IconoRed red={redElegida} tam={18} />{NOMBRE_RED[redElegida]} · de la más reciente a la más antigua</span> : 'De la más reciente a la más antigua'} retraso={640}>
            <nav aria-label="Filtrar por red" className="-mx-1 mb-4 flex gap-1 overflow-x-auto border-b border-borde px-1 sin-barra">
              <Pestana href="/organico#todas" activa={!redElegida} n={o.publicaciones.length}>Todas</Pestana>
              {o.redes.map((x) => <Pestana key={x.red} href={`/organico?red=${x.red}#todas`} activa={redElegida === x.red} n={o.publicaciones.filter((p) => p.red === x.red).length}><IconoRed red={x.red} tam={14} />{NOMBRE_RED[x.red]}</Pestana>)}
            </nav>
            <VerTodos total={todas.length} primeros={<RejillaPublicaciones lista={todas.slice(0, TOPE)} prefijo="pub" red={redElegida} vacio={redElegida ? `Todavía no hay publicaciones de ${NOMBRE_RED[redElegida]} en el periodo.` : undefined} />} resto={todas.length > TOPE ? <RejillaPublicaciones lista={todas.slice(TOPE)} prefijo="pub" /> : null} className={todas.length > TOPE ? '' : 'hidden'} />
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

/** Pestaña del filtro por red: subrayado de acento en la activa, cuenta de publicaciones al lado. */
function Pestana({ href, activa, n, children }: { href: string; activa: boolean; n: number; children: React.ReactNode }) {
  return (
    <Link href={href} aria-current={activa ? 'page' : undefined} className={`-mb-px flex shrink-0 items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-2 text-[13px] font-medium transition-colors ${activa ? 'border-acento text-acento' : 'border-transparent text-texto-2 hover:border-borde-fuerte hover:text-texto'}`}>
      {children}
      <span className={`num rounded-full px-1.5 py-0.5 text-[10.5px] ${activa ? 'bg-acento/10 text-acento' : 'bg-superficie-2 text-texto-3'}`}>{num(n)}</span>
    </Link>
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
