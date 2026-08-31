import Link from "next/link";
import type { CuttingOrderStatus } from "@prisma/client";
import {
  CUTTING_ORDER_STATUS_LABELS,
  CUTTING_ORDER_STATUS_STYLES,
} from "@/lib/constants/labels";
import { cn, cutProgress, formatDate } from "@/lib/utils";
import { OrderDeleteButton } from "./order-delete-button";

/** Lo mínimo que la tarjeta necesita saber de una orden. */
export interface OrderListEntry {
  id: string;
  code: string;
  status: CuttingOrderStatus;
  description: string | null;
  reference: string | null;
  orderedAt: Date;
  dueDate: Date | null;
  client: { name: string } | null;
  material: { name: string } | null;
  lines: Array<{ orderedQuantity: number; cutQuantity: number }>;
}

interface Props {
  order: OrderListEntry;
  /** Pedido al que pertenece. Sólo se pinta donde no sea obvio. */
  folderName?: string | null;
}

/**
 * Una orden en una lista.
 *
 * Vive aparte porque la pintan dos pantallas —la lista general y la ficha del
 * pedido— y si cada una la dibujara por su cuenta acabarían mostrando cosas
 * distintas de la misma orden.
 */
export function OrderListItem({ order, folderName }: Props) {
  const ordered = order.lines.reduce(
    (sum, line) => sum + line.orderedQuantity,
    0,
  );
  const cut = order.lines.reduce((sum, line) => sum + line.cutQuantity, 0);
  const { pending, surplus } = cutProgress(ordered, cut);

  return (
    <div className="flat-surface relative flex items-start justify-between gap-3 p-3 transition-colors active:bg-accent">
      {/* El enlace va como capa sobre toda la tarjeta en vez de envolverla:
          un <button> dentro de un <a> no es HTML válido, y el botón de borrar
          tiene que quedar fuera del área que navega. */}
      <Link
        href={`/orders/${order.id}`}
        className="absolute inset-0 z-10"
        aria-label={`Abrir ${order.code}`}
      />

      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="tabular text-sm font-medium">{order.code}</span>
          <span
            className={cn(
              "rounded px-1.5 py-0.5 text-xs",
              CUTTING_ORDER_STATUS_STYLES[order.status],
            )}
          >
            {CUTTING_ORDER_STATUS_LABELS[order.status]}
          </span>
        </div>

        <p className="truncate text-sm">
          {order.description ?? "Sin descripción"}
        </p>

        <p className="truncate text-xs text-muted-foreground">
          {order.client?.name ?? "Sin cliente"}
          {order.material && ` · ${order.material.name}`}
          {` · ${formatDate(order.orderedAt)}`}
        </p>

        <div className="mt-1 flex flex-wrap items-center gap-1.5">
          {folderName && (
            <span className="rounded border border-border px-1.5 py-0.5 text-xs text-muted-foreground">
              {folderName}
            </span>
          )}

          {order.reference && (
            <span className="tabular rounded border border-border px-1.5 py-0.5 text-xs text-muted-foreground">
              Ref. {order.reference}
            </span>
          )}

          {/* La entrega se destaca en rojo si ya se pasó y la orden sigue
              abierta: es lo que convierte la lista en una alerta y no en un
              archivo. */}
          {order.dueDate && (
            <span
              className={cn(
                "tabular rounded border px-1.5 py-0.5 text-xs",
                isLate(order.dueDate, pending)
                  ? "border-state-defective text-state-defective"
                  : "border-border text-muted-foreground",
              )}
            >
              Entrega {formatDate(order.dueDate)}
            </span>
          )}
        </div>
      </div>

      {/* Lo que falta es el número que se busca al abrir la lista. Si se cortó
          de más, ese excedente pasa a ser el dato: un cero escondería que
          sobran piezas. */}
      <div className="flex shrink-0 items-start gap-1">
        <div className="text-right">
          <p
            className={cn(
              "tabular text-lg font-bold leading-none",
              surplus > 0 && "text-state-remnant",
            )}
          >
            {surplus > 0 ? `+${surplus}` : pending}
          </p>
          <p className="tabular text-xs text-muted-foreground">
            {surplus > 0 ? "sobran" : `de ${ordered}`}
          </p>
          {/* Cuánto se lleva cortado: sin esto, "faltan 300" no distingue una
              orden recién abierta de una casi lista. */}
          <p className="tabular mt-0.5 text-xs text-muted-foreground">
            {cut} cortadas
          </p>
        </div>

        {/* Por encima de la capa del enlace, o el toque abriría la orden. */}
        <OrderDeleteButton
          orderId={order.id}
          orderCode={order.code}
          cutQuantity={cut}
          className="relative z-20"
        />
      </div>
    </div>
  );
}

/**
 * ¿Se pasó la fecha de entrega con trabajo pendiente?
 *
 * Se exige que FALTE algo: una orden entregada tarde pero ya terminada no
 * necesita alarma, y pintarla de rojo para siempre haría que el color dejara
 * de significar "hay que correr".
 */
function isLate(dueDate: Date, pending: number): boolean {
  return pending > 0 && dueDate.getTime() < Date.now();
}
