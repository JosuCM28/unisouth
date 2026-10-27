"use client";

import { useSearchParams } from "next/navigation";
import { Download } from "lucide-react";
import { withFilters } from "@/components/shared/export-button";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/**
 * Las dos descargas para cargar el inventario a Microsip.
 *
 * Van numeradas porque el orden importa: si se importan las existencias antes
 * que los artículos, Microsip se brinca cada clave que todavía no conoce.
 * Llevan el filtro de la pantalla, así que filtrar por cliente da el archivo
 * de ese dueño.
 */
export function MicrosipExportMenu() {
  const searchParams = useSearchParams();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="touch-target">
          <Download className="size-4" aria-hidden />
          Microsip
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>Cargar a Microsip</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild className="touch-target">
          <a href={withFilters("/api/export/microsip/articles", searchParams)} download>
            1 · Artículos (.txt)
          </a>
        </DropdownMenuItem>
        <DropdownMenuItem asChild className="touch-target">
          <a href={withFilters("/api/export/microsip/stock", searchParams)} download>
            2 · Existencias (.xlsx)
          </a>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
