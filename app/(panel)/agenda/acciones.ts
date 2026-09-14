'use server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { RUTA_AGENDA, RegistroSemanalSchema, guardarSemana, semanaDe } from '@/lib/agenda'
import { invalidarCache } from '@/lib/datos'

/**
 * Guarda la semana que escribió la coordinadora. Solo números: el esquema rechaza cualquier otra
 * cosa. Tras guardar, el panel vuelve a calcular con la semana nueva.
 */
const entero = (v: FormDataEntryValue | null): number | null => {
  const t = String(v ?? '').trim().replace(/[.\s]/g, '')
  if (t === '') return null
  const n = Number(t)
  return Number.isFinite(n) ? n : Number.NaN
}

export async function guardarSemanaAccion(datos: FormData): Promise<void> {
  const desde = String(datos.get('semana') ?? '')
  const s = /^\d{4}-\d{2}-\d{2}$/.test(desde) ? semanaDe(desde) : null
  const registro = {
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
  const r = RegistroSemanalSchema.safeParse(registro)
  if (!r.success) {
    const mensaje = r.error.issues[0]?.message ?? 'Revisa los números'
    redirect(`/agenda?semana=${encodeURIComponent(desde)}&error=${encodeURIComponent(mensaje)}`)
  }
  guardarSemana(RUTA_AGENDA, r.data)
  invalidarCache()
  revalidatePath('/', 'layout')
  redirect(`/agenda?guardada=${encodeURIComponent(r.data.desde)}`)
}
