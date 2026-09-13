'use client'
export default function Imprimir() {
  return (
    <button type="button" onClick={() => window.print()} className="no-imprimir inline-flex items-center gap-2 rounded-full bg-marino py-1.5 pl-4 pr-1.5 text-[13px] font-medium text-white hover:bg-marino-2">
      Imprimir o guardar PDF <span className="grid h-7 w-7 place-items-center rounded-full bg-acento"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="M6 9V3h12v6M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2M6 14h12v7H6z" /></svg></span>
    </button>
  )
}
