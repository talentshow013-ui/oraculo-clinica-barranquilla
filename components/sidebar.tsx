"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NOMBRE_PRODUCTO } from "@/lib/format/etiquetas";

const GRUPOS: { titulo: string; items: { href: string; nombre: string; desc: string }[] }[] = [
  {
    titulo: "Dirección",
    items: [
      { href: "/panel", nombre: "Centro de Mando", desc: "Lo que importa hoy" },
      { href: "/diagnostico", nombre: "Diagnóstico", desc: "¿En qué estamos fallando?" },
      { href: "/oportunidades", nombre: "Oportunidades", desc: "Ideas para mejorar" },
      { href: "/informe", nombre: "Informe", desc: "Resumen para dirección" },
    ],
  },
  {
    titulo: "Cuenta",
    items: [
      { href: "/embudo", nombre: "Embudo", desc: "8 pasos con fuga en pesos" },
      { href: "/rendimiento", nombre: "Rendimiento", desc: "Inversión y eficiencia" },
      { href: "/creativos", nombre: "Creativos", desc: "Laboratorio creativo" },
      { href: "/audiencias", nombre: "Audiencias", desc: "Edad, zona, franja horaria" },
    ],
  },
  {
    titulo: "Mercado",
    items: [
      { href: "/competencia", nombre: "Competencia", desc: "Radar de mercado" },
      { href: "/biblioteca", nombre: "Biblioteca", desc: "Banco de mensajes" },
    ],
  },
  {
    titulo: "Sistema",
    items: [
      { href: "/consejo", nombre: "Consejo", desc: "Mesa de consultores" },
      { href: "/metricas", nombre: "Métricas", desc: "Catálogo completo" },
      { href: "/fuentes", nombre: "Fuentes", desc: "Estado de los datos" },
    ],
  },
];

export function Sidebar() {
  const ruta = usePathname();
  return (
    <aside className="flex h-full w-60 shrink-0 flex-col border-r border-borde bg-superficie">
      <div className="border-b border-borde px-4 py-4">
        <div className="text-sm font-semibold tracking-[0.2em] text-texto">{NOMBRE_PRODUCTO.toUpperCase()}</div>
        <div className="text-[11px] text-texto-3">Inteligencia de marketing</div>
      </div>
      <nav className="flex-1 overflow-y-auto px-2 py-3">
        {GRUPOS.map((g) => (
          <div key={g.titulo} className="mb-4">
            <div className="px-2 pb-1 text-[10px] uppercase tracking-widest text-texto-3">{g.titulo}</div>
            {g.items.map((it) => {
              const activo = ruta === it.href || ruta?.startsWith(`${it.href}/`);
              return (
                <Link
                  key={it.href}
                  href={it.href}
                  className={`block rounded px-2 py-1.5 text-sm transition-colors ${activo ? "bg-superficie-2 text-texto" : "text-texto-2 hover:bg-superficie-2 hover:text-texto"}`}
                >
                  <div>{it.nombre}</div>
                  <div className="text-[11px] text-texto-3">{it.desc}</div>
                </Link>
              );
            })}
          </div>
        ))}
      </nav>
    </aside>
  );
}
