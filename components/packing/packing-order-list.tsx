import Link from "next/link";
import { ChevronRight, PackageOpen } from "lucide-react";
import type { PackingOrderListItem } from "@/lib/repositories/packing.repository";
import { formatDate, formatQuantity } from "@/lib/utils";
import { EmptyState } from "@/components/shared/empty-state";
import { PackingStatusBadge } from "./packing-status-badge";

/** Sin cliente el pedido mezcla empresas: decirlo así se lee como decisión y no como hueco. */
const NO_CLIENT = "Varias empresas";

/**
 * Los pedidos de empaque: abiertos arriba, que son los que se trabajan.
 * Tarjetas en el celular; desde `md:` columnas alineadas para comparar
 * cajas y piezas de un vistazo.
 */
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
    <>
      <MobileList orders={orders} />
      <DesktopTable orders={orders} />
    </>
  );
}

function MobileList({ orders }: { orders: PackingOrderListItem[] }) {
  return (
    <ul className="flex flex-col gap-2 md:hidden">
      {orders.map((order) => (
        <li key={order.id}>
          <Link href={`/packing/${order.id}`}
            className="flat-surface touch-target flex items-center gap-3 p-3 transition-colors hover:bg-muted">
            <div className="min-w-0 flex-1">
              <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
                <span className="truncate">{order.name}</span>
                <PackingStatusBadge status={order.status} />
              </p>
              <p className="tabular text-xs text-muted-foreground">
                {order.code} · {formatDate(order.date)} · {order.clientName ?? NO_CLIENT}
              </p>
            </div>
            <p className="tabular shrink-0 text-right text-sm font-semibold">
              {formatQuantity(order.pieces)} pzas
              <span className="block text-xs font-normal text-muted-foreground">{boxesLabel(order.boxes)}</span>
            </p>
            <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          </Link>
        </li>
      ))}
    </ul>
  );
}

/**
 * Cada renglón es un enlace entero —no una tabla con un enlace en la
 * primera celda— para que se le pueda picar en cualquier parte. Por eso es
 * una rejilla y no un `<table>`: un `<a>` no puede envolver un `<tr>`.
 */
const DESKTOP_COLUMNS = "grid grid-cols-[9rem_minmax(0,1.6fr)_minmax(0,1fr)_6rem_5rem_6rem_6rem_1.5rem] items-center gap-3";

function DesktopTable({ orders }: { orders: PackingOrderListItem[] }) {
  return (
    <div className="flat-surface hidden md:block">
      <div className={`${DESKTOP_COLUMNS} border-b border-border bg-muted px-4 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground`}>
        <span>Folio</span>
        <span>Pedido</span>
        <span>Cliente</span>
        <span>Fecha</span>
        <span className="text-right">Cajas</span>
        <span className="text-right">Piezas</span>
        <span>Estado</span>
        <span aria-hidden />
      </div>
      <ul>
        {orders.map((order) => (
          <li key={order.id} className="border-b border-border last:border-0">
            <Link href={`/packing/${order.id}`}
              className={`${DESKTOP_COLUMNS} px-4 py-3 text-sm transition-colors hover:bg-muted`}>
              <span className="tabular text-muted-foreground">{order.code}</span>
              <span className="truncate font-medium">{order.name}</span>
              <span className="truncate">{order.clientName ?? NO_CLIENT}</span>
              <span className="tabular text-muted-foreground">{formatDate(order.date)}</span>
              <span className="tabular text-right">{formatQuantity(order.boxes)}</span>
              <span className="tabular text-right font-semibold">{formatQuantity(order.pieces)}</span>
              <span><PackingStatusBadge status={order.status} /></span>
              <ChevronRight className="size-4 text-muted-foreground" aria-hidden />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

function boxesLabel(boxes: number): string {
  if (boxes === 1) return "1 caja";
  return `${formatQuantity(boxes)} cajas`;
}
