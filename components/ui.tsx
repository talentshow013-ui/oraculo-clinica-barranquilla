/**
 * Primitivas propias de la interfaz. Sin librería de componentes.
 * Reglas: un acento por significado · tabular-nums en toda cifra · `—` para lo desconocido.
 */
import type { ReactNode } from "react";
import { cop, deltaPct, indice, num, pct, ratio, seg, VACIO } from "@/lib/format";
import type { Unidad } from "@/lib/metrics/catalog";

export type Tono = "bien" | "mal" | "ojo" | "acento" | "neutro";

const COLOR_TONO: Record<Tono, string> = {
  bien: "text-bien",
  mal: "text-mal",
  ojo: "text-ojo",
  acento: "text-acento",
  neutro: "text-texto-2",
};

const FONDO_TONO: Record<Tono, string> = {
  bien: "bg-bien/15 text-bien border-bien/30",
  mal: "bg-mal/15 text-mal border-mal/30",
  ojo: "bg-ojo/15 text-ojo border-ojo/30",
  acento: "bg-acento/15 text-acento border-acento/30",
  neutro: "bg-superficie-2 text-texto-2 border-borde",
};

const BARRA_TONO: Record<Tono, string> = {
  bien: "bg-bien",
  mal: "bg-mal",
  ojo: "bg-ojo",
  acento: "bg-acento",
  neutro: "bg-texto-3",
};

/** Formatea según la unidad del catálogo. null → "—". */
export function formatear(valor: number | string | null | undefined, unidad: Unidad): string {
  if (valor === null || valor === undefined) return VACIO;
  if (typeof valor === "string") return valor;
  switch (unidad) {
    case "cop":
      return cop(valor);
    case "porcentaje":
      return pct(valor);
    case "ratio":
      return ratio(valor);
    case "segundos":
      return seg(valor);
    case "dias":
      return `${num(valor)} d`;
    case "indice":
      return indice(valor);
    case "numero":
      return num(valor, Number.isInteger(valor) ? 0 : 1);
    default:
      return String(valor);
  }
}

export function Panel({ titulo, ayuda, accion, children, className = "" }: { titulo?: string; ayuda?: string; accion?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-lg border border-borde bg-superficie p-4 ${className}`}>
      {(titulo || accion) && (
        <header className="mb-3 flex items-start justify-between gap-3">
          <div>
            {titulo && <h2 className="text-sm font-semibold tracking-wide text-texto">{titulo}</h2>}
            {ayuda && <p className="mt-0.5 text-xs text-texto-3">{ayuda}</p>}
          </div>
          {accion}
        </header>
      )}
      {children}
    </section>
  );
}

export function Kpi({
  etiqueta,
  valor,
  unidad = "numero",
  tono = "neutro",
  delta,
  ayuda,
  nota,
}: {
  etiqueta: string;
  valor: number | string | null | undefined;
  unidad?: Unidad;
  tono?: Tono;
  /** Cambio relativo vs ventana anterior. */
  delta?: number | null;
  ayuda?: string;
  nota?: string;
}) {
  const vacio = valor === null || valor === undefined;
  return (
    <div className="rounded-lg border border-borde bg-superficie-2 p-3" title={ayuda}>
      <div className="text-[11px] uppercase tracking-wider text-texto-3">{etiqueta}</div>
      <div className={`num mt-1 text-2xl font-semibold ${vacio ? "text-texto-3" : COLOR_TONO[tono]}`}>{formatear(valor, unidad)}</div>
      {delta !== undefined && (
        <div className="num mt-0.5 text-xs text-texto-2">{delta === null ? VACIO : deltaPct(delta)} <span className="text-texto-3">vs 14 días previos</span></div>
      )}
      {nota && <div className="mt-1 text-[11px] text-texto-3">{nota}</div>}
    </div>
  );
}

export function Etiqueta({ tono = "neutro", children }: { tono?: Tono; children: ReactNode }) {
  return <span className={`inline-block rounded border px-1.5 py-0.5 text-[11px] font-medium ${FONDO_TONO[tono]}`}>{children}</span>;
}

export function Barra({ valor, tono = "acento", etiqueta }: { valor: number | null; tono?: Tono; etiqueta?: string }) {
  const ancho = valor === null ? 0 : Math.max(0, Math.min(1, valor)) * 100;
  return (
    <div className="flex items-center gap-2" title={etiqueta}>
      <div className="h-1.5 flex-1 overflow-hidden rounded bg-superficie-2">
        <div className={`h-full ${valor === null ? "bg-transparent" : BARRA_TONO[tono]}`} style={{ width: `${ancho}%` }} />
      </div>
      <span className="num w-14 text-right text-xs text-texto-2">{valor === null ? VACIO : pct(valor, 0)}</span>
    </div>
  );
}

export function Vacio({ mensaje = "Sin datos para este periodo." }: { mensaje?: string }) {
  return <div className="rounded border border-dashed border-borde p-6 text-center text-sm text-texto-3">{mensaje}</div>;
}

export function Aviso({ tono = "ojo", titulo, children }: { tono?: Tono; titulo?: string; children: ReactNode }) {
  return (
    <div className={`rounded-lg border px-3 py-2 text-sm ${FONDO_TONO[tono]}`}>
      {titulo && <div className="font-semibold">{titulo}</div>}
      <div className={titulo ? "mt-0.5 opacity-90" : ""}>{children}</div>
    </div>
  );
}

export function Th({ children, alinear = "left", className = "" }: { children: ReactNode; alinear?: "left" | "right"; className?: string }) {
  return (
    <th className={`border-b border-borde px-2 py-1.5 text-[11px] font-medium uppercase tracking-wider text-texto-3 ${alinear === "right" ? "text-right" : "text-left"} ${className}`}>
      {children}
    </th>
  );
}

export function Celda({ children, alinear = "left", tono, className = "" }: { children: ReactNode; alinear?: "left" | "right"; tono?: Tono; className?: string }) {
  return (
    <td className={`num border-b border-borde/60 px-2 py-1.5 text-sm ${alinear === "right" ? "text-right" : "text-left"} ${tono ? COLOR_TONO[tono] : ""} ${className}`}>
      {children}
    </td>
  );
}

export function Tabla({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`overflow-x-auto ${className}`}>
      <table className="w-full border-collapse">{children}</table>
    </div>
  );
}

export function Titulo({ children, sub }: { children: ReactNode; sub?: string }) {
  return (
    <div className="mb-4">
      <h1 className="text-xl font-semibold text-texto">{children}</h1>
      {sub && <p className="mt-1 text-sm text-texto-2">{sub}</p>}
    </div>
  );
}

export function Grid({ children, cols = 4 }: { children: ReactNode; cols?: 2 | 3 | 4 | 6 }) {
  const clase = { 2: "md:grid-cols-2", 3: "md:grid-cols-3", 4: "md:grid-cols-2 xl:grid-cols-4", 6: "md:grid-cols-3 xl:grid-cols-6" }[cols];
  return <div className={`grid grid-cols-1 gap-3 ${clase}`}>{children}</div>;
}

/** Tono según si "mejor es mayor/menor" y hay un delta. */
export function tonoPorDelta(delta: number | null | undefined, mejorEs: "mayor" | "menor" | "rango" | "informativo"): Tono {
  if (delta === null || delta === undefined || mejorEs === "informativo" || mejorEs === "rango") return "neutro";
  if (Math.abs(delta) < 0.03) return "neutro";
  const bueno = mejorEs === "mayor" ? delta > 0 : delta < 0;
  return bueno ? "bien" : "mal";
}
