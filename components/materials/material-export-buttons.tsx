"use client";

import { useSearchParams } from "next/navigation";
import { FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ExportButton, withFilters } from "@/components/shared/export-button";

/**
 * Excel y PDF del inventario de un material.
 *
 * Es cliente sólo para arrastrar los filtros de la pila que están en la URL:
 * el archivo trae lo mismo que la lista "Rollos de esta pila" en pantalla.
 * El PDF abre la hoja de impresión en otra pestaña y desde ahí se guarda.
 */
export function MaterialExportButtons({ materialId }: { materialId: string }) {
  const searchParams = useSearchParams();
  const printHref = withFilters(
    `/print/materials/${materialId}/inventory`,
    searchParams,
  );

  return (
    <>
      <ExportButton
        href={`/api/export/materials/${materialId}/inventory`}
        label="Excel"
      />
      <Button asChild variant="outline" className="touch-target">
        <a href={printHref} target="_blank" rel="noopener">
          <FileText className="size-4" aria-hidden />
          PDF
        </a>
      </Button>
    </>
  );
}
