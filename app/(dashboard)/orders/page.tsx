import type { Metadata } from "next";
import Link from "next/link";
import { ClipboardList, FolderPlus, Plus } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/core/session";
import { roleHasPermission } from "@/lib/constants/roles";
import { parseOrderView } from "@/lib/constants/order-view";
import { OrderDispatchRepository } from "@/lib/repositories/order-dispatch.repository";
import { OrderFolderRepository } from "@/lib/repositories/order-folder.repository";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { SearchInput } from "@/components/shared/search-input";
import { Button } from "@/components/ui/button";
import { FolderList } from "@/components/orders/folder-list";
import { OrderFilters } from "@/components/orders/order-filters";
import { OrderTable } from "@/components/orders/order-table";
import { OrderViewTabs } from "@/components/orders/order-view-tabs";
import {
  cuttingOrderWhere,
  LOOSE_ORDERS,
  parseCuttingOrderFilters,
  type CuttingOrderFilters,
} from "@/lib/repositories/cutting-order-filters";

export const metadata: Metadata = { title: "Órdenes" };

const PAGE_SIZE = 50;

/** Pedidos por página: cada tarjeta suma sus órdenes, así que van menos. */
const FOLDER_PAGE_SIZE = 25;

/** Los tamaños que ofrece el selector de la tabla. Cualquier otro se ignora. */
const PAGE_SIZES = [10, 25, 50, 100];

type Params = {
  q?: string;
  page?: string;
  all?: string;
  client?: string;
  status?: string;
  from?: string;
  to?: string;
  folder?: string;
  archived?: string;
  filas?: string;
  vista?: string;
};

interface PageProps {
  searchParams: Promise<Params>;
}

interface ViewContext {
  params: Params;
  filters: CuttingOrderFilters;
  page: number;
  accumulate: boolean;
  canWrite: boolean;
}

/**
 * Órdenes de corte: qué pidió cada cliente y cómo va.
 *
 * Dos pestañas, órdenes sueltas (la que abre) y pedidos. Los filtros de
 * arriba son los mismos para las dos y sobreviven al cambiar de pestaña.
 */
export default async function OrdersPage({ searchParams }: PageProps) {
  const user = await requirePermission("orders:browse");
  /* Quien sólo mira el avance no ve un solo botón de captura: ofrecerle
     "Nueva" para que le rebote `executeAction` es prometerle algo que no
     puede hacer. La barrera de verdad sigue estando en el servidor. */
  const canWrite = roleHasPermission(user.role, "inventory:write");

  const params = await searchParams;
  const view = parseOrderView(params.vista);
  const context: ViewContext = {
    params,
    filters: parseCuttingOrderFilters(params),
    page: parsePositiveInt(params.page) ?? 1,
    accumulate: params.all === "1",
    canWrite,
  };

  /* Sólo los clientes que de verdad tienen órdenes: ofrecer el catálogo
     entero llena el filtro de nombres que no devuelven nada. */
  const clients = await prisma.client.findMany({
    where: { cuttingOrders: { some: {} } },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Órdenes"
        description="Qué pidieron y cuánto falta por cortar"
        action={canWrite ? <CreateButtons /> : undefined}
      />

      {/* El buscador va ARRIBA de los filtros: con muchas órdenes es más
          rápido teclear el folio o la prenda que ir acotando por cliente y
          fecha hasta dar con ella. */}
      <SearchInput
        placeholder="Folio, PO u orden del cliente, prenda, tela, pedido…"
        className="w-full md:max-w-sm"
      />

      <OrderFilters
        clients={clients}
        showArchived={view === "folders" && params.archived === "1"}
        showArchiveToggle={view === "folders"}
      />

      <OrderViewTabs view={view} params={params} />

      {/* Cada pestaña consulta sólo lo suyo. */}
      {view === "folders" ? (
        <FoldersView {...context} />
      ) : (
        <LooseOrdersView {...context} />
      )}
    </div>
  );
}

function CreateButtons() {
  return (
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
  );
}

/** ¿Hay algún filtro de la ORDEN puesto? */
function isSearching(filters: CuttingOrderFilters): boolean {
  return Boolean(
    filters.search ||
      filters.clientId ||
      filters.status ||
      filters.from ||
      filters.to,
  );
}

async function LooseOrdersView({
  params,
  filters,
  page,
  accumulate,
  canWrite,
}: ViewContext) {
  /* Se acota a los tamaños del selector: cualquier otro valor en la URL se
     ignora en vez de dejar que alguien pida 100 000 filas a mano. */
  const pageSize = PAGE_SIZES.includes(Number(params.filas))
    ? Number(params.filas)
    : PAGE_SIZE;
  const searching = isSearching(filters);

  const where = cuttingOrderWhere({
    ...filters,
    /* Sin filtros, SÓLO las sueltas: las que están en un pedido se ven en su
       pestaña. En cuanto se filtra por algo, se busca en todas —quien filtra
       por cliente o por fecha quiere encontrar la orden, esté donde esté—. */
    folderId: filters.folderId ?? (searching ? undefined : LOOSE_ORDERS),
    /* SÓLO lo que ya está en el concentrado de la casa. Las de la otra planta
       no son nuestras hasta que alguien las jala con Agregar; las de la casa
       nacen agregadas, así que el filtro no les hace nada. */
    adopted: true,
  });

  const [total, orders] = await Promise.all([
    prisma.cuttingOrder.count({ where }),
    prisma.cuttingOrder.findMany({
      where,
      /* Desempate por `createdAt` y no por `id`: la fecha se ancla al inicio
         del día, así que todo lo capturado hoy queda empatado, y `cuid()` no
         es cronológico. Sin esto lo más viejo del día sale hasta arriba. */
      orderBy: [{ orderedAt: "desc" }, { createdAt: "desc" }, { id: "desc" }],
      skip: accumulate ? 0 : (page - 1) * pageSize,
      take: accumulate ? Math.min(page * pageSize, 300) : pageSize,
      include: {
        client: { select: { name: true } },
        material: { select: { name: true } },
        folder: { select: { name: true } },
        lines: { select: { orderedQuantity: true, cutQuantity: true } },
        // Para el contador de comentarios internos de la tarjeta.
        _count: { select: { comments: true } },
      },
    }),
  ]);

  const hasFilters = searching || Boolean(filters.folderId);

  if (orders.length === 0) {
    return (
      <div className="flat-surface">
        {/* Con filtros puestos, "aún no hay órdenes" haría creer que se
            perdieron: lo que no hay es coincidencias. */}
        <EmptyState
          icon={ClipboardList}
          title={hasFilters ? "Ninguna orden coincide" : "Aún no hay órdenes sueltas"}
          description={emptyDescription(hasFilters, canWrite)}
        />
      </div>
    );
  }

  // Sólo quien captura ve Enviar: a quien consulta no se le pregunta nada.
  const pendingDispatch = canWrite
    ? await new OrderDispatchRepository().findOrderIdsWithPendingDispatch(
        orders.map((order) => order.id),
      )
    : new Set<string>();

  return (
    <OrderTable
      orders={orders.map((order) => ({
        ...order,
        folderName: order.folder?.name ?? null,
        hasPendingDispatch: pendingDispatch.has(order.id),
      }))}
      server={{
        page,
        totalPages: Math.ceil(total / pageSize) || 1,
        total,
        pageSize,
      }}
      // El pedido sólo se etiqueta al buscar, que es cuando aparecen
      // mezcladas órdenes de dentro y de fuera de una carpeta.
      showFolder={searching}
      isFiltered={hasFilters}
      canWrite={canWrite}
      columnsKey="orders"
    />
  );
}

async function FoldersView({
  params,
  filters,
  page,
  accumulate,
  canWrite,
}: ViewContext) {
  const showArchived = params.archived === "1";
  const folderFilters = {
    search: filters.search,
    clientId: filters.clientId,
    includeArchived: showArchived,
    /* Mismo buscador que las órdenes: el pedido sale si su nombre coincide o
       si alguna de sus órdenes coincide —la prenda, la PO, la tela—. */
    orderSearch: filters.search
      ? cuttingOrderWhere({ search: filters.search, adopted: true })
      : undefined,
    // Estado y fechas son de la orden: el pedido sale si alguna cumple.
    orderFilter:
      filters.status || filters.from || filters.to
        ? cuttingOrderWhere({
            status: filters.status,
            from: filters.from,
            to: filters.to,
            dateField: filters.dateField,
            adopted: true,
          })
        : undefined,
  };

  const repository = new OrderFolderRepository();
  const [folders, total] = await Promise.all([
    repository.findAllWithTotals({
      ...folderFilters,
      skip: accumulate ? 0 : (page - 1) * FOLDER_PAGE_SIZE,
      limit: accumulate ? page * FOLDER_PAGE_SIZE : FOLDER_PAGE_SIZE,
    }),
    repository.countWithTotals(folderFilters),
  ]);

  return (
    <FolderList
      folders={folders}
      page={page}
      totalPages={Math.ceil(total / FOLDER_PAGE_SIZE) || 1}
      total={total}
      params={params}
      isFiltered={isSearching(filters) || showArchived}
      canWrite={canWrite}
    />
  );
}

/**
 * El texto del vacío, que depende de quién mira.
 *
 * A quien captura se le dice qué hacer; a quien sólo consulta no, porque el
 * botón que necesitaría para hacerlo ni siquiera está en su pantalla.
 */
function emptyDescription(hasFilters: boolean, canWrite: boolean): string {
  if (hasFilters) {
    return "Prueba con otro rango de fechas, otro cliente u otro estado.";
  }
  if (!canWrite) return "Cuando se den de alta, aparecerán aquí.";
  return "Da de alta lo que pidió el cliente y ve descontando conforme se corta.";
}

/** Entero positivo o nada. Cualquier basura en la URL se ignora. */
function parsePositiveInt(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) return undefined;
  return parsed;
}
