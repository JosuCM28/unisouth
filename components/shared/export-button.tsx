import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Descarga la lista como CSV.
 *
 * Es un enlace normal, no un botón con JS: el servidor genera el archivo y el
 * navegador lo baja. Excel lo abre con doble clic.
 */
export function ExportButton({ href, label = "Exportar a Excel" }: { href: string; label?: string }) {
  return (
    <Button asChild variant="outline" className="touch-target">
      <a href={href} download>
        <Download className="size-4" aria-hidden />
        {label}
      </a>
    </Button>
  );
}
