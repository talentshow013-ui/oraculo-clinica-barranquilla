import type { ReactNode } from "react";
import { Sidebar } from "@/components/sidebar";
import { Cabecera } from "@/components/cabecera";

// El panel lee un archivo local que cambia con cada sincronización: nunca se congela al compilar.
export const dynamic = "force-dynamic";

export default function PanelLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Cabecera />
        <main className="flex-1 overflow-y-auto px-6 py-5">{children}</main>
      </div>
    </div>
  );
}
