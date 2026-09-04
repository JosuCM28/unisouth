"use client";

import Link from "next/link";
import { ClipboardList, MessageSquare } from "lucide-react";
import {
  CUTTING_ORDER_STATUS_LABELS,
  CUTTING_ORDER_STATUS_STYLES,
} from "@/lib/constants/labels";
import { cn, cutProgress, formatDate } from "@/lib/utils";
import { DataTable, type DataTableColumn } from "@/components/shared/data-table";
import { EmptyState } from "@/components/shared/empty-state";
import { usePageParam } from "@/components/shared/use-page-param";
import { OrderDeleteButton } from "./order-delete-button";
import { OrderListItem, type OrderListEntry } from "./order-list-item";

/** Una orden en la tabla: lo mismo que pinta la tarjeta, más su pedido. */
export interface OrderTableRow extends OrderListEntry {
  /**
   * El pedido al que pertenece.
   *
   * Se resuelve en el servidor y no se lee de `order.folder` para que la
   * ficha del pedido pueda mandarlo vacío: ahí la columna sobraría, porque
   * todas las órdenes de la pantalla son del mismo.
   */
  folderName: string | null;
}

/** La página que sirvió Postgres, cuando la lista viene recortada de la base. */
interface ServerPage {
  page: number;
  totalPages: number;
  total: number;
  pageSize: number;
}

interface Props {
  orders: OrderTableRow[];
  /**
   * Presente = la página la reparte Postgres; ausente = el navegador.
   *
   * La lista general trae 50 de varios cientos y tiene que paginar contra la
   * base. La ficha de un pedido trae SUS órdenes —una docena— y ahí paginar en
   * el navegador es correcto: ya llegaron todas.
   */
  server?: ServerPage;
  /** Si se pinta la columna del pedido. */
  showFolder?: boolean;
  /** Cambia el texto del vacío: "no hay" no es lo mismo que "no coincide". */
  isFiltered?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
}

/**
 * Las órdenes de corte en tabla.
 *
 * Desde `md:` es una tabla y en celular siguen siendo tarjetas —eso lo
 * resuelve `DataTable`, no esta pantalla—. La razón es de piso: en el
 * escritorio se comparan órdenes entre sí ("¿cuál va más atrasada?", "¿cuáles
 * son de Ternium?"), y para comparar hacen falta columnas alineadas. En el
 * celular no se compara: se busca UNA orden y se abre.
 *
 * El FILTRADO no lo hace TanStack, lo hace Postgres a través de la URL. No es
 * un olvido: la tabla sólo tiene en la mano las 50 filas de esta página, así
 * que un filtro de cliente resuelto aquí escondería las órdenes de ese cliente
 * que están en la página 3 y diría que no existen. El buscador y los chips de
 * arriba filtran sobre el total. De TanStack se usa lo que sí puede resolver
 * con lo que tiene: ordenar por columna y gobernar la paginación.
 */
export function OrderTable({
  orders,
  server,
  showFolder = false,
  isFiltered = false,
  emptyTitle,
  emptyDescription,
}: Props) {
  const { onPageChange, onLoadMore, onPageSizeChange } = usePageParam();

  const columns: DataTableColumn<OrderTableRow>[] = [
    {
      accessorKey: "code",
      header: "Folio",
      cell: ({ row }) => (
        <Link
          href={`/orders/${row.original.id}`}
          className="tabular font-medium hover:underline"
        >
          {row.original.code}
        </Link>
      ),
    },
    {
      accessorKey: "status",
      header: "Estado",
      cell: ({ row }) => (
        <span
          className={cn(
            "rounded px-1.5 py-0.5 text-xs",
            CUTTING_ORDER_STATUS_STYLES[row.original.status],
          )}
        >
          {CUTTING_ORDER_STATUS_LABELS[row.original.status]}
        </span>
      ),
    },
    {
      id: "description",
      header: "Prenda",
      accessorFn: (order) => order.description ?? "",
      cell: ({ row }) => (
        <span className="font-medium">
          {row.original.description ?? "Sin descripción"}
        </span>
      ),
    },
    {
      id: "client",
      header: "Cliente",
      accessorFn: (order) => order.client?.name ?? "",
      cell: ({ row }) => (
        <span>{row.original.client?.name ?? "Sin cliente"}</span>
      ),
    },
    ...(showFolder
      ? [
          {
            id: "folder",
            header: "Pedido",
            accessorFn: (order: OrderTableRow) => order.folderName ?? "",
            cell: ({ row }: { row: { original: OrderTableRow } }) => (
              <span className="text-muted-foreground">
                {row.original.folderName ?? "—"}
              </span>
            ),
          } satisfies DataTableColumn<OrderTableRow>,
        ]
      : []),
    {
      id: "material",
      header: "Tela",
      accessorFn: (order) => order.material?.name ?? "",
      cell: ({ row }) => (
        <span className="text-muted-foreground">
          {row.original.material?.name ?? "—"}
        </span>
      ),
    },
    {
      id: "reference",
      header: "Ref. cliente",
      accessorFn: (order) => order.reference ?? "",
      cell: ({ row }) => (
        <span className="tabular text-muted-foreground">
          {row.original.reference ?? "—"}
        </span>
      ),
    },
    {
      id: "orderedAt",
      header: "Fecha",
      // Ordena por el instante real, no por el texto ya formateado: "03 sep"
      // y "3 ene" alfabéticamente quedan al revés de como ocurrieron.
      accessorFn: (order) => new Date(order.orderedAt).getTime(),
      cell: ({ row }) => (
        <span className="tabular">{formatDate(row.original.orderedAt)}</span>
      ),
    },
    {
      id: "dueDate",
      header: "Entrega",
      /* Sin fecha se manda al final ordenando por entrega: una orden sin
         compromiso no es la más urgente ni la menos, y colarla arriba con un
         cero empujaría hacia abajo justo lo que hay que mirar. */
      accessorFn: (order) =>
        order.dueDate ? new Date(order.dueDate).getTime() : Number.MAX_SAFE_INTEGER,
      cell: ({ row }) => <DueDate order={row.original} />,
    },
    {
      id: "ordered",
      header: "Pedidas",
      accessorFn: (order) => totalsOf(order).ordered,
      cell: ({ row }) => (
        <span className="tabular">{totalsOf(row.original).ordered}</span>
      ),
    },
    {
      id: "cut",
      header: "Cortadas",
      accessorFn: (order) => totalsOf(order).cut,
      cell: ({ row }) => (
        <span className="tabular">{totalsOf(row.original).cut}</span>
      ),
    },
    {
      id: "pending",
      header: "Faltan",
      /* Lo que falta ES la columna de esta pantalla, así que se ordena por
         ella: picar el encabezado deja arriba las órdenes más atrasadas. El
         excedente cuenta como cero pendiente, que es lo que de verdad falta. */
      accessorFn: (order) => totalsOf(order).pending,
      cell: ({ row }) => <Pending order={row.original} />,
    },
    {
      id: "progress",
      header: "Avance",
      accessorFn: (order) => progressOf(order),
      cell: ({ row }) => <Progress order={row.original} />,
    },
    {
      id: "comments",
      header: "Notas",
      accessorFn: (order) => order._count?.comments ?? 0,
      cell: ({ row }) => <Comments count={row.original._count?.comments ?? 0} />,
    },
    {
      id: "actions",
      header: "",
      enableSorting: false,
      cell: ({ row }) => (
        <OrderDeleteButton
          orderId={row.original.id}
          orderCode={row.original.code}
          cutQuantity={totalsOf(row.original).cut}
        />
      ),
    },
  ];

  return (
    <DataTable
      columns={columns}
      data={orders}
      getRowId={(order) => order.id}
      itemLabel={{ one: "orden", many: "órdenes" }}
      {...(server
        ? {
            server: {
              ...server,
              onPageChange,
              onLoadMore: () => onLoadMore(server.page),
              onPageSizeChange,
            },
          }
        : {})}
      emptyState={
        <div className="flat-surface">
          <EmptyState
            icon={ClipboardList}
            title={emptyTitle ?? defaultEmptyTitle(isFiltered)}
            description={emptyDescription ?? defaultEmptyDescription(isFiltered)}
          />
        </div>
      }
      renderMobileRow={(order) => (
        <OrderListItem
          order={order}
          folderName={showFolder ? order.folderName : null}
        />
      )}
    />
  );
}

/** Lo pedido, lo cortado y lo que falta, en un solo lugar. */
function totalsOf(order: OrderTableRow) {
  const ordered = order.lines.reduce(
    (sum, line) => sum + line.orderedQuantity,
    0,
  );
  const cut = order.lines.reduce((sum, line) => sum + line.cutQuantity, 0);

  return { ordered, cut, ...cutProgress(ordered, cut) };
}

/** Qué porcentaje del pedido ya se cortó. Se topa en 100 aunque sobre. */
function progressOf(order: OrderTableRow): number {
  const { ordered, cut } = totalsOf(order);
  if (ordered <= 0) return 0;

  return Math.min(100, Math.round((cut / ordered) * 100));
}

/**
 * ¿Se pasó la fecha de entrega con trabajo pendiente?
 *
 * Se exige que FALTE algo: una orden entregada tarde pero ya terminada no
 * necesita alarma, y pintarla de rojo para siempre haría que el color dejara
 * de significar "hay que correr".
 */
function isLate(dueDate: Date, pending: number): boolean {
  return pending > 0 && new Date(dueDate).getTime() < Date.now();
}

function DueDate({ order }: { order: OrderTableRow }) {
  if (!order.dueDate) return <span className="text-muted-foreground">—</span>;

  const { pending } = totalsOf(order);

  return (
    <span
      className={cn(
        "tabular",
        isLate(order.dueDate, pending) && "font-medium text-state-defective",
      )}
    >
      {formatDate(order.dueDate)}
    </span>
  );
}

/**
 * Lo que falta por cortar, o lo que sobró.
 *
 * Si se cortó de más, ese excedente pasa a ser el dato: un cero escondería
 * que sobran piezas, que es justo lo que hay que ir a revisar.
 */
function Pending({ order }: { order: OrderTableRow }) {
  const { pending, surplus } = totalsOf(order);

  if (surplus > 0) {
    return (
      <span className="tabular font-bold text-state-remnant">+{surplus}</span>
    );
  }

  return <span className="tabular font-bold">{pending}</span>;
}

/**
 * La barra de avance.
 *
 * Sólida y con borde de 1px, sin degradado: el sistema visual es plano y esto
 * se lee bajo la luz de la bodega. NO usa el ámbar —ése está reservado a la
 * acción primaria y al nav— así que el relleno va en el color del texto y sólo
 * cambia a verde cuando la orden ya está completa.
 */
function Progress({ order }: { order: OrderTableRow }) {
  const percent = progressOf(order);
  const isDone = percent >= 100;

  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-14 border border-border bg-muted">
        <div
          className={cn("h-full", isDone ? "bg-state-available" : "bg-foreground")}
          style={{ width: `${percent}%` }}
        />
      </div>
      <span className="tabular text-xs text-muted-foreground">{percent}%</span>
    </div>
  );
}

/**
 * Cuántas notas de planeación trae la orden.
 *
 * El número y no el texto: las notas son internas y a veces largas. Lo que
 * resuelve la columna es saber cuáles ya se planearon sin abrirlas una por una.
 */
function Comments({ count }: { count: number }) {
  if (count === 0) return <span className="text-muted-foreground">—</span>;

  return (
    <span className="flex items-center gap-1 text-muted-foreground">
      <MessageSquare className="size-3.5 shrink-0" aria-hidden />
      <span className="tabular">{count}</span>
      <span className="sr-only">
        {count === 1 ? "comentario interno" : "comentarios internos"}
      </span>
    </span>
  );
}

/** Con filtros puestos, "aún no hay" haría creer que se perdieron. */
function defaultEmptyTitle(isFiltered: boolean): string {
  return isFiltered ? "Ninguna orden coincide" : "Aún no hay órdenes";
}

function defaultEmptyDescription(isFiltered: boolean): string {
  if (isFiltered) {
    return "Prueba con otro rango de fechas, otro cliente u otro estado.";
  }

  return "Da de alta lo que pidió el cliente y ve descontando conforme se corta.";
}
