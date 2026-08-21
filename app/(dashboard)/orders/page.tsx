import type { Metadata } from "next";
import Link from "next/link";
import { ClipboardList, Plus } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/core/session";
import {
  CUTTING_ORDER_STATUS_LABELS,
  CUTTING_ORDER_STATUS_STYLES,
} from "@/lib/constants/labels";
import { cn, cutProgress, formatDate } from "@/lib/utils";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Pager } from "@/components/shared/pager";
import { Button } from "@/components/ui/button";
import { OrderFilters } from "@/components/orders/order-filters";
import {
  cuttingOrderWhere,
  parseCuttingOrderFilters,
} from "@/lib/repositories/cutting-order-filters";

export const metadata: Metadata = { title: "Órdenes" };

const PAGE_SIZE = 50;

interface PageProps {
  searchParams: Promise<{
    page?: string;
    all?: string;
    client?: string;
    status?: string;
    from?: string;
    to?: string;
  }>;
}

/**
 * Órdenes de corte: qué pidió cada cliente y cómo va.
 *
 * La lista responde de un vistazo lo único que importa a diario: cuánto falta
 * por cortar de cada orden.
 */
export default async function OrdersPage({ searchParams }: PageProps) {
  await requirePermission("inventory:read");

  const params = await searchParams;
  const page = parsePositiveInt(params.page) ?? 1;
  const accumulate = params.all === "1";
  const skip = accumulate ? 0 : (page - 1) * PAGE_SIZE;
  const take = accumulate ? Math.min(page * PAGE_SIZE, 300) : PAGE_SIZE;

  const filters = parseCuttingOrderFilters(params);
  const where = cuttingOrderWhere(filters);

  const [total, orders, clients] = await Promise.all([
    prisma.cuttingOrder.count({ where }),
    prisma.cuttingOrder.findMany({
      where,
      // El id desempata: `orderedAt` no es único y sin criterio estable las
      // filas se barajan entre páginas.
      /* Desempate por `createdAt` y no por `id`: la fecha se ancla al inicio
         del día, así que todo lo capturado hoy queda empatado, y `cuid()` no
         es cronológico. Sin esto lo más viejo del día sale hasta arriba. */
      orderBy: [{ orderedAt: "desc" }, { createdAt: "desc" }, { id: "desc" }],
      skip,
      take,
      include: {
        client: { select: { name: true } },
        material: { select: { name: true } },
        lines: { select: { orderedQuantity: true, cutQuantity: true } },
      },
    }),
    // Sólo los clientes que de verdad tienen órdenes: ofrecer el catálogo
    // entero llena el filtro de nombres que no devuelven nada.
    prisma.client.findMany({
      where: { cuttingOrders: { some: {} } },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const totalPages = Math.ceil(total / PAGE_SIZE) || 1;
  const hasFilters = Object.values(filters).some(Boolean);

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Órdenes"
        description="Qué pidieron y cuánto falta por cortar"
        action={
          <Button asChild className="touch-target">
            <Link href="/orders/new">
              <Plus className="size-4" aria-hidden />
              Nueva
            </Link>
          </Button>
        }
      />

      <OrderFilters clients={clients} />

      {orders.length === 0 ? (
        <div className="flat-surface">
          {/* Con filtros puestos, "aún no hay órdenes" haría creer que se
              perdieron: lo que no hay es coincidencias. */}
          <EmptyState
            icon={ClipboardList}
            title={
              hasFilters
                ? "Ninguna orden coincide"
                : "Aún no hay órdenes"
            }
            description={
              hasFilters
                ? "Prueba con otro rango de fechas, otro cliente u otro estado."
                : "Da de alta lo que pidió el cliente y ve descontando conforme se corta."
            }
          />
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {orders.map((order) => {
            const ordered = order.lines.reduce(
              (sum, line) => sum + line.orderedQuantity,
              0,
            );
            const cut = order.lines.reduce(
              (sum, line) => sum + line.cutQuantity,
              0,
            );
            const { pending, surplus } = cutProgress(ordered, cut);

            return (
              <li key={order.id}>
                <Link
                  href={`/orders/${order.id}`}
                  className="flat-surface flex items-start justify-between gap-3 p-3 transition-colors active:bg-accent"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="tabular text-sm font-medium">
                        {order.code}
                      </span>
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
                      {order.reference && (
                        <span className="tabular rounded border border-border px-1.5 py-0.5 text-xs text-muted-foreground">
                          Ref. {order.reference}
                        </span>
                      )}

                      {/* La entrega se destaca en rojo si ya se pasó y la
                          orden sigue abierta: es lo que convierte la lista en
                          una alerta y no en un archivo. */}
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

                  {/* Lo que falta es el número que se busca al abrir la lista.
                      Si se cortó de más, ese excedente pasa a ser el dato:
                      un cero escondería que sobran piezas. */}
                  <div className="shrink-0 text-right">
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
                    {/* Cuánto se lleva cortado: sin esto, "faltan 300" no
                        distingue una orden recién abierta de una casi lista. */}
                    <p className="tabular mt-0.5 text-xs text-muted-foreground">
                      {cut} cortadas
                    </p>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      <Pager
        page={page}
        totalPages={totalPages}
        total={total}
        itemLabel={{ one: "orden", many: "órdenes" }}
        basePath="/orders"
        params={params}
      />
    </div>
  );
}

/**
 * ¿Se pasó la fecha de entrega con trabajo pendiente?
 *
 * Se exige que FALTE algo: una orden entregada tarde pero ya terminada no
 * necesita alarma, y pintarla de rojo para siempre haría que el color
 * dejara de significar "hay que correr".
 */
function isLate(dueDate: Date, pending: number): boolean {
  return pending > 0 && dueDate.getTime() < Date.now();
}

/** Entero positivo o nada. Cualquier basura en la URL se ignora. */
function parsePositiveInt(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) return undefined;
  return parsed;
}
