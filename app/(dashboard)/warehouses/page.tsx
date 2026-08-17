import type { Metadata } from "next";
import Link from "next/link";
import { Boxes, MapPin, Plus, Star } from "lucide-react";
import { requirePermission } from "@/lib/core/session";
import { WarehouseRepository } from "@/lib/repositories/warehouse.repository";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { WarehouseFormDialog } from "@/components/warehouses/warehouse-form-dialog";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Almacenes" };

/**
 * Almacenes con su ocupación.
 *
 * Responde "¿dónde está el material?" a nivel de nave, que es el primer corte
 * antes de bajar a filas y racks.
 */
export default async function WarehousesPage() {
  await requirePermission("inventory:read");

  const warehouses = await new WarehouseRepository().findAllWithStock();

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Almacenes"
        description="Bodegas y naves, cada una con sus ubicaciones"
        action={
          <WarehouseFormDialog
            trigger={
              <Button className="touch-target">
                <Plus className="size-4" aria-hidden />
                Nuevo
              </Button>
            }
          />
        }
      />

      {warehouses.length === 0 ? (
        <div className="flat-surface">
          <EmptyState
            icon={Boxes}
            title="Aún no hay almacenes"
            description="Crea el primero con el botón de arriba."
          />
        </div>
      ) : (
        <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {warehouses.map((warehouse) => (
            <li key={warehouse.id} className="flat-surface p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="flex items-center gap-1.5 font-medium">
                    <span className="break-words">{warehouse.name}</span>
                    {warehouse.isDefault && (
                      <Star
                        className="size-3.5 shrink-0 text-primary"
                        aria-label="Almacén principal"
                      />
                    )}
                  </p>
                  <p className="tabular text-xs text-muted-foreground">
                    {warehouse.code}
                  </p>
                </div>

                {!warehouse.active && (
                  <span className="shrink-0 rounded border border-border px-1.5 py-0.5 text-xs text-muted-foreground">
                    Inactivo
                  </span>
                )}
              </div>

              {warehouse.address && (
                <p className="mt-2 break-words text-xs text-muted-foreground">
                  {warehouse.address}
                </p>
              )}

              <dl className="mt-3 flex gap-4 border-t border-border pt-3">
                <Figure
                  icon={Boxes}
                  label={warehouse.lotCount === 1 ? "rollo" : "rollos"}
                  value={warehouse.lotCount}
                />
                <Figure
                  icon={MapPin}
                  label={
                    warehouse.locationCount === 1 ? "ubicación" : "ubicaciones"
                  }
                  value={warehouse.locationCount}
                />
              </dl>

              <div className="mt-3 flex gap-2">
                <WarehouseFormDialog
                  warehouse={warehouse}
                  trigger={
                    <Button variant="outline" className="touch-target flex-1">
                      Editar
                    </Button>
                  }
                />
                <Button asChild variant="outline" className="touch-target flex-1">
                  <Link href={`/locations?warehouseId=${warehouse.id}`}>
                    Ubicaciones
                  </Link>
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Figure({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Boxes;
  label: string;
  value: number;
}) {
  return (
    <div>
      <dt className="flex items-center gap-1 text-xs text-muted-foreground">
        <Icon className="size-3" aria-hidden />
        {label}
      </dt>
      <dd className="tabular text-xl font-semibold leading-none">{value}</dd>
    </div>
  );
}
