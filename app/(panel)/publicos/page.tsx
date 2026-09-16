import type { CSSProperties } from 'react'
import Link from 'next/link'
import { motor } from '@/lib/datos'
import { cop, num, pct, ratio } from '@/lib/format'
import { fechaCorta } from '@/lib/format/fechas'
import { urlCampanaEnMeta } from '@/lib/format/rutas'
import { NOMBRE_TIPO } from '@/lib/audiences'
import { CRITERIOS_PUBLICO } from '@/config/publicos-referencia'
import type { TipoPublico } from '@/lib/adapters/types'
import type { CuadrantePublico, GrupoPublico, PublicoEvaluado } from '@/lib/tipos'
import { Aviso, Barra, Celda, Etiqueta, Grid, Kpi, Panel, Tabla, Th, Titulo, type Tono } from '@/components/ui'
import VerTodos from '@/components/cliente/ver-todos'
import PlegableEnMovil from '@/components/cliente/plegable-movil'

const TONO: Record<CuadrantePublico, Tono> = { ganador: 'bien', al_costo: 'acento', caro: 'mal', sin_senal: 'neutro' }
const NOMBRE_CUADRANTE: Record<CuadrantePublico, string> = { ganador: 'Gana', al_costo: 'Al costo', caro: 'Caro', sin_senal: 'Sin señal' }
const TOPE = 15
/* el tipo de público va como primer chip, en color; el resto de la segmentación en gris */
const CHIP_TIPO: Record<TipoPublico, string> = {
  advantage: 'bg-marino text-white ring-marino',
  similar: 'bg-acento text-white ring-acento',
  remarketing: 'bg-bien/10 text-bien ring-bien/30',
  intereses: 'bg-ojo/10 text-ojo ring-ojo/30',
  amplio: 'bg-superficie-2 text-texto-2 ring-borde',
}
const MAX_CHIPS = 6
/* recorta por CARACTERES, no por unidades de código: `slice` parte un emoji en dos mitades y el servidor y el navegador dejan de coincidir */
const recortar = (t: string, n: number) => { const c = Array.from(t); return c.length > n ? c.slice(0, n).join('') + '…' : t }
/* un texto que el motor ya recortó puede traer media letra al final (un surrogate suelto): se quita antes de pintar, o el servidor y el navegador no coinciden */
const sinMediaLetra = (t: string) => t.replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g, '')
const AVISO_SIN_PUBLICOS = 'Todavía no se ha traído la segmentación de los conjuntos. Se hace en la sincronización (paso «públicos»).'

/**
 * PÚBLICOS: a quién se le muestra la pauta y cuál de esos públicos rinde. Cuatro bloques que no se
 * mezclan: (1) tus públicos ganadores (dato propio, por conjunto), (2) qué segmentación copiar
 * (dato propio, agrupado), (3) lo que hacen en otras ciudades (Biblioteca de anuncios, verificable),
 * (4) criterio del asesor (no es dato: es lo que se propone probar y con qué corte).
 */
export default async function Publicos() {
  const r = await motor()
  const p = r.publicos
  const ref = r.referencias
  const cop0 = (v: number | null) => cop(v)
  return (
    <>
      <Titulo rotulo="Públicos · a quién se le muestra la pauta y quién responde" extra={p.sinDatos ? undefined : <p className="num text-[12.5px] text-texto-2">{num(p.conjuntos)} conjuntos · {p.desde && p.hasta ? `${fechaCorta(p.desde)} – ${fechaCorta(p.hasta)}` : ''} · referencia {cop0(p.referencia)} por resultado</p>}>¿A quién le funciona la pauta?</Titulo>

      {p.sinDatos ? (
        <>
          <Panel id="ganadores" className="mt-3" rotulo="Bloque 1 · tus públicos ganadores (dato propio)" titulo={<Bloque n={1} tono="acento">Los conjuntos que convierten más barato que la cuenta, con su segmentación</Bloque>} retraso={200}>
            <Aviso tono="neutro">{AVISO_SIN_PUBLICOS}</Aviso>
          </Panel>
          <Panel id="segmentaciones" className="mt-3" tono="marina" rotulo="Bloque 2 · qué segmentación usar (dato propio, agrupado)" titulo={<Bloque n={2} tono="acento">Lo que los números piden probar</Bloque>} retraso={260}>
            <p className="text-[13px] text-celeste">{AVISO_SIN_PUBLICOS}</p>
          </Panel>
        </>
      ) : (
        <>
          <Grid cols={4}>
            <Kpi nombre="Públicos ganadores" valor={p.ganadores.length} unidad="numero" tono="bien" formula="Conjuntos con señal que convierten 10 % o más por debajo de la referencia" retraso={40} />
            <Kpi nombre="Al costo" valor={p.todos.filter((x) => x.cuadrante === 'al_costo').length} unidad="numero" formula="Dentro de ±10 % de la referencia" retraso={80} />
            <Kpi nombre="Caros" valor={p.todos.filter((x) => x.cuadrante === 'caro').length} unidad="numero" tono="mal" formula="Más de 10 % por encima de la referencia" retraso={120} />
            <Kpi nombre="Sin señal" valor={p.todos.filter((x) => x.cuadrante === 'sin_senal').length} unidad="numero" formula="Menos de 2.000 impresiones o 10 resultados: no se juzgan" retraso={160} />
          </Grid>

          <Panel id="ganadores" className="mt-3" rotulo="Bloque 1 · tus públicos ganadores (dato propio)" titulo={<Bloque n={1} tono="acento">Los conjuntos que convierten más barato que la cuenta, con su segmentación</Bloque>} retraso={200} extra={<p className="max-w-[46ch] text-[12.5px] leading-snug text-texto-2">Fuente: segmentación y resultados de cada conjunto en Meta, {p.desde && p.hasta ? `${fechaCorta(p.desde)} – ${fechaCorta(p.hasta)}` : 'periodo cargado'}. Referencia = gasto ÷ resultados de todos los conjuntos.</p>}>
            {p.ganadores.length === 0 ? (
              <Aviso tono="neutro">Ningún conjunto con señal está por debajo de la referencia. Se muestran todos abajo.</Aviso>
            ) : (
              <TablaPublicos lista={p.ganadores} cuentaId={r.cuenta.id} prefijo="ganador" />
            )}
          </Panel>

          <Panel id="segmentaciones" className="mt-3" tono="marina" rotulo="Bloque 2 · qué segmentación usar (dato propio, agrupado)" titulo={<Bloque n={2} tono="acento">Lo que los números piden probar</Bloque>} retraso={260}>
            {p.sugerencias.length === 0 ? (
              <p className="text-[13px] text-celeste">Todavía no hay grupos con 50 resultados o más: falta señal para sugerir.</p>
            ) : (
              <ol className="grid grid-cols-1 gap-2 md:grid-cols-2">
                {p.sugerencias.map((s, i) => (
                  <li key={s.titulo} className="brilla rounded-[14px] bg-white/[0.07] p-3 ring-1 ring-white/10" style={{ '--retraso': `${80 + i * 60}ms` } as CSSProperties}>
                    <p className="text-[14px] font-medium text-white">{s.titulo}</p>
                    <p className="mt-1 text-[12.5px] leading-snug text-[#EAF2FF]">{s.porQue}</p>
                    <ul className="mt-1.5 flex flex-wrap gap-1">{s.evidencia.map((e) => <li key={e} className="rounded-full bg-white/10 px-2 py-0.5 text-[11px] text-celeste">{e}</li>)}</ul>
                    {s.conjuntoId && <Link href={`#${p.ganadores.some((g) => g.conjuntoId === s.conjuntoId) ? 'ganador' : 'conjunto'}-${s.conjuntoId}`} className="mt-2 inline-block text-[12px] font-medium text-celeste underline-offset-2 hover:underline">Ver el conjunto del que sale →</Link>}
                  </li>
                ))}
              </ol>
            )}
          </Panel>

          <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-2">
            <Grupos titulo="Por tipo de público" filas={p.porTipo} referencia={p.referencia} retraso={320} />
            <Grupos titulo="Por rango de edad" filas={p.porEdad} referencia={p.referencia} retraso={360} />
            <Grupos titulo="Por género" filas={p.porGenero} referencia={p.referencia} retraso={400} />
            <Grupos titulo="Por radio alrededor de la clínica" filas={p.porRadio} referencia={p.referencia} retraso={440} />
          </div>

          <Panel id="todos" className="mt-3" rotulo="Todos los conjuntos" titulo="Del que mejor rinde al que peor, con su segmentación" retraso={480}>
            <VerTodos total={p.todos.length} primeros={<TablaPublicos lista={p.todos.slice(0, TOPE)} cuentaId={r.cuenta.id} />} resto={p.todos.length > TOPE ? <TablaPublicos lista={p.todos.slice(TOPE)} cuentaId={r.cuenta.id} sinCabecera /> : null} className={p.todos.length > TOPE ? '' : 'hidden'} />
            <p className="mt-2 text-[11.5px] text-texto-3">Las horas y zonas donde más responden están en <Link href="/audiencias" className="font-medium text-acento">Audiencias</Link>; aquí se mira la segmentación configurada, no el desglose de quién vio el anuncio.</p>
          </Panel>
        </>
      )}

      <Panel id="referencias" className="mt-5" rotulo="Bloque 3 · lo que hacen en otras ciudades (Biblioteca de anuncios, verificable)" titulo={<Bloque n={3} tono="marino">Cartagena, Santa Marta, Medellín y Miami: a quién le hablan y qué sostienen</Bloque>} retraso={520} extra={<p className="max-w-[48ch] text-[12.5px] leading-snug text-texto-2">La Biblioteca no muestra a quién apuntan fuera de Europa: lo que se observa es el mensaje (a quién nombra, qué ángulo, cuánto dura). Cada anuncio tiene su enlace para verificarlo.</p>}>
        {ref.sinDatos ? (
          <Aviso tono="neutro">Todavía no hay capturas de otras ciudades. Se hacen con el capturador del radar apuntando a `datos/referencias/`.</Aviso>
        ) : (
          <>
            {ref.transversal.length > 0 && <ul className="mb-3 grid grid-cols-1 gap-1.5 md:grid-cols-3">{ref.transversal.map((t) => <li key={t} className="rounded-[12px] bg-superficie-2 px-3 py-2 text-[13px] leading-snug">{t}</li>)}</ul>}
            <div className="grid grid-cols-1 items-stretch gap-3 xl:grid-cols-2">
              {ref.ciudades.map((c, i) => (
                <article key={c.ciudad} className="pieza entra-zoom flex h-full flex-col p-4" style={{ '--retraso': `${100 + i * 80}ms` } as CSSProperties}>
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <h3 className="flex items-center gap-2 text-[17px]"><Bandera pais={c.pais} />{c.ciudad} <span className="text-[12px] font-normal text-texto-3">{c.pais === 'CO' ? 'Colombia' : c.pais === 'US' ? 'Estados Unidos' : c.pais}</span></h3>
                    <p className="num text-[12px] text-texto-2">{num(c.anunciantes)} anunciantes · {num(c.anuncios)} anuncios · capturado el {fechaCorta(c.capturadoEn)}</p>
                  </div>
                  <ul className="mt-2 flex flex-col gap-1">{c.aprendizajes.map((a) => <li key={a} className="flex gap-2 text-[13px] leading-snug"><span aria-hidden="true" className="mt-[8px] h-1.5 w-1.5 shrink-0 rounded-full bg-acento" />{a}</li>)}</ul>
                  <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <Senales titulo="A quién le hablan" lista={c.aQuienLeHablan} total={c.anuncios} />
                    <Senales titulo="Ángulos" lista={c.angulos} total={c.anuncios} />
                  </div>
                  {c.ganadores.length > 0 && (
                    <div className="mt-3">
                      <p className="rotulo">Lo que lleva 60+ días al aire</p>
                      <ul className="mt-1.5 flex flex-col gap-1.5">
                        {c.ganadores.slice(0, 4).map((g) => (
                          <li key={g.anuncioId} className="rounded-[12px] bg-superficie-2 px-3 py-2">
                            <p className="flex flex-wrap items-center gap-x-2 text-[12.5px]"><span className="font-medium">{g.nombreAnunciante}</span><span className="num text-texto-2">{g.diasCorriendo} días{g.activo ? '' : ' · ya no corre'}</span><a href={g.verificar} target="_blank" rel="noopener noreferrer" className="shrink-0 whitespace-nowrap rounded-full bg-acento/[0.08] px-2 py-0.5 text-[11.5px] font-medium text-acento ring-1 ring-acento/20 transition hover:bg-acento/[0.14]" title="Abrir este anuncio en la Biblioteca de anuncios de Meta">Verificar ↗</a></p>
                            <p className="mt-0.5 line-clamp-2 text-[12px] leading-snug text-texto-2">{sinMediaLetra(g.copy)}</p>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </article>
              ))}
            </div>
          </>
        )}
      </Panel>

      <Panel id="criterio" className="mt-5" rotulo="Bloque 4 · criterio del asesor (no es dato: es lo que se propone probar)" titulo={<Bloque n={4} tono="gris">Los públicos que más le sirven a una clínica estética, y cómo armarlos</Bloque>} retraso={600} extra={<p className="max-w-[46ch] text-[12.5px] leading-snug text-texto-2">Cada uno trae por qué, cómo se arma en Meta y con qué criterio se corta. Se ajusta con los resultados propios de arriba.</p>}>
        <ol className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {CRITERIOS_PUBLICO.map((c, i) => (
            <li key={c.id} className="rounded-[14px] border border-borde bg-superficie p-3.5" style={{ '--retraso': `${80 + i * 50}ms` } as CSSProperties}>
              <PlegableEnMovil cabecera={<><p className="rotulo">Público {i + 1}</p><p className="mt-0.5 text-[14.5px] font-medium leading-tight">{c.publico}</p></>}>
                <p className="mt-1.5 text-[12.5px] text-texto-2"><span className="font-semibold text-texto">Para qué:</span> {c.paraQue}</p>
                <p className="mt-1 text-[12.5px] leading-snug text-texto-2"><span className="font-semibold text-texto">Por qué:</span> {c.porQue}</p>
                <p className="mt-1 text-[12.5px] leading-snug"><span className="font-semibold">Cómo armarlo:</span> {c.comoArmarlo}</p>
                <p className="mt-1.5 rounded-[10px] bg-mal/[0.06] px-2.5 py-1.5 text-[12px] leading-snug ring-1 ring-mal/15"><span className="font-semibold text-mal">Corte:</span> {c.corte}</p>
                <div className="mt-2 flex flex-wrap gap-1">{c.servicios.map((s) => <Etiqueta key={s} tono="neutro">{r.cliente.servicios.find((x) => x.id === s)?.nombre ?? s}</Etiqueta>)}</div>
              </PlegableEnMovil>
            </li>
          ))}
        </ol>
      </Panel>
    </>
  )
}

function TablaPublicos({ lista, cuentaId, sinCabecera = false, prefijo = 'conjunto' }: { lista: PublicoEvaluado[]; cuentaId: string; sinCabecera?: boolean; prefijo?: string }) {
  return (
    <Tabla minAncho={860} className={sinCabecera ? '-mt-px' : ''}>
      {!sinCabecera && <thead><tr><Th>#</Th><Th>Conjunto · segmentación</Th><Th>Decisión</Th><Th num>Resultados</Th><Th num>Costo</Th><Th num>vs. cuenta</Th><Th num>Inversión</Th><Th num>Frecuencia</Th><Th>Estado</Th></tr></thead>}
      <tbody>
        {lista.map((x) => (
          <tr key={x.conjuntoId} id={`${prefijo}-${x.conjuntoId}`} className="scroll-mt-4 target:bg-acento/10 target:ring-2 target:ring-acento">
            <Celda num>{x.puesto}</Celda>
            <Celda>
              <span className="block max-w-[420px]">
                <span className="block truncate font-medium">{x.nombre}</span>
                <Segmentacion tipo={x.segmentacion.tipo} resumen={x.resumen} />
                <span className="block text-[11px] text-texto-3">{x.campanaNombre ? `campaña: ${recortar(x.campanaNombre, 60)}` : ''}{x.campanaId && <> · <a href={urlCampanaEnMeta(cuentaId, x.campanaId)} target="_blank" rel="noopener noreferrer" className="font-medium text-acento">Abrir en Meta ↗</a></>}</span>
              </span>
            </Celda>
            <Celda><Etiqueta tono={TONO[x.cuadrante]}>{NOMBRE_CUADRANTE[x.cuadrante]}</Etiqueta></Celda>
            <Celda num>{num(x.resultados)}</Celda>
            <Celda num>{cop(x.costoResultado)}</Celda>
            <Celda num tono={x.diferencia === null ? undefined : x.diferencia < -0.1 ? 'bien' : x.diferencia > 0.1 ? 'mal' : undefined}>{x.diferencia === null ? '—' : `${x.diferencia > 0 ? '+' : ''}${Math.round(x.diferencia * 100)} %`}</Celda>
            <Celda num>{cop(x.gasto)}</Celda>
            <Celda num>{ratio(x.frecuencia)}</Celda>
            <Celda>{x.estado === 'activo' ? <Etiqueta tono="bien">al aire</Etiqueta> : <span className="text-[12px] text-texto-3">{x.estado}</span>}</Celda>
          </tr>
        ))}
      </tbody>
    </Tabla>
  )
}

function Grupos({ titulo, filas, referencia, retraso }: { titulo: string; filas: GrupoPublico[]; referencia: number | null; retraso: number }) {
  const maxResultados = Math.max(1, ...filas.map((g) => g.resultados))
  /* la fila «mejor» es la del grupo con el costo por resultado más bajo entre los que tienen costo */
  const conCosto = filas.filter((g) => g.costoResultado !== null)
  const mejorClave = conCosto.length ? conCosto.reduce((a, b) => (b.costoResultado! < a.costoResultado! ? b : a)).clave : null
  return (
    <Panel rotulo={titulo} titulo="Costo por resultado del grupo (sumas, no promedios)" retraso={retraso}>
      <Tabla minAncho={460}>
        <thead><tr><Th>Grupo</Th><Th num>Conjuntos</Th><Th className="min-w-[150px]">Resultados</Th><Th num>Costo</Th><Th num>vs. ref.</Th></tr></thead>
        <tbody>
          {filas.map((g, i) => {
            const d = g.costoResultado !== null && referencia ? g.costoResultado / referencia - 1 : null
            const mejor = g.clave === mejorClave
            return (
              <tr key={g.clave} className={mejor ? 'font-semibold' : ''}>
                <Celda><span className="font-medium">{g.etiqueta}</span>{mejor && <Etiqueta tono="bien" className="ml-1.5 align-middle">mejor</Etiqueta>}{g.mejor && <span className="block text-[11px] font-normal text-texto-3">mejor conjunto: {recortar(g.mejor.nombre, 40)}</span>}</Celda>
                <Celda num>{num(g.conjuntos)}</Celda>
                <Celda className="min-w-[150px]"><Barra pct={g.resultados / maxResultados} tono={mejor ? 'bien' : 'acento'} valor={num(g.resultados)} alto={6} retraso={120 + i * 40} /></Celda>
                <Celda num>{cop(g.costoResultado)}</Celda>
                <Celda num tono={d === null ? undefined : d < -0.1 ? 'bien' : d > 0.1 ? 'mal' : undefined}>{d === null ? '—' : `${d > 0 ? '+' : ''}${Math.round(d * 100)} %`}</Celda>
              </tr>
            )
          })}
        </tbody>
      </Tabla>
    </Panel>
  )
}

function Senales({ titulo, lista, total }: { titulo: string; lista: { clave: string; etiqueta: string; anuncios: number }[]; total: number }) {
  return (
    <div className="rounded-[12px] bg-superficie-2 p-2.5">
      <p className="rotulo">{titulo}</p>
      {lista.length === 0 ? <p className="mt-1 text-[12px] text-texto-3">Nadie lo nombra en el texto.</p> : (
        <ul className="mt-1 flex flex-col gap-0.5">{lista.slice(0, 5).map((s) => <li key={s.clave} className="flex justify-between gap-2 text-[12px]"><span>{s.etiqueta}</span><span className="num text-texto-2">{s.anuncios} · {pct(s.anuncios / Math.max(1, total), 0)}</span></li>)}</ul>
      )}
    </div>
  )
}

/** El número del bloque en círculo, a la izquierda del título: acento = dato propio, marino = mercado, gris = criterio. */
function Bloque({ n, tono, children }: { n: number; tono: 'acento' | 'marino' | 'gris'; children: React.ReactNode }) {
  const color = tono === 'acento' ? 'bg-acento' : tono === 'marino' ? 'bg-marino ring-1 ring-white/20' : 'bg-borde-fuerte'
  return (
    <span className="flex items-center gap-3">
      <span aria-hidden="true" className={`num grid h-9 w-9 shrink-0 place-items-center rounded-full text-[16px] font-semibold text-white ${color}`}>{n}</span>
      <span>{children}</span>
    </span>
  )
}

/** La segmentación como chips: el tipo de público en color y las demás partes del resumen en gris (máximo 6, «+N»). */
function Segmentacion({ tipo, resumen }: { tipo: TipoPublico; resumen: string }) {
  const partes = resumen.split(' · ').map((x) => x.trim()).filter(Boolean)
  const nombreTipo = NOMBRE_TIPO[tipo]
  const resto = partes.filter((x) => x !== nombreTipo)
  const visibles = resto.slice(0, MAX_CHIPS - 1)
  const ocultas = resto.length - visibles.length
  return (
    <span className="mt-1 flex flex-wrap gap-1" title={resumen}>
      <span className={`inline-flex max-w-full items-center whitespace-nowrap rounded-full px-2 py-0.5 text-[10.5px] font-semibold ring-1 ${CHIP_TIPO[tipo]}`}>{nombreTipo}</span>
      {visibles.map((x) => <span key={x} className="inline-flex max-w-[220px] items-center rounded-full bg-superficie-2 px-2 py-0.5 text-[10.5px] font-medium text-texto-2 ring-1 ring-borde"><span className="truncate">{x}</span></span>)}
      {ocultas > 0 && <span className="inline-flex items-center rounded-full px-1.5 py-0.5 text-[10.5px] font-medium text-texto-3">+{ocultas}</span>}
    </span>
  )
}

/**
 * La bandera junto al nombre de la ciudad. Va en SVG y no como emoji (🇨🇴 / 🇺🇸) porque Windows no
 * dibuja las banderas: muestra «CO» / «US» en letras chicas. El emoji queda como nombre accesible.
 */
function Bandera({ pais }: { pais: string }) {
  if (pais === 'CO') {
    return (
      <svg width="22" height="15" viewBox="0 0 22 15" role="img" aria-label="Colombia 🇨🇴" className="shrink-0 rounded-[3px] ring-1 ring-borde">
        <rect width="22" height="7.5" fill="#FCD116" /><rect y="7.5" width="22" height="3.75" fill="#003893" /><rect y="11.25" width="22" height="3.75" fill="#CE1126" />
      </svg>
    )
  }
  if (pais === 'US') {
    return (
      <svg width="22" height="15" viewBox="0 0 22 15" role="img" aria-label="Estados Unidos 🇺🇸" className="shrink-0 rounded-[3px] ring-1 ring-borde">
        <rect width="22" height="15" fill="#fff" />
        {[0, 2, 4, 6, 8, 10, 12].map((y) => <rect key={y} y={y * 15 / 13} width="22" height={15 / 13} fill="#B22234" />)}
        <rect width="9" height="8" fill="#3C3B6E" />
      </svg>
    )
  }
  return <span className="text-[11px] text-texto-3">{pais}</span>
}
