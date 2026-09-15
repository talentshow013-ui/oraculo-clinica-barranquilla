'use client'
import { useState, type ReactNode } from 'react'

/** Enseña los primeros N y un botón «Ver los M» para el resto: ninguna lista vuelve a medir 38.000 px. */
export default function VerTodos({ primeros, resto, total, className = '' }: { primeros: ReactNode; resto: ReactNode; total: number; className?: string }) {
  const [todo, setTodo] = useState(false)
  return (
    <>
      {primeros}
      {todo && resto}
      {!todo && (
        <div className={`mt-3 flex justify-center ${className}`}>
          <button type="button" onClick={() => setTodo(true)} className="rounded-full bg-superficie-2 px-4 py-2 text-[12.5px] font-medium text-texto ring-1 ring-borde transition-colors hover:bg-hielo">Ver los {total}</button>
        </div>
      )}
    </>
  )
}
