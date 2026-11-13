import { Plus, Shirt } from "lucide-react";
import type { GarmentCategoryListItem } from "@/lib/repositories/garment-category.repository";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { GarmentCategoryActions } from "./garment-category-actions";
import { GarmentCategoryFormDialog } from "./garment-category-form-dialog";

/**
 * Los tipos de prenda, en la misma pantalla que los productos: se dan de
 * alta juntos y son pocos. Un destino de menú aparte por seis renglones sólo
 * alargaría el camino.
 */
export function GarmentCategorySection({ categories }: { categories: GarmentCategoryListItem[] }) {
  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Tipos de prenda
        </h2>
        <GarmentCategoryFormDialog
          trigger={
            <Button variant="outline" className="touch-target">
              <Plus className="size-4" aria-hidden />
              Tipo
            </Button>
          }
        />
      </div>

      {categories.length === 0 ? (
        <div className="flat-surface">
          <EmptyState icon={Shirt} title="Aún no hay tipos de prenda"
            description="Camisa, pantalón, overol: lo que filtra el inventario de Embarques." />
        </div>
      ) : (
        <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {categories.map((category) => (
            <li key={category.id} className="flat-surface flex items-center justify-between gap-3 p-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{category.name}</p>
                <p className="tabular text-xs text-muted-foreground">
                  {category.productCount} {category.productCount === 1 ? "producto" : "productos"}
                </p>
              </div>
              <GarmentCategoryActions category={category} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
