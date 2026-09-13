/**
 * Valida datos/lote.json (o la ruta que se pase) contra el contrato y el guardián
 * de datos sensibles. Lo usa el skill de sincronización antes de dar por buena una carga.
 *
 *   npm run validar-lote            → datos/lote.json
 *   npm run validar-lote -- ruta    → otro archivo
 */
import { resolve } from "node:path";
import { leerLote } from "@/lib/adapters/archivo.base";
import { RUTA_LOTE } from "@/lib/adapters/archivo.adapter";

const ruta = process.argv[2] ? resolve(process.cwd(), process.argv[2]) : RUTA_LOTE;
try {
  const lote = leerLote(ruta, "Genera el archivo con la sincronización desde el asistente.");
  console.log(
    `OK · ${ruta} cumple el contrato · ${lote.insights.length} filas · ${lote.desgloses.length} desgloses · ${lote.embudo.length} registros de agenda · ${lote.meta.desde} → ${lote.meta.hasta} · huecos: ${lote.meta.huecos.length}`,
  );
} catch (e) {
  console.error(`ERROR · ${e instanceof Error ? e.message : String(e)}`);
  process.exit(1);
}
