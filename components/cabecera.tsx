import { motor } from "@/lib/datos";
import { AVISO_VENTANA_ATRIBUCION } from "@/lib/format/etiquetas";
import { Etiqueta } from "@/components/ui";

/** Barra superior: rango de datos, origen, huecos y ventana de atribución. Siempre visible. */
export async function Cabecera() {
  const r = await motor();
  const ventana = r.lote.insights[0]?.ventanaAtribucion ?? "—";
  const demo = r.lote.meta.origen === "seed";
  return (
    <header className="flex flex-wrap items-center gap-3 border-b border-borde bg-superficie px-6 py-2 text-xs text-texto-2">
      <span>
        Datos del <span className="num text-texto">{r.lote.meta.desde}</span> al <span className="num text-texto">{r.lote.meta.hasta}</span>
      </span>
      {demo ? <Etiqueta tono="ojo">Demostración</Etiqueta> : <Etiqueta tono="bien">Datos reales</Etiqueta>}
      {r.contexto.huecos.length > 0 && <Etiqueta tono="mal">{r.contexto.huecos.length} días sin datos</Etiqueta>}
      {!r.negocio.calibrado && <Etiqueta tono="neutro">Tickets sin calibrar</Etiqueta>}
      <span className="ml-auto text-texto-3">{AVISO_VENTANA_ATRIBUCION(ventana)}</span>
    </header>
  );
}
