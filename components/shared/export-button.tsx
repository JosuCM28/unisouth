"use client";

import { useSearchParams } from "next/navigation";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Parámetros que son de la PANTALLA, no del filtro. No viajan al archivo. */
const VIEW_ONLY_PARAMS = ["page", "all", "filas"];

interface ExportButtonProps {
  href: string;
  label?: string;
  /**
   * Ignora los filtros de la URL y baja exactamente `href`.
   *
   * Para exportaciones de UN registro —la recepción abierta, por ejemplo—,
   * donde los parámetros de la lista no significan nada.
   */
  exact?: boolean;
}

/**
 * Descarga la lista como Excel, RESPETANDO el filtro que está en pantalla.
 *
 * Arrastrar la query string es la razón de ser de este componente. Antes era
 * un enlace fijo a `/api/export/lots`, así que quien filtraba por cliente y
 * bajaba el archivo recibía el inventario completo sin filtrar —y no tenía
 * forma de notarlo: el Excel se ve igual de correcto, sólo que no es lo que
 * pidió—. Un reporte que no corresponde a lo que se está viendo es peor que
 * no tener reporte.
 *
 * La página y el tamaño de página NO viajan: son de cómo se está mirando la
 * lista, no de qué se está mirando. El archivo trae el filtro completo, no la
 * página en la que quedó el pulgar.
 */
export function ExportButton({
  href,
  label = "Exportar a Excel",
  exact = false,
}: ExportButtonProps) {
  const searchParams = useSearchParams();

  return (
    <Button asChild variant="outline" className="touch-target">
      <a href={exact ? href : withFilters(href, searchParams)} download>
        <Download className="size-4" aria-hidden />
        {label}
      </a>
    </Button>
  );
}

/** Pega los filtros de la pantalla al destino, sin pisar los que ya trae. */
function withFilters(href: string, current: URLSearchParams): string {
  const separator = href.indexOf("?");
  const path = separator === -1 ? href : href.slice(0, separator);
  const params = new URLSearchParams(
    separator === -1 ? "" : href.slice(separator + 1),
  );

  for (const [key, value] of current.entries()) {
    if (VIEW_ONLY_PARAMS.includes(key)) continue;
    // Lo que la ruta ya trae en su href gana: es explícito de esa pantalla.
    if (params.has(key)) continue;
    if (value) params.set(key, value);
  }

  const query = params.toString();
  return query ? `${path}?${query}` : path;
}
