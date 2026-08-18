import Link from "next/link";
import { Button } from "@/components/ui/button";

interface PagerProps {
  page: number;
  totalPages: number;
  /** Ruta a la que vuelve cada enlace ("/lots", "/movements"). */
  basePath: string;
  /** Los searchParams actuales: se conservan para no perder los filtros. */
  params: Record<string, string | undefined>;
  /** Total que cumple el filtro. Sólo para el contador. */
  total?: number;
  /** Sustantivo del contador ("movimiento"/"movimientos"). */
  itemLabel?: { one: string; many: string };
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
export function Pager({
  page,
  totalPages,
  basePath,
  params,
  total,
  itemLabel = { one: "registro", many: "registros" },
}: PagerProps) {
  if (totalPages <= 1) return null;

  function hrefFor(target: number, accumulate = false): string {
    const next = new URLSearchParams();

    // Se arrastran los filtros vigentes: cambiar de página no debe deshacer
    // la búsqueda que el usuario ya tenía puesta.
    for (const [key, value] of Object.entries(params)) {
      if (value && key !== "page" && key !== "all") next.set(key, value);
    }

    next.set("page", String(target));
    /* El acumulado es sólo del "cargar más" del celular: en escritorio los
       enlaces de página traen un bloque a la vez. Sin la marca, compartir el
       enlace de la página 5 bajaría 250 filas a quien lo abra en una laptop. */
    if (accumulate) next.set("all", "1");
    return `${basePath}?${next}`;
  }

  const hasPrevious = page > 1;
  const hasNext = page < totalPages;

  return (
    <>
      {/* Celular: un botón ancho para avanzar con el pulgar, sin apuntar a
          flechitas. Es un enlace y no un acumulador porque estas listas son
          Server Components: la página nueva llega ya pintada. */}
      <div className="flex flex-col gap-2 md:hidden">
        {hasNext ? (
          <Button asChild variant="outline" className="touch-target h-12 w-full">
            <Link href={hrefFor(page + 1, true)}>Cargar más</Link>
          </Button>
        ) : (
          <p className="tabular py-2 text-center text-xs text-muted-foreground">
            No hay más {itemLabel.many}.
          </p>
        )}

        <div className="flex items-center justify-between gap-2">
          <PagerLink
            label="Anteriores"
            href={hrefFor(page - 1)}
            enabled={hasPrevious}
          />
          <span className="tabular text-xs text-muted-foreground">
            {total !== undefined
              ? `${total} ${total === 1 ? itemLabel.one : itemLabel.many}`
              : `${page} / ${totalPages}`}
          </span>
        </div>
      </div>

      {/* Escritorio: anterior / siguiente, que es lo que se espera con ratón. */}
      <div className="hidden items-center justify-between gap-2 md:flex">
        <PagerLink
          label="Anteriores"
          href={hrefFor(page - 1)}
          enabled={hasPrevious}
        />

        <span className="tabular text-xs text-muted-foreground">
          Página {page} de {totalPages}
          {total !== undefined &&
            ` · ${total} ${total === 1 ? itemLabel.one : itemLabel.many}`}
        </span>

        <PagerLink
          label="Siguientes"
          href={hrefFor(page + 1)}
          enabled={hasNext}
        />
      </div>
    </>
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
