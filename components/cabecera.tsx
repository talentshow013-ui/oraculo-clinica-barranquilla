import Link from 'next/link'
import type { ResultadoMotor } from '@/lib/tipos'
import { fechaLarga, fechaHora } from '@/lib/format/fechas'
import { cop } from '@/lib/format'
import MenuMovil from './cliente/menu-movil'
import SelectorCuenta from './cliente/selector-cuenta'
import SelectorCampana from './cliente/selector-campana'
import SelectorPeriodo from './cliente/selector-periodo'
import Ayuda from './cliente/ayuda'
import CabeceraModo from './cliente/cabecera-modo'
import { IconoRed } from './iconos-redes'

/**
 * La barra de estado, en UNA fila: la cuenta publicitaria que se analiza (se cambia aquí), la
 * campaña (todas o una: todo el panel se recalcula), el periodo, dos chips de estado (huecos · avisos) que se explican al pasar el mouse, y la
 * plata en riesgo. Huecos, advertencias y ventana de atribución siguen SIEMPRE a la vista, pero
 * plegados en su chip, no en frases recortadas.
 */
export default function Cabecera({ r }: { r: ResultadoMotor }) {
  const m = r.lote.meta
  const ventana = r.lote.insights[0]?.ventanaAtribucion ?? '—'
  const nHuecos = m.huecos.length, nAvisos = m.advertencias.length
  const periodo = (
    <Ayuda titulo={`Atribución: ${ventana}`} texto={`${m.origen}. Sincronizado ${fechaHora(r.cuenta.ultimaSincronizacion)}. Cambiar la ventana de atribución cambia los números.`} className="hidden md:block">
      <SelectorPeriodo periodo={r.periodo} />
    </Ayuda>
  )
  /* Orgánico: las redes conectadas, con su ícono, en el lugar de la cuenta publicitaria */
  const redes = r.organico.redes
  const cabeceraOrganico = (
    <>
      <div className="flex items-center gap-2 rounded-full bg-marino px-3 py-1.5 text-white">
        <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-celeste">Orgánico</span>
        {redes.length === 0 ? <span className="text-[12.5px]">Sin conectar</span> : redes.map((x) => (
          <span key={x.red} className="flex items-center gap-1.5 text-[12.5px]" title={`${x.red === 'instagram' ? '@' : ''}${x.alias}`}><IconoRed red={x.red} /><span className="hidden lg:inline">{x.red === 'instagram' ? `@${x.alias}` : x.alias}</span></span>
        ))}
      </div>
      <Ayuda titulo="Periodo" texto="Se recortan las publicaciones y la serie diaria a estas fechas." className="hidden md:block"><SelectorPeriodo periodo={r.periodo} /></Ayuda>
      <div className="ml-auto flex items-center gap-1.5">
        {r.organico.capturadoEn && <span className="hidden text-[12px] text-texto-3 sm:inline">Traído {fechaHora(r.organico.capturadoEn)}</span>}
        <Link href="/organico#fuente" className="rounded-full bg-superficie-2 px-2.5 py-1 text-[12px] font-semibold text-texto-2 ring-1 ring-borde hover:bg-hielo">De dónde sale</Link>
      </div>
    </>
  )
  const cabeceraGoogle = (
    <>
      <div className="flex items-center gap-2 rounded-full bg-marino px-3 py-1.5 text-white">
        <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-celeste">Google</span>
        <span className="flex items-center gap-1.5 text-[12.5px]"><IconoRed red="google" /><span className="hidden lg:inline">Sitio web · Analytics</span></span>
      </div>
      <Ayuda titulo="Periodo" texto="Se recortan las visitas y contactos a estas fechas." className="hidden md:block"><SelectorPeriodo periodo={r.periodo} /></Ayuda>
      <div className="ml-auto flex items-center gap-1.5">
        {r.web.capturadoEn && <span className="hidden text-[12px] text-texto-3 sm:inline">Traído {fechaHora(r.web.capturadoEn)}</span>}
        <Link href="/web#fuente" className="rounded-full bg-superficie-2 px-2.5 py-1 text-[12px] font-semibold text-texto-2 ring-1 ring-borde hover:bg-hielo">De dónde sale</Link>
      </div>
    </>
  )
  return (
    <header className="no-imprimir sticky top-0 z-30 border-b border-borde bg-superficie/92 backdrop-blur-md">
      <div className="mx-auto flex h-[60px] max-w-[1400px] items-center gap-3 px-4 sm:px-6">
        <MenuMovil />
        <CabeceraModo organico={cabeceraOrganico} google={cabeceraGoogle} pauta={<>
        <SelectorCuenta cuentas={r.cuentas} actual={r.cuenta} />
        <SelectorCampana campanas={r.campanasCuenta} actual={r.campanaActiva} />

        {periodo}

        <div className="ml-auto flex items-center gap-1.5">
          {nHuecos > 0 && (
            <Ayuda titulo={`${nHuecos} ${nHuecos === 1 ? 'día sin datos' : 'días sin datos'}`} texto={`${m.huecos.map(fechaLarga).join(' · ')}. Se excluyen de los cálculos y van rayados en las gráficas; no se rellenan con ceros.`}>
              <Link href="/fuentes" className="flex items-center gap-1.5 rounded-full bg-ojo/10 px-2.5 py-1 text-[12px] font-semibold text-ojo ring-1 ring-ojo/25 transition-colors hover:bg-ojo/15" aria-label={`${nHuecos} días sin datos`}><span className="h-1.5 w-1.5 rounded-full bg-ojo" aria-hidden="true" />{nHuecos}</Link>
            </Ayuda>
          )}
          {nAvisos > 0 && (
            <Ayuda titulo={`${nAvisos} ${nAvisos === 1 ? 'aviso' : 'avisos'} sobre los datos`} texto={m.advertencias.join(' · ')}>
              <Link href="/fuentes" className="flex items-center gap-1.5 rounded-full bg-superficie-2 px-2.5 py-1 text-[12px] font-semibold text-texto-2 ring-1 ring-borde transition-colors hover:bg-hielo" aria-label={`${nAvisos} avisos sobre los datos`}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M12 8v5M12 16v.5" /></svg>{nAvisos}
              </Link>
            </Ayuda>
          )}
          <Link href="/diagnostico" className="late ml-1 flex items-center gap-2 rounded-full bg-mal/10 py-1 pl-3 pr-1.5 text-[12.5px] font-medium text-mal ring-1 ring-mal/30 transition-colors hover:bg-mal/15">
            <span className="hidden sm:inline">Plata en riesgo</span><span className="num rounded-full bg-mal px-2.5 py-1 text-[12.5px] text-white">{cop(r.plataEnRiesgoTotal)}</span>
          </Link>
        </div>
        </>} />
      </div>
    </header>
  )
}
