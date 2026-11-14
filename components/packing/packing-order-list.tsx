import Link from "next/link";
import { PackageOpen } from "lucide-react";
import type { PackingOrderListItem } from "@/lib/repositories/packing.repository";
import { formatDate, formatQuantity } from "@/lib/utils";
import { EmptyState } from "@/components/shared/empty-state";
import { PackingStatusBadge } from "./packing-status-badge";

/** Los pedidos de empaque: abiertos arriba, que son los que se trabajan. */
export function PackingOrderList({ orders }: { orders: PackingOrderListItem[] }) {
  if (orders.length === 0) {
    return (
      <div className="flat-surface">
        <EmptyState icon={PackageOpen} title="Aún no hay pedidos"
          description="Crea uno y ve agregando cajas con la prenda del inventario." />
      </div>
    );
  }

  return (
    <ul className="flex flex-col gap-2">
      {orders.map((order) => (
        <li key={order.id}>
          <Link href={`/packing/${order.id}`}
            className="flat-surface touch-target flex items-start justify-between gap-3 p-3 transition-colors hover:bg-muted">
            <div className="min-w-0">
              <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
                <span className="truncate">{order.name}</span>
                <PackingStatusBadge status={order.status} />
              </p>
              <p className="tabular text-xs text-muted-foreground">
                {order.code} · {formatDate(order.date)} · {order.clientName ?? "Sin cliente"}
              </p>
            </div>
            <p className="tabular shrink-0 text-right text-sm">
              {order.boxes} {order.boxes === 1 ? "caja" : "cajas"}
              <span className="block text-xs text-muted-foreground">{formatQuantity(order.pieces)} pzas</span>
            </p>
          </Link>
        </li>
      ))}
    </ul>
  );
}
