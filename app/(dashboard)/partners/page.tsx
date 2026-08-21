import type { Metadata } from "next";
import { Plus, Truck, Factory } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { CarrierFormDialog } from "@/components/partners/carrier-form-dialog";
import { SupplierFormDialog } from "@/components/partners/supplier-form-dialog";
import { CarrierActions, SupplierActions } from "@/components/partners/partner-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { requirePermission } from "@/lib/core/session";

export const metadata: Metadata = { title: "Proveedores y paqueterías" };

export default async function PartnersPage() {
  /* Dirección no recorre el almacén: sin `inventory:browse` esta pantalla
     no está en su menú, y ésta es la línea que de verdad la cierra —el
     enlace oculto es comodidad visual, no seguridad. */
  await requirePermission("inventory:browse");

  const [carriers, suppliers] = await Promise.all([
    prisma.carrier.findMany({ where: { deletedAt: null }, orderBy: { name: "asc" } }),
    prisma.supplier.findMany({ where: { deletedAt: null }, orderBy: { name: "asc" } }),
  ]);

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Proveedores y paqueterías"
        description="Quién surte el material y quién lo trae"
      />

      <Tabs defaultValue="carriers">
        <TabsList className="w-full">
          <TabsTrigger value="carriers" className="flex-1">
            Paqueterías ({carriers.length})
          </TabsTrigger>
          <TabsTrigger value="suppliers" className="flex-1">
            Proveedores ({suppliers.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="carriers" className="mt-4 flex flex-col gap-3">
          <CarrierFormDialog
            trigger={
              <Button className="touch-target w-fit">
                <Plus className="size-4" aria-hidden />Nueva paquetería
              </Button>
            }
          />

          {carriers.length === 0 ? (
            <div className="flat-surface">
              <EmptyState icon={Truck} title="Aún no hay paqueterías"
                description="Da de alta la primera para poder registrarla al recibir mercancía." />
            </div>
          ) : (
            <ul className="flex flex-col gap-2">
              {carriers.map((carrier) => (
                <li key={carrier.id} className="flat-surface flex items-start justify-between gap-3 p-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{carrier.name}</span>
                      {!carrier.active && <Badge variant="secondary" className="text-xs">Inactiva</Badge>}
                    </div>
                    {carrier.phone && (
                      <p className="tabular text-xs text-muted-foreground">{carrier.phone}</p>
                    )}
                  </div>
                  <CarrierActions carrier={carrier} />
                </li>
              ))}
            </ul>
          )}
        </TabsContent>

        <TabsContent value="suppliers" className="mt-4 flex flex-col gap-3">
          <SupplierFormDialog
            trigger={
              <Button className="touch-target w-fit">
                <Plus className="size-4" aria-hidden />Nuevo proveedor
              </Button>
            }
          />

          {suppliers.length === 0 ? (
            <div className="flat-surface">
              <EmptyState icon={Factory} title="Aún no hay proveedores"
                description="Da de alta el primero para poder registrarlo en recepciones y requisiciones." />
            </div>
          ) : (
            <ul className="flex flex-col gap-2">
              {suppliers.map((supplier) => (
                <li key={supplier.id} className="flat-surface flex items-start justify-between gap-3 p-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-medium">{supplier.name}</span>
                      {!supplier.active && <Badge variant="secondary" className="text-xs">Inactivo</Badge>}
                    </div>
                    <p className="truncate text-xs text-muted-foreground">
                      {supplier.contact ?? "Sin contacto"}
                      {supplier.leadTimeDays && ` · ${supplier.leadTimeDays} días de entrega`}
                    </p>
                  </div>
                  <SupplierActions supplier={supplier} />
                </li>
              ))}
            </ul>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
