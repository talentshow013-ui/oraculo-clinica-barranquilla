/**
 * Corre el motor completo sin interfaz e imprime los hallazgos ordenados por plata.
 *
 *   npm run verificar            → salida legible
 *   npm run verificar -- --json  → JSON completo (lo consumen los skills del asistente)
 */
import { correrMotor } from "@/lib/datos";
import { cop, pct, ratio } from "@/lib/format";
import { NOMBRE_REGLA } from "@/lib/diagnostics/rules";
import { ETIQUETA_PASO } from "@/lib/format/etiquetas";

async function main() {
  const json = process.argv.includes("--json");
  const r = await correrMotor();

  if (json) {
    const salida = {
      hoy: r.hoy,
      rango: { desde: r.lote.meta.desde, hasta: r.lote.meta.hasta, origen: r.lote.meta.origen },
      huecos: r.contexto.huecos,
      advertencias: r.lote.meta.advertencias,
      plataEnRiesgoTotal: r.plataEnRiesgoTotal,
      maestras: r.maestras.map((m) => ({ id: m.id, nombre: m.nombre, valor: m.valor, unidad: m.unidad })),
      negocio: r.negocio,
      embudo: r.embudo,
      fugaMasCara: r.fugaMasCara,
      hallazgos: r.hallazgos,
      erroresReglas: r.erroresReglas,
      oportunidades: r.oportunidades,
      creativos: r.creativos.map((c) => ({
        id: c.creativo.id,
        copy: c.creativo.copyPrincipal,
        formato: c.creativo.formato,
        angulo: c.creativo.anguloDetectado,
        cuadrante: c.cuadrante,
        accion: c.accion,
        gasto: c.agregado.gasto,
        hookRate: c.hookRate,
        holdRate: c.holdRate,
        costoResultado: c.costoResultado,
        fatiga: c.fatiga.indice,
      })),
      radar: {
        competidoresActivos: r.radar.competidoresActivos,
        ganadores: r.radar.ganadores.slice(0, 10),
        cadencia: { competencia: r.radar.cadencia.total, propia: r.radar.cadenciaPropia },
        espaciosVacios: r.radar.espaciosVacios.slice(0, 20),
        angulosSaturados: r.radar.mapaAngulos.filter((a) => a.saturado).map((a) => a.angulo),
      },
      lentes: r.lentes,
      privacidad: r.privacidad,
    };
    process.stdout.write(JSON.stringify(salida, null, 2));
    return;
  }

  const linea = (s = "") => process.stdout.write(`${s}\n`);
  linea(`ORÁCULO · verificación del motor · datos ${r.lote.meta.origen} · ${r.lote.meta.desde} → ${r.lote.meta.hasta} · hoy ${r.hoy}`);
  if (r.contexto.huecos.length) linea(`Huecos: ${r.contexto.huecos.join(", ")}`);
  for (const a of r.lote.meta.advertencias) linea(`Aviso: ${a}`);
  linea();
  linea(`Inversión ${cop(r.total.gasto)} · Citas asistidas ${r.embudo[5]?.cantidad ?? "—"} · Ventas ${r.embudo[6]?.cantidad ?? "—"} · Retorno real ${ratio(r.negocio.roasReal)} · POAS ${ratio(r.negocio.poas)} · Asistencia ${pct(r.negocio.showRate)}`);
  linea(`Plata en riesgo (hallazgos valorizados): ${cop(r.plataEnRiesgoTotal)}`);
  if (r.fugaMasCara) linea(`Fuga más cara del embudo: ${ETIQUETA_PASO[r.fugaMasCara.paso]} · ${cop(r.fugaMasCara.fugaCOP)} (${r.fugaMasCara.perdidos} perdidos)`);
  linea();
  linea(`HALLAZGOS (${r.hallazgos.length}) ordenados por plata`);
  r.hallazgos.forEach((h, i) => {
    linea(`${String(i + 1).padStart(2, " ")}. [${h.reglaId} ${NOMBRE_REGLA[h.reglaId] ?? ""}] ${cop(h.plataEnRiesgo).padStart(16)}  ${h.titulo}`);
  });
  if (r.erroresReglas.length) {
    linea();
    linea(`ERRORES DE REGLAS (${r.erroresReglas.length}):`);
    for (const e of r.erroresReglas) linea(`  ${e.reglaId}: ${e.mensaje}`);
  }
  linea();
  linea(`OPORTUNIDADES (top 5 por ICE)`);
  r.oportunidades.slice(0, 5).forEach((o, i) => linea(`${i + 1}. [ICE ${o.ice.toFixed(1)}${o.yaProbada ? " · ya probada" : ""}] ${o.titulo}`));
  linea();
  linea(`RADAR: ${r.radar.competidoresActivos} competidores activos · ${r.radar.ganadores.length} anuncios de 60+ días · ${r.radar.espaciosVacios.length} espacios vacíos · cadencia competencia ${r.radar.cadencia.total.toFixed(1)}/sem vs propia ${r.radar.cadenciaPropia.toFixed(1)}/sem`);
  linea(`Privacidad: ${r.privacidad.segmentosOcultos} segmentos ocultos (k=${r.privacidad.k})`);
  if (r.erroresReglas.length) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
