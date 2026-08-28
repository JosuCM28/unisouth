"use client";

import { useSearchParams } from "next/navigation";
import { FileText, Layers, Printer, QrCode } from "lucide-react";
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

  /* El listado SÍ entiende todos los filtros, a diferencia de las hojas por
     rollo: es la misma consulta del inventario, así que se le pasan tal cual
     —menos los de paginación, que son de cómo se mira la lista y no de qué—. */
  function buildListHref() {
    const params = new URLSearchParams();

    for (const [key, value] of searchParams.entries()) {
      if (["page", "all", "filas"].includes(key)) continue;
      if (value) params.set(key, value);
    }

    const query = params.toString();
    return query ? `/print/inventory?${query}` : "/print/inventory";
  }

  /* La hoja de pila necesita UNA clave: agrupa un material y su desglose. Sin
     material elegido no hay pila que describir, así que se ofrece deshabilitada
     con la razón, en vez de esconderla y dejar al usuario buscándola. */
  const materialId = searchParams.get("materialId");

  function buildPileHref() {
    const params = new URLSearchParams({ materialId: materialId ?? "" });
    for (const key of ["locationId", "clientId"]) {
      const value = searchParams.get(key);
      if (value) params.set(key, value);
    }
    return `/print/pile?${params}`;
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

        {/* El listado va primero: es lo que se manda por correo o WhatsApp
            —desde el diálogo del navegador, "Guardar como PDF"— mientras que
            las etiquetas y las hojas por rollo son para la impresora del
            almacén. */}
        <DropdownMenuItem asChild>
          <a href={buildListHref()} target="_blank" rel="noopener">
            <FileText className="size-4" aria-hidden />
            Listado (PDF)
          </a>
        </DropdownMenuItem>

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

        <DropdownMenuSeparator />

        {materialId ? (
          <DropdownMenuItem asChild>
            <a href={buildPileHref()} target="_blank" rel="noopener">
              <Layers className="size-4" aria-hidden />
              Hoja de pila
            </a>
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem disabled>
            <Layers className="size-4" aria-hidden />
            Hoja de pila · filtra por material
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
