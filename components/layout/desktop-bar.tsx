"use client";

import { useSidebar } from "./sidebar-state";
import { SidebarToggle } from "./sidebar-toggle";

/**
 * La franja de escritorio que devuelve la barra lateral.
 *
 * Sólo existe cuando la barra está oculta. Dejarla siempre costaría 48px de
 * alto en todas las pantallas para nada: con la barra desplegada, su botón de
 * cerrar ya vive dentro de ella.
 *
 * Lleva el nombre de la aplicación porque es lo que se pierde al ocultar la
 * barra, y sin él la pantalla queda sin ninguna marca de dónde está uno.
 *
 * `md:` para arriba nada más: en celular la barra lateral no existe y este
 * botón no tendría qué abrir —ahí el menú es el del header.
 */
export function DesktopBar() {
  const { open } = useSidebar();
  if (open) return null;

  return (
    <div className="hidden h-12 shrink-0 items-center gap-1 border-b border-border bg-card px-2 md:flex">
      <SidebarToggle />
      <span className="text-sm font-semibold tracking-tight">UNISOUTH</span>
    </div>
  );
}
