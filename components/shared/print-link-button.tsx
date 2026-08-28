"use client";

import { useSearchParams } from "next/navigation";
import { FileText } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Parámetros que son de la PANTALLA, no del filtro. No viajan a la hoja. */
const VIEW_ONLY_PARAMS = ["page", "all", "filas"];

/**
 * Abre la vista imprimible de la lista, con el filtro que está en pantalla.
 *
 * De ahí sale el PDF: el navegador ofrece "Guardar como PDF" en su diálogo de
 * impresión, y ése es el archivo que se manda por correo o WhatsApp. Se abre
 * en pestaña nueva para no perder la lista y el filtro que costó armar.
 *
 * Arrastra la query string por la misma razón que `ExportButton`: una hoja que
 * no corresponde a lo que se está viendo es peor que no tener hoja.
 */
export function PrintLinkButton({
  href,
  label = "PDF",
}: {
  href: string;
  label?: string;
}) {
  const searchParams = useSearchParams();

  const params = new URLSearchParams();
  for (const [key, value] of searchParams.entries()) {
    if (VIEW_ONLY_PARAMS.includes(key)) continue;
    if (value) params.set(key, value);
  }

  const query = params.toString();

  return (
    <Button asChild variant="outline" className="touch-target">
      <a href={query ? `${href}?${query}` : href} target="_blank" rel="noopener">
        <FileText className="size-4" aria-hidden />
        {label}
      </a>
    </Button>
  );
}
