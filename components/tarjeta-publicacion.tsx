import type { CSSProperties, ReactNode } from 'react'
import { num, pct, seg } from '@/lib/format'
import { fechaCorta } from '@/lib/format/fechas'
import { NOMBRE_FORMATO, NOMBRE_RED, NOMBRE_VEREDICTO } from '@/lib/organico'
import type { PublicacionEvaluada } from '@/lib/tipos'
import { Miniatura, Vacio } from '@/components/ui'
import { IconoRed } from '@/components/iconos-redes'
import PlegableEnMovil from '@/components/cliente/plegable-movil'

/* la cinta del veredicto en la esquina de la imagen: estrella verde, gusta acento, llega lejos ámbar, floja rojo, normal gris */
const CINTA: Record<PublicacionEvaluada['veredicto'], string> = {
  estrella: 'bg-bien text-white',
  gusta: 'bg-acento text-white',
  lejos: 'bg-ojo text-white',
  normal: 'bg-white/90 text-texto-2',
  floja: 'bg-mal text-white',
  sin_dato: 'bg-white/90 text-texto-3',
}
const recortar = (t: string, n: number) => { const c = Array.from(t); return c.length > n ? c.slice(0, n).join('') + '…' : t }

/* iconitos de las métricas: ojo (alcance), play (vistas), corazón (me gusta), globo (comentarios), marcador (guardados), flecha (compartidos) */
const t = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }
const I = {
  alcance: <svg width="15" height="15" viewBox="0 0 24 24" {...t} aria-hidden="true"><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></svg>,
  vistas: <svg width="15" height="15" viewBox="0 0 24 24" {...t} aria-hidden="true"><path d="M7 5l12 7-12 7z" /></svg>,
  meGusta: <svg width="15" height="15" viewBox="0 0 24 24" {...t} aria-hidden="true"><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" /></svg>,
  comentarios: <svg width="15" height="15" viewBox="0 0 24 24" {...t} aria-hidden="true"><path d="M4 5h16v11H9l-5 4z" /></svg>,
  guardados: <svg width="15" height="15" viewBox="0 0 24 24" {...t} aria-hidden="true"><path d="M6 3h12v18l-6-4-6 4z" /></svg>,
  compartidos: <svg width="15" height="15" viewBox="0 0 24 24" {...t} aria-hidden="true"><path d="M4 12v7h16v-7M12 3v12M8 7l4-4 4 4" /></svg>,
  bombillo: <svg width="14" height="14" viewBox="0 0 24 24" {...t} aria-hidden="true"><path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.7.6 1 1.3 1 2.1h5c0-.8.3-1.5 1-2.1A6 6 0 0 0 12 3z" /></svg>,
}

/** El contador de la app: el iconito arriba y la cifra debajo. */
function Metrica({ icono, valor, titulo }: { icono: ReactNode; valor: string; titulo: string }) {
  return (
    <span className="flex flex-col items-center gap-0.5 text-center" title={titulo} aria-label={`${titulo}: ${valor}`}>
      <span className="text-texto-3">{icono}</span>
      <span className="num text-[12.5px] font-medium leading-none text-texto">{valor}</span>
    </span>
  )
}

/**
 * Una publicación orgánica como se ve en la red: la imagen del video/foto con esquinas suaves,
 * play grande si es reel, cinta de veredicto en la esquina, chip de red; debajo, fecha·hora·formato,
 * las seis métricas como contador (icono arriba, cifra abajo), la interacción, «Qué hacer» con
 * bombillo (en celular se pliega) y el botón «Ver en …». TODA la tarjeta abre la publicación en
 * pestaña nueva: el botón lleva un `::after` que se estira sobre la tarjeta; la imagen es su propio
 * enlace por encima. Con `destacado`, el «Qué hacer» es el porqué numérico de «Qué merece pauta».
 */
export function TarjetaPublicacion({ p, id, retraso = 0, destacado = false, compacta = false }: { p: PublicacionEvaluada; id?: string; retraso?: number; destacado?: boolean; /** en un carril angosto: métricas en dos filas de tres */ compacta?: boolean }) {
  const esVideo = p.formato === 'reel' || p.formato === 'video'
  const queHacer = p.queHacer ? (
    <p className={`flex items-start gap-1.5 rounded-[12px] px-2.5 py-2 text-[13px] leading-snug ${destacado ? 'bg-acento/[0.08] text-texto ring-1 ring-acento/25' : 'bg-hielo text-texto'}`}>
      <span className={`mt-[2px] shrink-0 ${destacado ? 'text-acento' : 'text-ojo'}`}>{I.bombillo}</span>
      <span><span className="font-semibold">{destacado ? 'Por qué: ' : 'Qué hacer: '}</span>{p.queHacer}</span>
    </p>
  ) : null
  return (
    <article id={id} className="pieza tarjeta-pub entra-zoom relative flex flex-col overflow-hidden" style={{ '--retraso': `${retraso}ms` } as CSSProperties}>
      <a href={p.enlace} target="_blank" rel="noopener noreferrer" className="relative z-10 m-2 block aspect-[4/5] overflow-hidden rounded-[14px] bg-superficie-2 shadow-[0_8px_18px_-12px_rgba(11,29,58,0.5)]" title="Ver la publicación">
        <Miniatura url={p.urlMiniatura} tipo={NOMBRE_FORMATO[p.formato]} alt={recortar(p.texto || NOMBRE_FORMATO[p.formato], 60)} className="h-full w-full" />
        {esVideo && (
          <span className="absolute left-1/2 top-1/2 grid h-12 w-12 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-black/55 text-white ring-1 ring-white/40 backdrop-blur-sm" aria-hidden="true">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5l11 7-11 7z" /></svg>
          </span>
        )}
        {p.veredicto !== 'sin_dato' && (
          <span className={`absolute left-0 top-3 rounded-r-full px-2.5 py-1 text-[11px] font-semibold shadow-[0_4px_10px_-4px_rgba(0,0,0,0.5)] ${CINTA[p.veredicto]}`}>{NOMBRE_VEREDICTO[p.veredicto]}</span>
        )}
        <span className="absolute right-2 top-2 flex items-center gap-1 rounded-full bg-black/55 px-2 py-1 text-[11px] text-white" title={NOMBRE_RED[p.red]}><IconoRed red={p.red} tam={12} /><span className="hidden sm:inline">{NOMBRE_RED[p.red]}</span></span>
        <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 to-transparent px-3 pb-2.5 pt-10 text-[12.5px] leading-snug text-white">{recortar(p.texto || '(sin texto)', 90)}</span>
      </a>
      <div className="flex flex-1 flex-col gap-2.5 px-3 pb-3 pt-1">
        <p className="num text-[11.5px] text-texto-3">{fechaCorta(p.fecha)} · {String(p.hora).padStart(2, '0')}:00 · {NOMBRE_FORMATO[p.formato]}</p>
        <div className={`grid grid-cols-3 gap-y-2 ${compacta ? '' : 'sm:grid-cols-6'}`}>
          <Metrica icono={I.alcance} valor={p.alcance == null ? '—' : num(p.alcance)} titulo="Personas alcanzadas" />
          <Metrica icono={I.vistas} valor={p.vistas == null ? '—' : num(p.vistas)} titulo="Vistas" />
          <Metrica icono={I.meGusta} valor={p.meGusta == null ? '—' : num(p.meGusta)} titulo="Me gusta" />
          <Metrica icono={I.comentarios} valor={p.comentarios == null ? '—' : num(p.comentarios)} titulo="Comentarios" />
          <Metrica icono={I.guardados} valor={p.guardados == null ? '—' : num(p.guardados)} titulo="Guardados" />
          <Metrica icono={I.compartidos} valor={p.compartidos == null ? '—' : num(p.compartidos)} titulo="Compartidos" />
        </div>
        <p className="num text-[11.5px] text-texto-3">Interacción {pct(p.tasaInteraccion)}{p.segundosPromedio != null ? ` · ${seg(p.segundosPromedio)} promedio viendo` : ''}</p>
        {queHacer && <PlegableEnMovil cabecera={<span className="text-[12.5px] font-semibold text-texto-2 md:hidden">{destacado ? 'Por qué' : 'Qué hacer'} · ver más</span>}>{queHacer}</PlegableEnMovil>}
        <a href={p.enlace} target="_blank" rel="noopener noreferrer" className="mt-auto self-start rounded-full bg-acento/[0.08] px-2.5 py-1 text-[12px] font-medium text-acento ring-1 ring-acento/20 after:absolute after:inset-0 after:content-[''] hover:bg-acento/[0.14]">Ver en {NOMBRE_RED[p.red]} ↗</a>
      </div>
    </article>
  )
}

export function RejillaPublicaciones({ lista, prefijo, vacio = 'Sin publicaciones con este dato en el periodo.', red }: { lista: PublicacionEvaluada[]; prefijo: string; vacio?: string; red?: string }) {
  if (!lista.length) return <Vacio titulo={vacio} texto="Cuando se publique algo en el periodo, aparece aquí con su veredicto." icono={red ? <IconoRed red={red} tam={26} /> : undefined} />
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
      {lista.map((p, i) => <TarjetaPublicacion key={p.id} p={p} id={`${prefijo}-${p.id}`} retraso={40 + (i % 10) * 40} />)}
    </div>
  )
}

/** Un carril horizontal con las mejores: se desliza de lado, una tarjeta tras otra. */
export function CarrilPublicaciones({ lista, prefijo, vacio = 'Sin publicaciones con este dato en el periodo.' }: { lista: PublicacionEvaluada[]; prefijo: string; vacio?: string }) {
  if (!lista.length) return <Vacio titulo={vacio} texto="Cuando se publique algo en el periodo, aparece aquí con su veredicto." />
  return (
    <div className="carril" role="list" aria-label="Publicaciones, deslizar de lado">
      {lista.map((p, i) => <div role="listitem" key={p.id}><TarjetaPublicacion p={p} id={`${prefijo}-${p.id}`} retraso={40 + i * 50} compacta /></div>)}
    </div>
  )
}
