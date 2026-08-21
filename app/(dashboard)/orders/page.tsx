import type { Metadata } from "next";
import Link from "next/link";
import { ClipboardList, FolderPlus, Plus } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/core/session";
import { OrderFolderRepository } from "@/lib/repositories/order-folder.repository";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Pager } from "@/components/shared/pager";
import { Button } from "@/components/ui/button";
import { FolderCard } from "@/components/orders/folder-card";
import { OrderFilters } from "@/components/orders/order-filters";
import { OrderListItem } from "@/components/orders/order-list-item";
import {
  cuttingOrderWhere,
  LOOSE_ORDERS,
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
    folder?: string;
    archived?: string;
  }>;
}

/**
 * Órdenes de corte: qué pidió cada cliente y cómo va.
 *
 * Arriba los pedidos —las carpetas que agrupan varias órdenes— y abajo las
 * órdenes sueltas. La lista responde de un vistazo lo único que importa a
 * diario: cuánto falta por cortar.
 */
export default async function OrdersPage({ searchParams }: PageProps) {
  await requirePermission("inventory:browse");

  const params = await searchParams;
  const page = parsePositiveInt(params.page) ?? 1;
  const accumulate = params.all === "1";
  const skip = accumulate ? 0 : (page - 1) * PAGE_SIZE;
  const take = accumulate ? Math.min(page * PAGE_SIZE, 300) : PAGE_SIZE;

  const filters = parseCuttingOrderFilters(params);
  const showArchived = params.archived === "1";

  /* Sin filtros, abajo van SÓLO las sueltas: las que están en un pedido ya se
     ven dentro de su carpeta y repetirlas haría la lista el doble de larga.
     En cuanto se filtra por algo, se busca en todas —quien filtra por cliente
     o por fecha quiere encontrar la orden, esté donde esté. */
  const isSearching = Boolean(
    filters.clientId || filters.status || filters.from || filters.to,
  );
  const listFilters = {
    ...filters,
    folderId: filters.folderId ?? (isSearching ? undefined : LOOSE_ORDERS),
  };
  const where = cuttingOrderWhere(listFilters);

  const [total, orders, clients, folders] = await Promise.all([
    prisma.cuttingOrder.count({ where }),
    prisma.cuttingOrder.findMany({
      where,
      /* Desempate por `createdAt` y no por `id`: la fecha se ancla al inicio
         del día, así que todo lo capturado hoy queda empatado, y `cuid()` no
         es cronológico. Sin esto lo más viejo del día sale hasta arriba. */
      orderBy: [{ orderedAt: "desc" }, { createdAt: "desc" }, { id: "desc" }],
      skip,
      take,
      include: {
        client: { select: { name: true } },
        material: { select: { name: true } },
        folder: { select: { name: true } },
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
    new OrderFolderRepository().findAllWithTotals({
      clientId: filters.clientId,
      includeArchived: showArchived,
    }),
  ]);

  const totalPages = Math.ceil(total / PAGE_SIZE) || 1;
  const hasFilters = isSearching || Boolean(filters.folderId);
  const isEmpty = orders.length === 0 && folders.length === 0;

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Órdenes"
        description="Qué pidieron y cuánto falta por cortar"
        action={
          <div className="flex items-center gap-2">
            <Button asChild variant="outline" className="touch-target">
              <Link href="/orders/folders/new">
                <FolderPlus className="size-4" aria-hidden />
                Pedido
              </Link>
            </Button>
            <Button asChild className="touch-target">
              <Link href="/orders/new">
                <Plus className="size-4" aria-hidden />
                Nueva
              </Link>
            </Button>
          </div>
        }
      />

      <OrderFilters clients={clients} showArchived={showArchived} />

      {folders.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Pedidos
          </h2>
          <ul className="flex flex-col gap-2">
            {folders.map((folder) => (
              <li key={folder.id}>
                <FolderCard folder={folder} />
              </li>
            ))}
          </ul>
        </section>
      )}

      {isEmpty ? (
        <div className="flat-surface">
          {/* Con filtros puestos, "aún no hay órdenes" haría creer que se
              perdieron: lo que no hay es coincidencias. */}
          <EmptyState
            icon={ClipboardList}
            title={hasFilters ? "Ninguna orden coincide" : "Aún no hay órdenes"}
            description={
              hasFilters
                ? "Prueba con otro rango de fechas, otro cliente u otro estado."
                : "Da de alta lo que pidió el cliente y ve descontando conforme se corta."
            }
          />
        </div>
      ) : (
        orders.length > 0 && (
          <section className="flex flex-col gap-2">
            {/* El encabezado sólo aparece si hay pedidos arriba: sin ellos
                sería una etiqueta sobre la única lista de la pantalla. */}
            {folders.length > 0 && (
              <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {isSearching ? "Órdenes" : "Órdenes sueltas"}
              </h2>
            )}
            <ul className="flex flex-col gap-2">
              {orders.map((order) => (
                <li key={order.id}>
                  <OrderListItem
                    order={order}
                    // El pedido sólo se etiqueta al buscar, que es cuando
                    // aparecen mezcladas órdenes de dentro y de fuera.
                    folderName={isSearching ? order.folder?.name : null}
                  />
                </li>
              ))}
            </ul>
          </section>
        )
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

/** Entero positivo o nada. Cualquier basura en la URL se ignora. */
function parsePositiveInt(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) return undefined;
  return parsed;
}
