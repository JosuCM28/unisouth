import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/core/session";
import { roleHasPermission } from "@/lib/constants/roles";
import { ClientRepository } from "@/lib/repositories/client.repository";
import { PackingRepository } from "@/lib/repositories/packing.repository";
import { formatDate, formatQuantity } from "@/lib/utils";
import { PageHeader } from "@/components/layout/page-header";
import { NewBoxButton } from "@/components/packing/packing-box-buttons";
import { PackingBoxGrid } from "@/components/packing/packing-box-grid";
import { PackingOrderActions } from "@/components/packing/packing-order-actions";
import { PackingStatusBadge, sumPieces } from "@/components/packing/packing-status-badge";

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
      <PageHeader
        title={order.name}
        description={`${order.code} · ${formatDate(order.date)} · ${order.client?.name ?? "Sin cliente"}`}
        action={canWrite && isOpen && <NewBoxButton orderId={order.id} />}
      />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="tabular flex items-center gap-2 text-sm">
          <PackingStatusBadge status={order.status} />
          {order.boxes.length} {order.boxes.length === 1 ? "caja" : "cajas"} · {formatQuantity(pieces)} pzas
        </p>
        {canWrite && <PackingOrderActions order={order} status={order.status} clients={clients} />}
      </div>
      {order.notes && <p className="whitespace-pre-wrap text-sm">{order.notes}</p>}

      <PackingBoxGrid orderId={order.id} boxes={order.boxes} canEdit={canWrite && isOpen} />
    </div>
  );
}
