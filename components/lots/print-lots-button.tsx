"use client";

import { useSearchParams } from "next/navigation";
import { Printer, QrCode } from "lucide-react";
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
 * Imprime los rollos que se están viendo.
 *
 * Arrastra los filtros de la URL, así que "imprimir" saca exactamente lo que
 * hay en pantalla: si el auxiliar filtró por la fila F3, imprime esa fila.
 * Sin esto habría que volver a elegir los rollos en otra pantalla.
 */
export function PrintLotsButton() {
  const searchParams = useSearchParams();

  function buildHref(formato?: "etiqueta") {
    const params = new URLSearchParams();

    // Sólo los filtros que la impresión entiende. `q`, `status` y demás se
    // resuelven en la lista, no en la consulta de impresión.
    for (const key of ["materialId", "locationId", "clientId"]) {
      const value = searchParams.get(key);
      if (value) params.set(key, value);
    }

    if (formato) params.set("formato", formato);

    const query = params.toString();
    return query ? `/print/lots?${query}` : "/print/lots";
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="touch-target">
          <Printer className="size-4" aria-hidden />
          Imprimir
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end">
        <DropdownMenuLabel>Imprimir lo que se ve</DropdownMenuLabel>
        <DropdownMenuSeparator />

        <DropdownMenuItem asChild>
          <a href={buildHref("etiqueta")} target="_blank" rel="noopener">
            <QrCode className="size-4" aria-hidden />
            Etiquetas con QR
          </a>
        </DropdownMenuItem>

        <DropdownMenuItem asChild>
          <a href={buildHref()} target="_blank" rel="noopener">
            <Printer className="size-4" aria-hidden />
            Hoja por rollo
          </a>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
