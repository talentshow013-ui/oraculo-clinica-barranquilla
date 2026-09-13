import { motor } from '@/lib/datos'
import Sidebar from '@/components/sidebar'
import Cabecera from '@/components/cabecera'

// La cuenta elegida viaja en cookie: cada petición se renderiza con la suya.
export const dynamic = 'force-dynamic'

/** El marco: riel marino a la izquierda (4 grupos), barra de estado arriba, el contenido en su bruma. */
export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const r = await motor()
  return (
    <div className="flex min-h-[100svh]">
      <Sidebar cliente={r.cliente.nombre} sede={r.cliente.ciudad} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Cabecera r={r} />
        <main className="mx-auto w-full max-w-[1400px] flex-1 px-4 pb-16 pt-4 sm:px-6">{children}</main>
      </div>
    </div>
  )
}
