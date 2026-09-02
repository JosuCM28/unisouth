"use client";

import { createContext, useContext, useMemo, useState } from "react";
import {
  SIDEBAR_COOKIE,
  SIDEBAR_COOKIE_MAX_AGE,
} from "@/lib/constants/sidebar";

interface SidebarState {
  open: boolean;
  toggle: () => void;
}

const SidebarContext = createContext<SidebarState | null>(null);

/**
 * Quién sabe si la barra lateral está desplegada.
 *
 * Vive en contexto y no dentro de la barra porque el botón que la devuelve
 * está FUERA de ella: cuando se oculta, la barra deja de existir en el DOM y
 * con el estado dentro se llevaría consigo la única forma de volver a abrirla.
 *
 * El proveedor no pinta nada, así que puede envolver el layout entero sin
 * meter un div de más en la rejilla.
 */
export function SidebarProvider({
  defaultOpen,
  children,
}: {
  /** Lo que dijo la cookie en el servidor. */
  defaultOpen: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  const value = useMemo<SidebarState>(
    () => ({
      open,
      toggle: () => {
        const next = !open;
        setOpen(next);
        /* Se escribe aquí y no en un efecto para no reescribirla en cada
           montaje: es una preferencia que sólo cambia cuando alguien toca el
           botón. `samesite=lax` porque no hace falta que viaje en peticiones
           de otros sitios. */
        document.cookie = `${SIDEBAR_COOKIE}=${next ? "1" : "0"}; path=/; max-age=${SIDEBAR_COOKIE_MAX_AGE}; samesite=lax`;
      },
    }),
    [open],
  );

  return (
    <SidebarContext.Provider value={value}>{children}</SidebarContext.Provider>
  );
}

export function useSidebar(): SidebarState {
  const context = useContext(SidebarContext);
  if (!context) {
    throw new Error("useSidebar() necesita estar dentro de <SidebarProvider>");
  }
  return context;
}
