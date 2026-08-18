import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Pencil, Plus } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/core/session";
import {
  CUTTING_ORDER_STATUS_LABELS,
  CUTTING_ORDER_STATUS_STYLES,
} from "@/lib/constants/labels";
import { cn, contrastText, formatDate, formatDateTime } from "@/lib/utils";
import { PageHeader } from "@/components/layout/page-header";
import { OrderProgressDialog } from "@/components/orders/order-progress-dialog";
import { OrderCancelDialog } from "@/components/orders/order-cancel-dialog";
import { Button } from "@/components/ui/button";

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { id } = await params;
  const order = await prisma.cuttingOrder.findUnique({
    where: { id },
    select: { code: true },
  });
  return { title: order?.code ?? "Orden" };
}

/**
 * Ficha de una orden: lo pedido, lo cortado y lo que falta.
 *
 * Es la pantalla del día a día: se abre para registrar cuánto se cortó y para
 * saber qué queda pendiente sin tener que sumar a mano.
 */
export default async function OrderDetailPage({ params }: PageProps) {
  await requirePermission("inventory:read");

  const { id } = await params;

  const order = await prisma.cuttingOrder.findUnique({
    where: { id },
    include: {
      client: { select: { name: true } },
      material: { select: { name: true, code: true } },
      productionRun: { select: { code: true, name: true } },
      createdBy: { select: { name: true } },
      lines: {
        orderBy: { position: "asc" },
        include: {
          size: { select: { code: true, name: true } },
          cutTag: { select: { name: true, color: true } },
          progress: {
            orderBy: { createdAt: "desc" },
            include: { user: { select: { name: true } } },
          },
        },
      },
    },
  });

  if (!order) notFound();

  const ordered = order.lines.reduce((s, l) => s + l.orderedQuantity, 0);
  const cut = order.lines.reduce((s, l) => s + l.cutQuantity, 0);
  const pending = Math.max(0, ordered - cut);
  const isCancelled = order.status === "CANCELLED";

  // Todos los avances de la orden, del más reciente al más viejo.
  const history = order.lines
    .flatMap((line) =>
      line.progress.map((entry) => ({ ...entry, sizeCode: line.size.code })),
    )
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  return (
    <div className="flex flex-col gap-4">
      <Link
        href="/orders"
        className="touch-target flex w-fit items-center gap-1.5 text-sm text-muted-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Órdenes
      </Link>

      <PageHeader
        title={order.code}
        description={order.description ?? "Sin descripción"}
        action={
          !isCancelled ? (
            <div className="flex flex-wrap gap-2">
              <Button asChild variant="outline" className="touch-target">
                <Link href={`/orders/${order.id}/edit`}>
                  <Pencil className="size-4" aria-hidden />
                  Editar
                </Link>
              </Button>
              <OrderCancelDialog orderId={order.id} orderCode={order.code} />
            </div>
          ) : undefined
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <span
          className={cn(
            "rounded px-2 py-1 text-sm",
            CUTTING_ORDER_STATUS_STYLES[order.status],
          )}
        >
          {CUTTING_ORDER_STATUS_LABELS[order.status]}
        </span>
        <span className="tabular text-sm text-muted-foreground">
          {order.client?.name ?? "Sin cliente"}
          {order.material && ` · ${order.material.name}`}
        </span>
      </div>

      {/* Los tres números que se buscan al abrir la orden. */}
      <div className="grid grid-cols-3 gap-2">
        <Stat label="Pedidas" value={ordered} />
        <Stat label="Cortadas" value={cut} />
        <Stat label="Faltan" value={pending} strong />
      </div>

      <section className="flat-surface p-4">
        <h2 className="mb-3 text-sm font-semibold">Tallas</h2>

        <ul className="flex flex-col gap-2">
          {order.lines.map((line) => {
            const linePending = Math.max(
              0,
              line.orderedQuantity - line.cutQuantity,
            );
            const done = line.cutQuantity >= line.orderedQuantity;

            return (
              <li
                key={line.id}
                className="flat-surface flex items-center gap-3 p-3"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="tabular text-sm font-medium">
                      Talla {line.size.code}
                    </span>
                    {line.cutTag && (
                      <span
                        className="px-1.5 py-0.5 text-xs"
                        style={{
                          backgroundColor: line.cutTag.color,
                          color: contrastText(line.cutTag.color),
                        }}
                      >
                        {line.cutTag.name}
                      </span>
                    )}
                  </div>

                  <p className="tabular text-xs text-muted-foreground">
                    {line.cutQuantity} de {line.orderedQuantity} cortadas
                    {linePending > 0 && ` · faltan ${linePending}`}
                  </p>

                  {line.notes && (
                    <p className="truncate text-xs text-muted-foreground">
                      {line.notes}
                    </p>
                  )}
                </div>

                <div className="shrink-0 text-right">
                  <p
                    className={cn(
                      "tabular text-lg font-bold leading-none",
                      done && "text-state-available",
                    )}
                  >
                    {linePending}
                  </p>
                </div>

                {!isCancelled && (
                  <OrderProgressDialog
                    lineId={line.id}
                    sizeCode={line.size.code}
                    ordered={line.orderedQuantity}
                    cut={line.cutQuantity}
                    trigger={
                      <Button
                        variant="outline"
                        size="icon"
                        className="touch-target shrink-0"
                        aria-label={`Registrar avance de la talla ${line.size.code}`}
                      >
                        <Plus className="size-4" aria-hidden />
                      </Button>
                    }
                  />
                )}
              </li>
            );
          })}
        </ul>
      </section>

      <section className="flat-surface p-4">
        <h2 className="mb-3 text-sm font-semibold">Datos del pedido</h2>
        <dl className="grid gap-x-8 sm:grid-cols-2">
          <Row label="Orden del cliente" value={order.reference} tabular />
          <Row label="Pedido el" value={formatDate(order.orderedAt)} tabular />
          <Row
            label="Entrega"
            value={order.dueDate ? formatDate(order.dueDate) : null}
            tabular
          />
          <Row
            label="Material"
            value={
              order.material
                ? `${order.material.code} · ${order.material.name}`
                : null
            }
          />
          <Row
            label="Producción"
            value={
              order.productionRun
                ? `${order.productionRun.code} · ${order.productionRun.name}`
                : null
            }
          />
          <Row label="Capturó" value={order.createdBy?.name} />
          <Row
            label="Terminada"
            value={order.closedAt ? formatDateTime(order.closedAt) : null}
            tabular
          />
        </dl>

        {order.notes && (
          <p className="mt-3 whitespace-pre-wrap border-t border-border pt-3 text-sm">
            {order.notes}
          </p>
        )}
      </section>

      {/* El historial: responde cuándo se cortó cada tanda, que es lo que un
          número acumulado no puede decir. */}
      <section className="flat-surface p-4">
        <h2 className="mb-3 text-sm font-semibold">
          Historial de cortes ({history.length})
        </h2>

        {history.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Aún no se registra ningún avance.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {history.map((entry) => (
              <li
                key={entry.id}
                className="flex items-start justify-between gap-3 py-2"
              >
                <div className="min-w-0">
                  <p className="tabular text-sm">
                    Talla {entry.sizeCode}
                    <span
                      className={cn(
                        "ml-2 font-medium",
                        entry.quantity < 0 && "text-state-defective",
                      )}
                    >
                      {entry.quantity > 0 ? "+" : ""}
                      {entry.quantity}
                    </span>
                  </p>
                  <p className="tabular text-xs text-muted-foreground">
                    {formatDateTime(entry.createdAt)}
                    {entry.user?.name && ` · ${entry.user.name}`}
                  </p>
                  {entry.notes && (
                    <p className="text-xs text-muted-foreground">
                      {entry.notes}
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Stat({
  label,
  value,
  strong,
}: {
  label: string;
  value: number;
  strong?: boolean;
}) {
  return (
    <div className="flat-surface p-3 text-center">
      <p
        className={cn(
          "tabular text-2xl font-bold leading-none",
          strong && "text-state-reserved",
        )}
      >
        {value}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

function Row({
  label,
  value,
  tabular,
}: {
  label: string;
  value: string | null | undefined;
  tabular?: boolean;
}) {
  if (!value) return null;

  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-border py-1 text-sm last:border-b-0">
      <dt className="shrink-0 text-muted-foreground">{label}</dt>
      <dd className={cn("min-w-0 break-words text-right", tabular && "tabular")}>
        {value}
      </dd>
    </div>
  );
}
