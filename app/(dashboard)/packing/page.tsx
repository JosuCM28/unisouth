import type { Metadata } from "next";
import { Plus } from "lucide-react";
import { requirePermission } from "@/lib/core/session";
import { roleHasPermission } from "@/lib/constants/roles";
import { ClientRepository } from "@/lib/repositories/client.repository";
import { PackingRepository } from "@/lib/repositories/packing.repository";
import { PageHeader } from "@/components/layout/page-header";
import { PackingOrderFormDialog } from "@/components/packing/packing-order-form-dialog";
import { PackingOrderList } from "@/components/packing/packing-order-list";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Pedidos" };

/** Los pedidos de empaque de Embarques. */
export default async function PackingOrdersPage() {
  const user = await requirePermission("finished-goods:browse");
  const canWrite = roleHasPermission(user.role, "packing:write");

  const [orders, clients] = await Promise.all([
    new PackingRepository().findList(),
    canWrite ? new ClientRepository().findOptions() : Promise.resolve([]),
  ]);

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Pedidos"
        description="Pedidos de empaque, caja por caja"
        action={canWrite && (
          <PackingOrderFormDialog clients={clients}
            trigger={<Button className="touch-target"><Plus className="size-4" aria-hidden />Nuevo pedido</Button>} />
        )}
      />
      <PackingOrderList orders={orders} />
    </div>
  );
}
