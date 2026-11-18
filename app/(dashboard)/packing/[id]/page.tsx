import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/core/session";
import { roleHasPermission } from "@/lib/constants/roles";
import { ClientRepository } from "@/lib/repositories/client.repository";
import { PackingRepository } from "@/lib/repositories/packing.repository";
import { PageHeader } from "@/components/layout/page-header";
import { PackingBreadcrumb } from "@/components/packing/packing-breadcrumb";
import { NewBoxButton } from "@/components/packing/packing-box-buttons";
import { PackingBoxGrid } from "@/components/packing/packing-box-grid";
import { PackingListButtons } from "@/components/packing/packing-list-buttons";
import { PackingOrderActions } from "@/components/packing/packing-order-actions";
import { PackingOrderSummary } from "@/components/packing/packing-order-summary";
import { sumPieces } from "@/components/packing/packing-status-badge";

export const metadata: Metadata = { title: "Pedido" };

interface PageProps {
  params: Promise<{ id: string }>;
}

/** Un pedido de empaque y sus cajas. */
export default async function PackingOrderPage({ params }: PageProps) {
  const user = await requirePermission("finished-goods:browse");
  const { id } = await params;
  const order = await new PackingRepository().findDetail(id);
  if (!order) notFound();

  const canWrite = roleHasPermission(user.role, "packing:write");
  const isOpen = order.status === "OPEN";
  const clients = canWrite ? await new ClientRepository().findOptions() : [];
  const pieces = order.boxes.reduce((sum, box) => sum + sumPieces(box.lines), 0);

  return (
    <div className="flex flex-col gap-4">
      <PackingBreadcrumb items={[{ label: "Pedidos", href: "/packing" }, { label: order.code }]} />
      <PageHeader title={order.name} description={order.code}
        action={canWrite && isOpen && <NewBoxButton orderId={order.id} />} />

      <PackingOrderSummary status={order.status} clientName={order.client?.name ?? null} date={order.date}
        boxes={order.boxes.length} pieces={pieces} />
      {order.notes && (
        <p className="whitespace-pre-wrap border-l-2 border-border pl-3 text-sm text-muted-foreground">{order.notes}</p>
      )}

      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <PackingListButtons orderId={order.id} hasPieces={pieces > 0} />
        {canWrite && <PackingOrderActions order={order} status={order.status} clients={clients} />}
      </div>

      <section className="flex flex-col gap-2">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Cajas</h2>
        <PackingBoxGrid orderId={order.id} boxes={order.boxes} canEdit={canWrite && isOpen} />
      </section>
    </div>
  );
}
