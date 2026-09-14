'use server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { RUTA_RESULTADOS, RegistroPautaSchema, guardarResultado } from '@/lib/resultados'
import { invalidarCache, motor } from '@/lib/datos'

/**
 * Guarda los resultados de UNA campaña (los que Meta no ve): contactos cerrados, citas agendadas,
 * citas asistidas, ventas y valor. Para la cuenta que se está viendo. Solo números: el esquema
 * rechaza cualquier otra cosa. Tras guardar, el panel vuelve a calcular.
 */
const entero = (v: FormDataEntryValue | null): number | null => {
  const t = String(v ?? '').trim().replace(/[.\s]/g, '')
  if (t === '') return null
  const n = Number(t)
  return Number.isFinite(n) ? n : Number.NaN
}

export async function guardarResultadosPautaAccion(datos: FormData): Promise<void> {
  const r = await motor()
  const campanaId = String(datos.get('campana') ?? '')
  const volver = (q: Record<string, string>) => redirect(`/campanas?${new URLSearchParams(q).toString()}#resultados`)
  if (!r.campanas.some((c) => c.id === campanaId)) volver({ error: 'Elige una campaña de esta cuenta' })
  const registro = {
    cuentaId: r.cuenta.id,
    campanaId,
    contactosCerrados: entero(datos.get('contactosCerrados')) ?? 0,
    citasAgendadas: entero(datos.get('citasAgendadas')) ?? 0,
    citasAsistidas: entero(datos.get('citasAsistidas')) ?? 0,
    ventas: entero(datos.get('ventas')) ?? 0,
    valorVentasCOP: entero(datos.get('valorVentasCOP')),
    registradoEn: new Date().toISOString(),
  }
  const v = RegistroPautaSchema.safeParse(registro)
  if (!v.success) volver({ registrar: campanaId, error: v.error.issues[0]?.message ?? 'Revisa los números' })
  guardarResultado(RUTA_RESULTADOS, v.data!)
  invalidarCache()
  revalidatePath('/', 'layout')
  volver({ guardada: campanaId })
}
