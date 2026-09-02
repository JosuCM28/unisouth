"use client";

import { cn } from "@/lib/utils";
import { useSidebar } from "./sidebar-state";

/**
 * El armazón de la barra lateral: lo único que necesita ser cliente.
 *
 * El contenido —secciones ya filtradas por permiso— se le pasa como children
 * desde un Server Component, para que los destinos que el usuario no puede
 * abrir sigan sin viajar al navegador.
 *
 * Se oculta con `display:none` y no con un ancho cero ni una transición: el
 * sistema visual prohíbe animaciones decorativas, y así la barra sale de
 * verdad del flujo y del árbol de accesibilidad en lugar de quedarse ahí
 * como una columna vacía que el lector de pantalla sigue anunciando.
 */
export function SidebarPanel({ children }: { children: React.ReactNode }) {
  const { open } = useSidebar();

  return (
    <aside
      id="app-sidebar"
      className={cn(
        // En celular nunca existe: ahí manda la barra inferior.
        "hidden w-60 shrink-0 flex-col border-r border-sidebar-border bg-sidebar md:h-dvh",
        open ? "md:flex" : "md:hidden",
      )}
    >
      {children}
    </aside>
  );
}
