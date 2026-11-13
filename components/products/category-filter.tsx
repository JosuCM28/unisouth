import Link from "next/link";
import type { GarmentCategoryOption } from "@/lib/repositories/garment-category.repository";
import { cn } from "@/lib/utils";

/**
 * Filtro por tipo de prenda como enlaces y no como estado: vive en la URL,
 * así que sobrevive a recargar y se puede compartir.
 */
export function CategoryFilter({
  categories,
  activeId,
}: {
  categories: GarmentCategoryOption[];
  activeId: string | undefined;
}) {
  if (categories.length === 0) return null;

  const chips = [{ id: undefined, name: "Todos" }, ...categories];

  return (
    <nav aria-label="Filtrar por tipo de prenda" className="flex flex-wrap gap-2">
      {chips.map((chip) => {
        const active = chip.id === activeId;
        return (
          <Link
            key={chip.id ?? "all"}
            href={chip.id ? `/products?category=${chip.id}` : "/products"}
            aria-current={active ? "page" : undefined}
            className={cn(
              "touch-target inline-flex shrink-0 items-center rounded border px-3 text-sm transition-colors",
              active
                ? "border-primary bg-primary font-medium text-primary-foreground"
                : "border-border bg-card hover:bg-muted",
            )}
          >
            {chip.name}
          </Link>
        );
      })}
    </nav>
  );
}
