import type { CSSProperties, ReactNode } from 'react'
import { num, pct } from '@/lib/format'
import { NOMBRE_RED } from '@/lib/organico'
import type { ResumenRed } from '@/lib/tipos'
import Contar from '@/components/cliente/contar'
import Ayuda from '@/components/cliente/ayuda'
import { IconoRed } from '@/components/iconos-redes'

/**
 * LA TARJETA DE CUENTA: una por red conectada, todas a la misma altura. El ícono grande y el
 * @usuario arriba, los seguidores como cifra principal (contada) y tres métricas debajo. Es lo
 * que reemplaza a las filas de KPI genéricas en Orgánico: se lee como el perfil de la red.
 */
function Dato({ nombre, valor, tono, ayuda }: { nombre: string; valor: string; tono?: 'bien' | 'mal'; ayuda?: string }) {
  const cuerpo = (
    <div className="min-w-0">
      <p className="text-[11px] leading-tight text-texto-3">{nombre}</p>
      <p className={`num mt-0.5 text-[15px] font-medium leading-none ${tono === 'bien' ? 'text-bien' : tono === 'mal' ? 'text-mal' : 'text-texto'}`}>{valor}</p>
    </div>
  )
  return ayuda ? <Ayuda titulo={ayuda} texto="">{cuerpo}</Ayuda> : cuerpo
}

export function TarjetaCuenta({ red, retraso = 0, className = '' }: { red: ResumenRed; retraso?: number; className?: string }) {
  const alias = red.red === 'facebook' ? red.alias : `@${red.alias}`
  const ganados = red.seguidoresGanados
  const tercera: { nombre: string; valor: string; ayuda: string } = red.red === 'facebook'
    ? { nombre: 'Vistas del periodo', valor: red.vistas == null ? '—' : num(red.vistas), ayuda: 'Suma de vistas de las publicaciones del periodo' }
    : { nombre: 'Alcance del periodo', valor: red.alcance == null ? '—' : num(red.alcance), ayuda: red.red === 'tiktok' ? 'Suma de vistas de los videos del periodo (TikTok no da alcance)' : 'Suma del alcance de las publicaciones del periodo' }
  const valorTercera = red.red === 'tiktok' && red.alcance == null ? (red.vistas == null ? '—' : num(red.vistas)) : tercera.valor
  return (
    <article className={`pieza entra-zoom flex h-full flex-col p-4 ${className}`} style={{ '--retraso': `${retraso}ms` } as CSSProperties} aria-label={`${NOMBRE_RED[red.red]} · ${alias}`}>
      <div className="flex items-center gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-superficie-2 text-texto ring-1 ring-borde" aria-hidden="true"><IconoRed red={red.red} tam={24} /></span>
        <div className="min-w-0">
          <p className="rotulo">{NOMBRE_RED[red.red]}</p>
          <p className="truncate text-[14px] font-medium" title={alias}>{alias}</p>
        </div>
      </div>
      <p className="mt-4 text-[11.5px] text-texto-2">Seguidores hoy</p>
      <p className="num cifra mt-1 text-[32px] text-texto"><Contar valor={red.seguidores} unidad="numero" /></p>
      <div className="mt-4 grid grid-cols-3 gap-3 border-t border-borde pt-3">
        <Dato nombre="Ganados" valor={ganados == null ? '—' : `${ganados > 0 ? '+' : ganados < 0 ? '−' : ''}${num(Math.abs(ganados))}`} tono={ganados == null ? undefined : ganados > 0 ? 'bien' : ganados < 0 ? 'mal' : undefined} ayuda={red.red === 'instagram' ? 'Suma de seguidores nuevos por día en el periodo (Meta entrega los últimos 30 días)' : red.red === 'tiktok' ? 'Suma de seguidores netos por día del resumen de TikTok Studio' : 'Último día del periodo menos el primero'} />
        <Dato nombre={tercera.nombre} valor={valorTercera} ayuda={tercera.ayuda} />
        <Dato nombre={red.tasaInteraccion == null ? "Interacciones" : "Interacción"} valor={red.tasaInteraccion == null ? (red.interacciones == null ? '—' : num(red.interacciones)) : pct(red.tasaInteraccion)} ayuda={red.tasaInteraccion == null ? 'Reacciones + comentarios + compartidos' : 'Interacciones ÷ alcance de las publicaciones con alcance'} />
      </div>
    </article>
  )
}

export function RejillaCuentas({ children, n }: { children: ReactNode; n: number }) {
  return <div className={`grid grid-cols-1 gap-3 ${n >= 3 ? 'md:grid-cols-3' : 'md:grid-cols-2'}`}>{children}</div>
}
