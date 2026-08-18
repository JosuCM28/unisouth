import Link from "next/link";
import { Button } from "@/components/ui/button";

interface PagerProps {
  page: number;
  totalPages: number;
  /** Ruta a la que vuelve cada enlace ("/lots", "/movements"). */
  basePath: string;
  /** Los searchParams actuales: se conservan para no perder los filtros. */
  params: Record<string, string | undefined>;
}

/**
 * Paginación del SERVIDOR.
 *
 * Navega con `<Link>` y no con estado local a propósito: la página vive en la
 * URL, así que el resultado se puede compartir, sobrevive a un refresh —clave
 * con el WiFi de la bodega— y el botón "atrás" del navegador regresa a la
 * página anterior en vez de salirse de la pantalla.
 *
 * Es la única paginación válida en listas que se leen por partes desde la
 * base de datos. La paginación en memoria de `DataTable` sólo puede repartir
 * lo que el servidor ya mandó, y si se usan las dos a la vez el usuario
 * recorre nada más el primer bloque creyendo que es el inventario completo.
 */
export function Pager({ page, totalPages, basePath, params }: PagerProps) {
  if (totalPages <= 1) return null;

  function hrefFor(target: number): string {
    const next = new URLSearchParams();

    // Se arrastran los filtros vigentes: cambiar de página no debe deshacer
    // la búsqueda que el usuario ya tenía puesta.
    for (const [key, value] of Object.entries(params)) {
      if (value && key !== "page") next.set(key, value);
    }

    next.set("page", String(target));
    return `${basePath}?${next}`;
  }

  const hasPrevious = page > 1;
  const hasNext = page < totalPages;

  return (
    <div className="flex items-center justify-between gap-2">
      <PagerLink label="Anteriores" href={hrefFor(page - 1)} enabled={hasPrevious} />

      <span className="tabular text-xs text-muted-foreground">
        {page} / {totalPages}
      </span>

      <PagerLink label="Siguientes" href={hrefFor(page + 1)} enabled={hasNext} />
    </div>
  );
}

/**
 * Un extremo del paginador.
 *
 * Cuando no hay a dónde ir se pinta un `<span>` deshabilitado en vez de un
 * enlace muerto: un `<Link>` con `disabled` sigue siendo navegable con el
 * teclado y llevaría a la página 0.
 */
function PagerLink({
  label,
  href,
  enabled,
}: {
  label: string;
  href: string;
  enabled: boolean;
}) {
  if (!enabled) {
    return (
      <Button variant="outline" disabled className="touch-target">
        <span>{label}</span>
      </Button>
    );
  }

  return (
    <Button asChild variant="outline" className="touch-target">
      <Link href={href}>{label}</Link>
    </Button>
  );
}
