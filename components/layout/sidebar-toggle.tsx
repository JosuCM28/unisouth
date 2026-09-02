"use client";

import { PanelLeft, PanelLeftClose } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSidebar } from "./sidebar-state";

/**
 * Pliega y despliega la barra lateral.
 *
 * Es el MISMO botón en los dos lugares —dentro de la barra para cerrarla, en
 * la franja de arriba para volver a abrirla— porque hace lo mismo y debe
 * verse igual. Lo único que cambia es el icono y lo que anuncia.
 *
 * Fantasma y no con borde: la barra lateral ya está delimitada por su propio
 * borde, y un botón enmarcado ahí dentro agregaría una caja dentro de otra.
 */
export function SidebarToggle() {
  const { open, toggle } = useSidebar();
  const Icon = open ? PanelLeftClose : PanelLeft;

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggle}
      className="touch-target shrink-0"
      aria-label={open ? "Ocultar el menú" : "Mostrar el menú"}
      aria-expanded={open}
      aria-controls="app-sidebar"
    >
      <Icon className="size-4" aria-hidden />
    </Button>
  );
}
