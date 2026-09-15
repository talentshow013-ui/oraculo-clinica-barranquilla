import type { CSSProperties } from 'react'
import { motor } from '@/lib/datos'
import { num } from '@/lib/format'
import { ANGULOS, NIVELES } from '@/lib/format/etiquetas'
import { Aviso, Celda, Etiqueta, Grid, Kpi, Miniatura, Panel, Barra, Tabla, Th, Titulo } from '@/components/ui'
import MapaAngulos from '@/components/graficas/mapa-angulos'
import VerTodos from '@/components/cliente/ver-todos'
import type { AnuncioCompetidor, PerfilCompetidor } from '@/lib/tipos'

/**
 * RADAR DE MERCADO: lo único honesto es cuánto tiempo lleva un anuncio al aire. Se rehízo el
 * 14-sep porque con datos reales (53 competidores, 91 anuncios, 290 huecos) medía 38.000 px:
 * ahora es una columna a lo ancho, con tope de 12 ganadores y 15 perfiles («Ver los N» para el
 * resto) y solo los 8 espacios vacíos ya priorizados. Cabe en tres pantallas.
 */
const TOPE_GANADORES = 12
const TOPE_PERFILES = 15

export default async function Competencia() {
  const r = await motor()
  const ra = r.radar
  if (ra.sinDatos) {
    return (
      <>
        <Titulo rotulo="Radar de mercado">Qué sostiene el mercado y dónde hay espacio</Titulo>
        <Aviso tono="neutro">Todavía no se ha capturado la competencia. Se hace en la sincronización semanal.</Aviso>
      </>
    )
  }
  const activos = ra.perfiles.reduce((s, p) => s + p.anunciosActivos, 0)
  const ganadores = [...ra.ganadores].sort((a, b) => b.diasCorriendo - a.diasCorriendo)
  const perfiles = [...ra.perfiles].sort((a, b) => b.anuncios60 - a.anuncios60 || b.anunciosActivos - a.anunciosActivos || b.anunciosTotales - a.anunciosTotales)
  // Cadencia = anuncios nuevos por semana en las últimas 4 semanas: el mercado entero contra la clínica.
  const cadenciaMercado = ra.cadencia.total
  const nombreServicio = (id: string) => r.cliente.servicios.find((s) => s.id === id)?.nombre ?? id

  return (
    <>
      <Titulo rotulo="Radar de mercado · se ordena por longevidad, nunca por métricas estimadas" extra={<p className="num text-[12.5px] text-texto-2">{ra.perfiles.length} competidores · {r.lote.anunciosCompetencia.length} anuncios</p>}>Qué sostiene el mercado y dónde hay espacio</Titulo>
      <Grid cols={4}>
        <Kpi nombre="Ganadores probados (60+ días)" valor={ra.ganadores.length} unidad="numero" tono="acento" formula="Anuncios con 60 días o más al aire" porQueImporta="Nadie sostiene 60 días lo que no deja plata" retraso={40} />
        <Kpi nombre="Competidores activos" valor={ra.perfiles.filter((p) => p.anunciosActivos > 0).length} unidad="numero" formula={`Con al menos un anuncio al aire · ${num(activos)} anuncios activos en total`} retraso={80} />
        <Kpi nombre="Espacios vacíos" valor={ra.espaciosVacios.length} unidad="numero" tono="bien" formula="Servicio × ángulo × consciencia sin nadie" porQueImporta="Subasta barata y mensaje nuevo" retraso={120} />
        <div className="pieza entra-zoom p-4" style={{ '--retraso': '160ms' } as CSSProperties}>
          <p className="rotulo">Cadencia · anuncios nuevos por semana</p>
          <p className="num mt-2 text-[28px] font-medium leading-none">{num(cadenciaMercado, 1)} <span className="text-[14px] text-texto-2">vs</span> {num(ra.cadenciaPropia, 1)}</p>
          <p className="mt-1.5 text-[12px] text-texto-2">Todo el mercado observado vs. la clínica, últimas {ra.cadencia.semanas} semanas</p>
        </div>
      </Grid>

      <Panel className="mt-3" rotulo="Ganadores probados" titulo="Lo que lleva 60+ días al aire: cópiales la estructura, nunca el copy" retraso={200}>
        <VerTodos total={ganadores.length} primeros={<Galeria lista={ganadores.slice(0, TOPE_GANADORES)} />} resto={ganadores.length > TOPE_GANADORES ? <Galeria lista={ganadores.slice(TOPE_GANADORES)} className="mt-3" /> : null} className={ganadores.length > TOPE_GANADORES ? '' : 'hidden'} />
      </Panel>

      <Panel className="mt-3" rotulo="Quién pauta" titulo="Los competidores, por lo que sostienen al aire" retraso={260}>
        <VerTodos total={perfiles.length} primeros={<Perfiles lista={perfiles.slice(0, TOPE_PERFILES)} />} resto={perfiles.length > TOPE_PERFILES ? <Perfiles lista={perfiles.slice(TOPE_PERFILES)} sinCabecera /> : null} className={perfiles.length > TOPE_PERFILES ? '' : 'hidden'} />
      </Panel>

      <Panel className="mt-3" rotulo="Mapa de ángulos × nivel de consciencia" titulo="Dónde está apretado y dónde no hay nadie" retraso={320}><MapaAngulos anuncios={r.lote.anunciosCompetencia} radar={ra} /></Panel>

      <Panel className="mt-3" tono="marina" rotulo="Dónde no hay nadie" titulo="Las combinaciones que nadie ataca, ya priorizadas" retraso={380}>
        {ra.espaciosDestacados.length === 0 ? (
          <p className="text-[13px] text-celeste">Todavía no hay espacios vacíos priorizados.</p>
        ) : (
          <ol className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-4">
            {ra.espaciosDestacados.map((e, i) => (
              <li key={i} className="brilla rounded-[14px] bg-white/[0.07] p-3 ring-1 ring-white/10">
                <p className="text-[14px] text-white">{nombreServicio(e.servicio)}</p>
                <p className="mt-0.5 text-[11.5px] text-celeste">{ANGULOS[e.angulo]} · nivel {e.nivelConsciencia}: {NIVELES[e.nivelConsciencia]}</p>
                <p className="mt-1.5 text-[12.5px] leading-snug text-[#EAF2FF]">{e.porQue}</p>
              </li>
            ))}
          </ol>
        )}
      </Panel>

      {ra.movimientosSemanales.length > 0 && (
        <Panel className="mt-3" rotulo="Movimientos por semana" titulo="Salidas rápidas = les fue mal, gratis para nosotros" retraso={440}>
          <ul className="grid grid-cols-1 gap-2 md:grid-cols-2">
            {ra.movimientosSemanales.map((m, i) => <li key={m.semana} className="grid grid-cols-[52px_1fr_1fr] items-center gap-2 text-[12px]"><span className="text-texto-2">{m.semana.slice(5)}</span><Barra pct={m.entradas / 10} tono="acento" valor={`${m.entradas} entran`} alto={8} retraso={120 + i * 60} /><Barra pct={m.salidas / 10} tono="neutro" valor={`${m.salidas} salen`} alto={8} retraso={120 + i * 60} /></li>)}
          </ul>
          <Aviso tono="neutro" className="mt-3">El alcance de la competencia no se muestra porque la fuente no lo expone: jamás se estima.</Aviso>
        </Panel>
      )}
    </>
  )
}

function Galeria({ lista, className = '' }: { lista: AnuncioCompetidor[]; className?: string }) {
  return (
    <div className={`grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6 ${className}`}>
      {lista.map((a, i) => (
        <article key={a.anuncioId} className="pieza inclina entra-zoom flex flex-col overflow-hidden" style={{ '--retraso': `${60 + (i % 6) * 50}ms` } as CSSProperties}>
          <div className="relative">
            <Miniatura url={a.urlMedia} tipo={a.tipoMedia} alt={`Anuncio de ${a.nombreAnunciante}: ${a.copy.slice(0, 60)}`} className="aspect-[4/5] w-full" />
            <span className="num absolute left-2 top-2 rounded-full bg-marino px-2 py-0.5 text-[11px] font-semibold text-white">{a.diasCorriendo} días</span>
            {!a.activo && <span className="absolute bottom-2 left-2 rounded-full bg-white/90 px-2 py-0.5 text-[10.5px] font-semibold text-texto-2">ya no corre</span>}
          </div>
          <div className="flex flex-1 flex-col gap-1 p-3">
            <p className="truncate text-[12.5px] font-medium">{a.nombreAnunciante}</p>
            <p className="line-clamp-2 text-[12px] leading-snug text-texto-2">{a.copy}</p>
            <div className="mt-auto pt-1"><Etiqueta tono="acento">{ANGULOS[a.anguloDetectado]}</Etiqueta></div>
          </div>
        </article>
      ))}
    </div>
  )
}

function Perfiles({ lista, sinCabecera = false }: { lista: PerfilCompetidor[]; sinCabecera?: boolean }) {
  return (
    <Tabla minAncho={560} className={sinCabecera ? '-mt-px' : ''}>
      {!sinCabecera && <thead><tr><Th>Competidor</Th><Th num>Anuncios activos</Th><Th num>De 60+ días</Th><Th>Ángulo principal</Th><Th>Usa precio</Th></tr></thead>}
      <tbody>
        {lista.map((p) => (
          <tr key={p.id}>
            <Celda><span className="font-medium">{p.nombre}</span></Celda>
            <Celda num>{num(p.anunciosActivos)}</Celda>
            <Celda num tono={p.anuncios60 ? 'acento' : undefined}>{num(p.anuncios60)}</Celda>
            <Celda>{p.angulos[0] ? ANGULOS[p.angulos[0]] : '—'}</Celda>
            <Celda>{p.usaPrecio > 0 ? <Etiqueta tono="ojo">sí</Etiqueta> : <span className="text-texto-3">no</span>}</Celda>
          </tr>
        ))}
      </tbody>
    </Tabla>
  )
}
