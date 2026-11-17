"use client";

import type { ReactNode } from "react";
import type { FinishedStockRow } from "@/lib/repositories/finished-goods.repository";
import { formatQuantity } from "@/lib/utils";
import { DataTable, type DataTableColumn } from "@/components/shared/data-table";

export const NO_PO_LABEL = "Sin PO";
export const NO_CATEGORY_LABEL = "Sin tipo";
export const NO_CLIENT_LABEL = "Sin cliente";

/** Renglones por página: la lista llega completa y se reparte aquí. */
const PAGE_SIZE = 50;

/**
 * El inventario terminado: un renglón por producto, talla, cliente y PO.
 *
 * Tabla plana y no agrupada por producto: con cliente y PO en su propia
 * columna se ordena y se lee de un vistazo qué empresa tiene qué, que es lo
 * que se pregunta al armar un pedido que mezcla dueños.
 *
 * Las acciones llegan por `renderActions` porque dependen de la pantalla:
 * en el inventario son kárdex y ajuste; en la caja, cuántas meter.
 */
export function FinishedStockTable({
  rows,
  renderActions,
  emptyState,
}: {
  rows: FinishedStockRow[];
  renderActions: (row: FinishedStockRow) => ReactNode;
  emptyState: ReactNode;
}) {
  const columns: DataTableColumn<FinishedStockRow>[] = [
    {
      id: "product",
      header: "Producto",
      accessorFn: (row) => row.product.name,
      cell: ({ row }) => (
        <div className="flex flex-col">
          <span className="font-medium">{row.original.product.name}</span>
          <span className="tabular text-xs text-muted-foreground">{row.original.product.code}</span>
        </div>
      ),
    },
    {
      id: "category",
      header: "Tipo",
      accessorFn: (row) => row.product.garmentCategory?.name ?? "",
      cell: ({ row }) => (
        <span className="text-muted-foreground">
          {row.original.product.garmentCategory?.name ?? NO_CATEGORY_LABEL}
        </span>
      ),
    },
    {
      id: "size",
      header: "Talla",
      // Por el orden del catálogo y no por el texto: "2XCH" iría antes que "CH".
      accessorFn: (row) => row.size.order,
      cell: ({ row }) => <span className="tabular font-medium">{row.original.size.code}</span>,
    },
    {
      id: "po",
      header: "PO",
      accessorFn: (row) => row.clientPo ?? "",
      cell: ({ row }) => <span className="tabular">{row.original.clientPo ?? NO_PO_LABEL}</span>,
    },
    {
      id: "client",
      header: "Cliente",
      accessorFn: (row) => row.client?.name ?? "",
      cell: ({ row }) => <span>{row.original.client?.name ?? NO_CLIENT_LABEL}</span>,
    },
    {
      id: "quantity",
      header: () => <span className="block text-right">Piezas</span>,
      accessorFn: (row) => row.quantity,
      cell: ({ row }) => (
        <span className="tabular block text-right font-medium">{formatQuantity(row.original.quantity)}</span>
      ),
    },
    {
      id: "actions",
      header: () => <span className="sr-only">Acciones</span>,
      enableSorting: false,
      cell: ({ row }) => <div className="flex justify-end gap-1">{renderActions(row.original)}</div>,
    },
  ];

  return (
    <DataTable
      columns={columns}
      data={rows}
      pageSize={PAGE_SIZE}
      getRowId={(row) => row.id}
      itemLabel={{ one: "renglón", many: "renglones" }}
      emptyState={emptyState}
      renderMobileRow={(row) => <MobileRow row={row} actions={renderActions(row)} />}
    />
  );
}

/** En celular, tarjeta con las mismas etiquetas que las columnas. */
function MobileRow({ row, actions }: { row: FinishedStockRow; actions: ReactNode }) {
  return (
    <div className="flat-surface flex flex-col gap-2 p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{row.product.name}</p>
          <p className="tabular text-xs text-muted-foreground">
            {row.product.garmentCategory?.name ?? NO_CATEGORY_LABEL} · {row.product.code}
          </p>
        </div>
        <p className="tabular shrink-0 text-sm font-medium">{formatQuantity(row.quantity)} pzas</p>
      </div>
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-sm">
        <dt className="text-xs text-muted-foreground">Talla</dt>
        <dd className="tabular font-medium">{row.size.code}</dd>
        <dt className="text-xs text-muted-foreground">PO</dt>
        <dd className="tabular">{row.clientPo ?? NO_PO_LABEL}</dd>
        <dt className="text-xs text-muted-foreground">Cliente</dt>
        <dd className="min-w-0 truncate">{row.client?.name ?? NO_CLIENT_LABEL}</dd>
      </dl>
      <div className="flex justify-end gap-1 border-t border-border pt-2">{actions}</div>
    </div>
  );
}
