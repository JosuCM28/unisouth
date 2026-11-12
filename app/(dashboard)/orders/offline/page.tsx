import type { Metadata } from "next";
import { requirePermission } from "@/lib/core/session";
import { PageHeader } from "@/components/layout/page-header";
import { OfflineOrdersView } from "@/components/offline/views/offline-orders-view";

export const metadata: Metadata = { title: "Órdenes sin conexión" };

/** Órdenes vivas sobre la copia local, para cuando no hay señal. */
export default async function OfflineOrdersPage() {
  await requirePermission("offline:manage");

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="Órdenes sin conexión" description="Órdenes abiertas y en corte, desde la copia de este equipo" />
      <OfflineOrdersView />
    </div>
  );
}
