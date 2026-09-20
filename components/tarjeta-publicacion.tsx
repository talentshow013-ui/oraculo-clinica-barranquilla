import type { CSSProperties } from 'react'
import { num, pct, seg } from '@/lib/format'
import { fechaCorta } from '@/lib/format/fechas'
import { NOMBRE_FORMATO, NOMBRE_RED, NOMBRE_VEREDICTO } from '@/lib/organico'
import type { PublicacionEvaluada } from '@/lib/tipos'
import { Aviso, Etiqueta, Miniatura, type Tono } from '@/components/ui'
import { IconoRed } from '@/components/iconos-redes'

const TONO_VEREDICTO: Record<PublicacionEvaluada['veredicto'], Tono> = { estrella: 'bien', gusta: 'acento', lejos: 'ojo', normal: 'neutro', floja: 'mal', sin_dato: 'neutro' }
const recortar = (t: string, n: number) => { const c = Array.from(t); return c.length > n ? c.slice(0, n).join('') + '…' : t }

/* iconitos de las métricas: ojo (alcance), play (vistas), corazón (me gusta), globo (comentarios), marcador (guardados), flecha (compartidos) */
const t = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }
const I = {
  alcance: <svg width="13" height="13" viewBox="0 0 24 24" {...t} aria-hidden="true"><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></svg>,
  vistas: <svg width="13" height="13" viewBox="0 0 24 24" {...t} aria-hidden="true"><path d="M7 5l12 7-12 7z" /></svg>,
  meGusta: <svg width="13" height="13" viewBox="0 0 24 24" {...t} aria-hidden="true"><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" /></svg>,
  comentarios: <svg width="13" height="13" viewBox="0 0 24 24" {...t} aria-hidden="true"><path d="M4 5h16v11H9l-5 4z" /></svg>,
  guardados: <svg width="13" height="13" viewBox="0 0 24 24" {...t} aria-hidden="true"><path d="M6 3h12v18l-6-4-6 4z" /></svg>,
  compartidos: <svg width="13" height="13" viewBox="0 0 24 24" {...t} aria-hidden="true"><path d="M4 12v7h16v-7M12 3v12M8 7l4-4 4 4" /></svg>,
}

function Metrica({ icono, valor, titulo }: { icono: React.ReactNode; valor: string; titulo: string }) {
  return <span className="flex items-center gap-1 text-[12px] text-texto-2" title={titulo}><span className="text-texto-3">{icono}</span><span className="num font-medium text-texto">{valor}</span></span>
}

/**
 * Una publicación orgánica como se ve en la red: la imagen del video/foto, su red y formato, las
 * métricas con iconitos, el veredicto y qué hacer. Clic en la imagen → la publicación en Instagram/Facebook/TikTok.
 */
export function TarjetaPublicacion({ p, id, retraso = 0 }: { p: PublicacionEvaluada; id?: string; retraso?: number }) {
  return (
    <article id={id} className="pieza entra-zoom flex flex-col overflow-hidden" style={{ '--retraso': `${retraso}ms` } as CSSProperties}>
      <a href={p.enlace} target="_blank" rel="noopener noreferrer" className="group relative block aspect-[4/5] w-full bg-superficie-2" title="Ver la publicación">
        <Miniatura url={p.urlMiniatura} tipo={NOMBRE_FORMATO[p.formato]} alt={recortar(p.texto || NOMBRE_FORMATO[p.formato], 60)} className="h-full w-full" />
        {(p.formato === 'reel' || p.formato === 'video') && <span className="absolute left-2 top-2 grid h-7 w-7 place-items-center rounded-full bg-black/55 text-white"><svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 5l12 7-12 7z" /></svg></span>}
        <span className="absolute right-2 top-2 flex items-center gap-1 rounded-full bg-black/55 px-2 py-0.5 text-[11px] text-white"><IconoRed red={p.red} tam={12} />{NOMBRE_RED[p.red]}</span>
        <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-3 pb-2 pt-8 text-[12.5px] leading-snug text-white">{recortar(p.texto || '(sin texto)', 90)}</span>
      </a>
      <div className="flex flex-col gap-2 p-3">
        <div className="flex flex-wrap items-center justify-between gap-1.5">
          <span className="num text-[11.5px] text-texto-3">{fechaCorta(p.fecha)} · {String(p.hora).padStart(2, '0')}:00 · {NOMBRE_FORMATO[p.formato]}</span>
          <Etiqueta tono={TONO_VEREDICTO[p.veredicto]}>{NOMBRE_VEREDICTO[p.veredicto]}</Etiqueta>
        </div>
        <div className="flex flex-wrap gap-x-3 gap-y-1">
          <Metrica icono={I.alcance} valor={p.alcance == null ? '—' : num(p.alcance)} titulo="Personas alcanzadas" />
          <Metrica icono={I.vistas} valor={p.vistas == null ? '—' : num(p.vistas)} titulo="Vistas" />
          <Metrica icono={I.meGusta} valor={p.meGusta == null ? '—' : num(p.meGusta)} titulo="Me gusta" />
          <Metrica icono={I.comentarios} valor={p.comentarios == null ? '—' : num(p.comentarios)} titulo="Comentarios" />
          <Metrica icono={I.guardados} valor={p.guardados == null ? '—' : num(p.guardados)} titulo="Guardados" />
          <Metrica icono={I.compartidos} valor={p.compartidos == null ? '—' : num(p.compartidos)} titulo="Compartidos" />
        </div>
        <p className="num text-[11.5px] text-texto-3">Interacción {pct(p.tasaInteraccion)}{p.segundosPromedio != null ? ` · ${seg(p.segundosPromedio)} promedio viendo` : ''}</p>
        {p.queHacer && <p className="rounded-[10px] bg-hielo px-2.5 py-1.5 text-[12.5px] leading-snug"><span className="font-semibold">Qué hacer: </span>{p.queHacer}</p>}
        <a href={p.enlace} target="_blank" rel="noopener noreferrer" className="self-start rounded-full bg-acento/[0.08] px-2.5 py-1 text-[12px] font-medium text-acento ring-1 ring-acento/20 hover:bg-acento/[0.14]">Ver en {NOMBRE_RED[p.red]} ↗</a>
      </div>
    </article>
  )
}

export function RejillaPublicaciones({ lista, prefijo, vacio = 'Sin publicaciones con este dato en el periodo.' }: { lista: PublicacionEvaluada[]; prefijo: string; vacio?: string }) {
  if (!lista.length) return <Aviso tono="neutro">{vacio}</Aviso>
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
      {lista.map((p, i) => <TarjetaPublicacion key={p.id} p={p} id={`${prefijo}-${p.id}`} retraso={40 + (i % 10) * 40} />)}
    </div>
  )
}
