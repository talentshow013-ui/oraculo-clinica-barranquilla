import type { CSSProperties } from 'react'
import { motor } from '@/lib/datos'
import { num, pct } from '@/lib/format'
import { ANGULOS, NIVELES } from '@/lib/format/etiquetas'
import { Aviso, Barra, Celda, Etiqueta, Grid, Kpi, Miniatura, Panel, Tabla, Th, Titulo } from '@/components/ui'
import MapaAngulos from '@/components/graficas/mapa-angulos'

/** RADAR DE MERCADO: lo único honesto es cuánto tiempo lleva un anuncio al aire. Ganadores de 60+, ángulos saturados y espacios vacíos. */
export default async function Competencia() {
  const r = await motor()
  const ra = r.radar
  const activos = r.lote.anunciosCompetencia.filter((a) => a.activo).length
  return (
    <>
      <Titulo rotulo="Radar de mercado · se ordena por longevidad, nunca por métricas estimadas" extra={<p className="num text-[12.5px] text-texto-2">{ra.perfiles.length} competidores · {r.lote.anunciosCompetencia.length} anuncios · {activos} activos</p>}>Qué sostiene el mercado y dónde hay espacio</Titulo>
      <Grid cols={4}>
        <Kpi nombre="Ganadores probados (60+ días)" valor={ra.ganadores.length} unidad="numero" tono="acento" formula="Anuncios con 60 días o más al aire" porQueImporta="Nadie sostiene 60 días lo que no deja plata" retraso={40} />
        <Kpi nombre="Espacios vacíos" valor={ra.espaciosVacios.length} unidad="numero" tono="bien" formula="Servicio × ángulo × consciencia sin nadie" porQueImporta="Subasta barata y mensaje nuevo" retraso={80} />
        <Kpi nombre="El mercado usa precio" valor={ra.usoPrecio} unidad="porcentaje" formula="Anuncios con precio ÷ total" retraso={120} />
        <Kpi nombre="Cadencia propia vs. la mayor" valor={ra.cadenciaPropia} unidad="ratio" previo={Math.max(...ra.cadenciaPorCompetidor.map((c) => c.porSemana))} mejorEs="mayor" formula="Piezas nuevas por semana" retraso={160} />
      </Grid>

      <section className="mt-5" aria-label="Galería de ganadores probados">
        <div className="mb-3"><p className="rotulo">Galería · ganadores probados</p><h2 className="mt-0.5 text-[19px]">Lo que lleva 60+ días al aire: cópiales la estructura, nunca el copy</h2></div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
          {ra.ganadores.map((a, i) => (
            <article key={a.anuncioId} className="pieza inclina entra-zoom flex flex-col overflow-hidden" style={{ '--retraso': `${100 + i * 60}ms` } as CSSProperties}>
              <div className="relative">
                <Miniatura url={a.urlMedia} tipo={a.tipoMedia} alt={`Anuncio de ${a.nombreAnunciante}: ${a.copy.slice(0, 60)}`} className="aspect-[4/5] w-full" />
                <span className="num absolute left-2 top-2 rounded-full bg-marino px-2 py-0.5 text-[11px] font-semibold text-white">{a.diasCorriendo} días</span>
                {a.variantesDelConcepto > 1 && <span className="num absolute right-2 top-2 rounded-full bg-acento px-2 py-0.5 text-[11px] font-semibold text-white">×{a.variantesDelConcepto}</span>}
                {!a.activo && <span className="absolute bottom-2 left-2 rounded-full bg-white/90 px-2 py-0.5 text-[10.5px] font-semibold text-texto-2">ya no corre</span>}
              </div>
              <div className="flex flex-1 flex-col gap-1 p-3">
                <p className="truncate text-[12.5px] font-medium">{a.nombreAnunciante}</p>
                <p className="line-clamp-2 text-[12px] leading-snug text-texto-2">{a.copy}</p>
                <div className="mt-auto flex flex-wrap gap-1 pt-1"><Etiqueta tono="acento">{ANGULOS[a.anguloDetectado]}</Etiqueta>{a.cta && <Etiqueta tono="neutro">{a.cta}</Etiqueta>}</div>
              </div>
            </article>
          ))}
        </div>
      </section>

      <div className="mt-5 grid grid-cols-1 gap-3 lg:grid-cols-12">
        <Panel rotulo="Mapa de ángulos × nivel de consciencia" titulo="Dónde está apretado y dónde no hay nadie" className="lg:col-span-7" retraso={200}><MapaAngulos anuncios={r.lote.anunciosCompetencia} radar={ra} /></Panel>
        <Panel tono="marina" rotulo="Espacios vacíos" titulo="Las combinaciones que nadie ataca" className="lg:col-span-5" retraso={260}>
          <ol className="flex flex-col gap-2">
            {ra.espaciosVacios.map((e, i) => (
              <li key={i} className="brilla rounded-[14px] bg-white/[0.07] p-3 ring-1 ring-white/10">
                <p className="text-[14px] text-white">{e.servicio} · {ANGULOS[e.angulo]}</p>
                <p className="text-[11.5px] text-celeste">Nivel {e.nivelConsciencia}: {NIVELES[e.nivelConsciencia]}</p>
                <p className="mt-1 text-[12.5px] leading-snug text-[#EAF2FF]">{e.porQue}</p>
              </li>
            ))}
          </ol>
        </Panel>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-12">
        <Panel rotulo="Perfiles" titulo="Los competidores" className="lg:col-span-7" retraso={320}>
          <Tabla minAncho={560}>
            <thead><tr><Th>Competidor</Th><Th num>Seguidores</Th><Th num>Activos</Th><Th num>60+ días</Th><Th num>Piezas/semana</Th><Th num>Voz</Th><Th>Página</Th></tr></thead>
            <tbody>
              {ra.perfiles.map((p) => {
                const cad = ra.cadenciaPorCompetidor.find((c) => c.competidorId === p.id)?.porSemana ?? null
                const voz = ra.vozPorCompetidor.find((c) => c.competidorId === p.id)?.porcentaje ?? null
                return <tr key={p.id}><Celda><span className="font-medium">{p.nombre}</span></Celda><Celda num>{num(p.seguidoresPagina)}</Celda><Celda num>{num(p.anunciosActivos)}</Celda><Celda num tono={p.anuncios60 ? 'acento' : undefined}>{num(p.anuncios60)}</Celda><Celda num>{cad == null ? '—' : cad.toFixed(1).replace('.', ',')}</Celda><Celda num>{pct(voz, 0)}</Celda><Celda>{p.urlPagina ? <a href={p.urlPagina} target="_blank" rel="noreferrer" className="text-acento hover:underline">abrir</a> : '—'}</Celda></tr>
              })}
            </tbody>
          </Tabla>
        </Panel>
        <Panel rotulo="Entradas y salidas · 8 semanas" titulo="Salidas rápidas = les fue mal, gratis para nosotros" className="lg:col-span-5" retraso={380}>
          <ul className="flex flex-col gap-2">
            {ra.movimientosSemanales.map((m, i) => <li key={m.semana} className="grid grid-cols-[52px_1fr_1fr] items-center gap-2 text-[12px]"><span className="text-texto-2">{m.semana.slice(5)}</span><Barra pct={m.entradas / 10} tono="acento" valor={`${m.entradas} entran`} alto={8} retraso={120 + i * 60} /><Barra pct={m.salidas / 10} tono="neutro" valor={`${m.salidas} salen`} alto={8} retraso={120 + i * 60} /></li>)}
          </ul>
          <Aviso tono="neutro" className="mt-3">El alcance de la competencia no se muestra porque la fuente no lo expone: jamás se estima.</Aviso>
        </Panel>
      </div>
    </>
  )
}
