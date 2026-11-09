import type { Metadata } from "next";
import { Factory } from "lucide-react";
import { requirePermission } from "@/lib/core/session";
import { WorkshopDeliveryService } from "@/lib/services/workshop-delivery.service";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { DeliveryList } from "@/components/workshop-orders/delivery-list";

export const metadata: Metadata = { title: "Órdenes" };

export default async function WorkshopOrdersPage() {
  const user = await requirePermission("workshop-orders:access");
  const list = await new WorkshopDeliveryService().listForRole(user.role);

  if (!list) {
    return (
      <div className="flex flex-col gap-4">
        <PageHeader title="Órdenes" description="Tus entregas" />
        <div className="flat-surface">
          <EmptyState
            icon={Factory}
            title="Tu cuenta aún no está ligada a un taller"
            description="Pide a la fábrica que la ligue en el catálogo de Talleres."
          />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Órdenes"
        description={`${list.workshopName} · ${list.pending} por recibir`}
      />
      <DeliveryList list={list} />
    </div>
  );
}
