import type { Metadata } from "next";
import { Plus, Ruler } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { SizeFormDialog } from "@/components/products/size-form-dialog";
import { Button } from "@/components/ui/button";
import { formatQuantity, toPlainObject } from "@/lib/utils";
import { requirePermission } from "@/lib/core/session";

export const metadata: Metadata = { title: "Tallas" };

export default async function SizesPage() {
  /* Dirección no recorre el almacén: sin `inventory:browse` esta pantalla
     no está en su menú, y ésta es la línea que de verdad la cierra —el
     enlace oculto es comodidad visual, no seguridad. */
  await requirePermission("inventory:browse");

  // Size.consumptionFactor es Decimal y SizeFormDialog es cliente: sin
  // convertir, React no puede serializarlo al pasar la frontera.
  const sizes = toPlainObject(
    await prisma.size.findMany({ orderBy: { order: "asc" } }),
  );

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Tallas"
        description="El factor escala el consumo en vez de duplicar la ficha"
        action={
          <SizeFormDialog
            trigger={<Button className="touch-target"><Plus className="size-4" aria-hidden />Nueva</Button>}
          />
        }
      />

      {sizes.length === 0 ? (
        <div className="flat-surface">
          <EmptyState icon={Ruler} title="Aún no hay tallas" description="Da de alta CH, M, G, XG…" />
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {sizes.map((size) => (
            <li key={size.id} className="flat-surface flex items-center justify-between gap-3 p-3">
              <div className="min-w-0">
                <p className="tabular text-sm font-medium">{size.code}</p>
                <p className="truncate text-sm text-muted-foreground">{size.name}</p>
                {size.group && <p className="text-xs text-muted-foreground">grupo {size.group}</p>}
              </div>

              <div className="flex shrink-0 items-center gap-3">
                <span className="tabular text-lg font-semibold">
                  {formatQuantity(size.consumptionFactor)}×
                </span>
                <SizeFormDialog
                  size={size}
                  trigger={<Button variant="ghost" className="touch-target">Editar</Button>}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
