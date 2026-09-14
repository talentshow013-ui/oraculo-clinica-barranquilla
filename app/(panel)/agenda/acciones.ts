'use server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { RUTA_AGENDA, RegistroSemanalSchema, guardarSemana, semanaDe } from '@/lib/agenda'
import { invalidarCache, motor } from '@/lib/datos'

/**
 * Guarda la semana que escribió la coordinadora, para la cuenta que está viendo (cookie) y la
 * campaña que eligió («toda la cuenta» si no sabe de cuál). Solo números: el esquema rechaza
 * cualquier otra cosa. Tras guardar, el panel vuelve a calcular con la semana nueva.
 */
const entero = (v: FormDataEntryValue | null): number | null => {
  const t = String(v ?? '').trim().replace(/[.\s]/g, '')
  if (t === '') return null
  const n = Number(t)
  return Number.isFinite(n) ? n : Number.NaN
}

export async function guardarSemanaAccion(datos: FormData): Promise<void> {
  const r = await motor()
  const desde = String(datos.get('semana') ?? '')
  const s = /^\d{4}-\d{2}-\d{2}$/.test(desde) ? semanaDe(desde) : null
  const campanaElegida = String(datos.get('campana') ?? '')
  // Solo una campaña de la cuenta que se está viendo; cualquier otra cosa = «toda la cuenta».
  const campanaId = r.campanas.some((c) => c.id === campanaElegida) ? campanaElegida : null
  const registro = {
    cuentaId: r.cuenta.id,
    campanaId,
    desde: s?.desde ?? '',
    hasta: s?.hasta ?? '',
    contactosCalificados: entero(datos.get('contactosCalificados')) ?? 0,
    citasAgendadas: entero(datos.get('citasAgendadas')) ?? 0,
    citasAsistidas: entero(datos.get('citasAsistidas')) ?? 0,
    ventas: entero(datos.get('ventas')) ?? 0,
    valorVentasCOP: entero(datos.get('valorVentasCOP')),
    recompras: entero(datos.get('recompras')),
    registradoEn: new Date().toISOString(),
  }
  const v = RegistroSemanalSchema.safeParse(registro)
  if (!v.success) {
    const mensaje = v.error.issues[0]?.message ?? 'Revisa los números'
    redirect(`/agenda?semana=${encodeURIComponent(desde)}&campana=${encodeURIComponent(campanaId ?? '')}&error=${encodeURIComponent(mensaje)}`)
  }
  guardarSemana(RUTA_AGENDA, v.data)
  invalidarCache()
  revalidatePath('/', 'layout')
  redirect(`/agenda?guardada=${encodeURIComponent(v.data.desde)}&campana=${encodeURIComponent(campanaId ?? '')}`)
}
