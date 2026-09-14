'use server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { RESULTADOS_EXPERIMENTO, TIPOS_PRUEBA } from '@/lib/adapters/types'
import { RUTA_REUNIONES, agregarDecision, crearReunion, evaluarDecision, guardarReuniones, leerReuniones, sinDatosPersonales } from '@/lib/reuniones'
import { invalidarCache, motor } from '@/lib/datos'

/**
 * Bitácora de la reunión quincenal. Tres acciones, todas para la cuenta que se está viendo:
 *  - abrirReunionAccion: crea la reunión de hoy con la FOTO de las cifras que mandan (la pone el motor).
 *  - agregarDecisionAccion: anota una decisión con la métrica con la que se juzgará.
 *  - evaluarDecisionAccion: en la siguiente reunión, cierra la decisión (ganó / perdió / sin señal).
 * Cada una redirige a /reunion con ?ok= o ?error= para que la pantalla lo muestre.
 */
const texto = (v: FormDataEntryValue | null) => String(v ?? '').trim()
const entero = (v: FormDataEntryValue | null): number | null => {
  const t = texto(v).replace(/[.\s]/g, '').replace(',', '.')
  if (t === '') return null
  const n = Number(t)
  return Number.isFinite(n) ? n : null
}
const volver = (q: Record<string, string>): never => {
  const s = new URLSearchParams(q).toString()
  redirect(`/reunion${s ? `?${s}` : ''}`)
}
const refrescar = () => {
  invalidarCache()
  revalidatePath('/', 'layout')
}

export async function abrirReunionAccion(datos: FormData): Promise<void> {
  const r = await motor()
  const fecha = /^\d{4}-\d{2}-\d{2}$/.test(texto(datos.get('fecha'))) ? texto(datos.get('fecha')) : r.hoy
  const existentes = leerReuniones(RUTA_REUNIONES)
  if (existentes.some((x) => x.cuentaId === r.cuenta.id && x.fecha === fecha)) volver({ error: `Ya hay una reunión abierta el ${fecha} para esta cuenta` })
  const nueva = crearReunion({ cuentaId: r.cuenta.id, fecha, foto: r.fotoActual, registradaEn: new Date().toISOString() })
  guardarReuniones(RUTA_REUNIONES, [...existentes, nueva])
  refrescar()
  volver({ ok: 'reunion', reunion: nueva.id })
}

export async function agregarDecisionAccion(datos: FormData): Promise<void> {
  const r = await motor()
  const reunionId = texto(datos.get('reunion'))
  const existentes = leerReuniones(RUTA_REUNIONES)
  const reunion = existentes.find((x) => x.id === reunionId && x.cuentaId === r.cuenta.id)
  if (!reunion) volver({ error: 'No se encontró la reunión' })
  const t = texto(datos.get('texto'))
  if (!sinDatosPersonales(t)) volver({ reunion: reunionId, error: 'La decisión habla de pauta: sin teléfonos, correos ni datos de pacientes' })
  const tipo = texto(datos.get('tipoPrueba'))
  const tipoPrueba = (TIPOS_PRUEBA as ReadonlyArray<string>).includes(tipo) ? (tipo as (typeof TIPOS_PRUEBA)[number]) : 'proceso'
  const metricaElegida = texto(datos.get('metricaId'))
  const metricaId = reunion!.foto.metricas.some((m) => m.id === metricaElegida) ? metricaElegida : null
  const evaluarEl = texto(datos.get('evaluarEl'))
  let actualizada
  try {
    actualizada = agregarDecision(reunion!, { texto: t, metricaId, objetivo: entero(datos.get('objetivo')), tipoPrueba, ...(/^\d{4}-\d{2}-\d{2}$/.test(evaluarEl) ? { evaluarEl } : {}) })
  } catch (e) {
    volver({ reunion: reunionId, error: e instanceof Error ? e.message.split('\n')[0]! : 'Revisa la decisión' })
  }
  guardarReuniones(RUTA_REUNIONES, existentes.map((x) => (x.id === reunionId ? actualizada! : x)))
  refrescar()
  volver({ ok: 'decision', reunion: reunionId })
}

export async function evaluarDecisionAccion(datos: FormData): Promise<void> {
  const r = await motor()
  const decisionId = texto(datos.get('decision'))
  const resultado = texto(datos.get('resultado'))
  if (!(RESULTADOS_EXPERIMENTO as ReadonlyArray<string>).includes(resultado) || resultado === 'en_curso') volver({ error: 'Elige ganó, perdió o sin señal' })
  const aprendizaje = texto(datos.get('aprendizaje'))
  if (aprendizaje && !sinDatosPersonales(aprendizaje)) volver({ error: 'El aprendizaje habla de pauta: sin teléfonos, correos ni datos de pacientes' })
  const existentes = leerReuniones(RUTA_REUNIONES)
  if (!existentes.some((x) => x.cuentaId === r.cuenta.id && x.decisiones.some((d) => d.id === decisionId))) volver({ error: 'No se encontró la decisión' })
  const cerradas = evaluarDecision(existentes, decisionId, { resultado: resultado as 'gano' | 'perdio' | 'sin_senal', aprendizaje: aprendizaje || null }, r.fotoActual, new Date().toISOString())
  guardarReuniones(RUTA_REUNIONES, cerradas)
  refrescar()
  volver({ ok: 'evaluada' })
}
