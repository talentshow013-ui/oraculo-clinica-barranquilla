import { motor } from "@/lib/datos";
import { FAMILIAS, NOMBRE_FAMILIA, metricasPorFamilia } from "@/lib/metrics/catalog";
import { resolverMetrica } from "@/lib/metrics/resolver";
import { Celda, Etiqueta, formatear, Panel, Tabla, Th, Titulo } from "@/components/ui";

export default async function Metricas() {
  const r = await motor();

  return (
    <>
      <Titulo sub={`${r.catalogo.length} métricas en ${FAMILIAS.length} familias. Cada una dice cómo se calcula y qué decisión cambia. Si no cambia ninguna, no existe.`}>
        Catálogo de métricas
      </Titulo>

      <div className="space-y-4">
        {FAMILIAS.map((f) => {
          const lista = metricasPorFamilia(f).map((m) => ({ m, v: resolverMetrica(m, r) }));
          return (
            <Panel key={f} titulo={NOMBRE_FAMILIA[f]} ayuda={`${lista.length} métricas`}>
              <Tabla>
                <thead>
                  <tr>
                    <Th>Métrica</Th>
                    <Th alinear="right">Valor (periodo)</Th>
                    <Th>Cómo se calcula</Th>
                    <Th>Qué decisión cambia</Th>
                  </tr>
                </thead>
                <tbody>
                  {lista.map(({ m, v }) => (
                    <tr key={m.id}>
                      <Celda>
                        <div className="text-texto">
                          {m.nombre} {m.maestra && <Etiqueta tono="acento">maestra</Etiqueta>}
                        </div>
                        <div className="text-[11px] text-texto-3">
                          {m.mejorEs === "mayor" ? "mejor si sube" : m.mejorEs === "menor" ? "mejor si baja" : m.mejorEs === "rango" ? "mejor en rango" : "informativa"} · fuente: {m.fuentes.join(", ")}
                        </div>
                      </Celda>
                      <Celda alinear="right" className={v.calculada ? "" : "text-texto-3"}>
                        {v.calculada ? formatear(v.valor, m.unidad) : "—"}
                        {!v.calculada && <div className="text-[10px] text-texto-3">pendiente</div>}
                      </Celda>
                      <Celda className="max-w-xs text-xs text-texto-2">{m.formula}</Celda>
                      <Celda className="max-w-md text-xs text-texto-2">{m.porQueImporta}</Celda>
                    </tr>
                  ))}
                </tbody>
              </Tabla>
            </Panel>
          );
        })}
      </div>
    </>
  );
}
