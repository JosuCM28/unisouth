"use client";

import Link from "next/link";
import { Truck } from "lucide-react";
import type { ReceiptCardData } from "@/lib/repositories/receipt.repository";
import { UNIT_SHORT_LABELS } from "@/lib/constants/labels";
import { formatDate, formatQuantity } from "@/lib/utils";
import { EmptyState } from "@/components/shared/empty-state";
import { DataTable, type DataTableColumn } from "@/components/shared/data-table";
import { usePageParam } from "@/components/shared/use-page-param";
import { ReceiptCard } from "./receipt-card";

interface ReceiptListProps {
  receipts: ReceiptCardData[];
  /** Total que cumple el filtro, no las que llegaron a esta página. */
  total: number;
  page: number;
  totalPages: number;
  pageSize: number;
  isFiltered?: boolean;
}

export function ReceiptList({
  receipts,
  total,
  page,
  totalPages,
  pageSize,
  isFiltered,
}: ReceiptListProps) {
  const { onPageChange, onLoadMore, onPageSizeChange } = usePageParam();

  const columns: DataTableColumn<ReceiptCardData>[] = [
    {
      accessorKey: "date",
      header: "Fecha",
      // Ordena por el instante real, no por el texto ya formateado.
      accessorFn: (receipt) => new Date(receipt.date).getTime(),
      cell: ({ row }) => (
        <Link
          href={`/receipts/${row.original.code}`}
          className="tabular font-medium hover:underline"
        >
          {formatDate(row.original.date)}
        </Link>
      ),
    },
    {
      accessorKey: "code",
      header: "Folio",
      cell: ({ row }) => (
        <span className="tabular text-muted-foreground">{row.original.code}</span>
      ),
    },
    {
      // La tela va pegada al folio: sin ella la tabla es una lista de
      // números en la que todas las filas se ven iguales.
      id: "material",
      header: "Material",
      accessorFn: (receipt) => receipt.materialNames.join(", "),
      cell: ({ row }) => (
        <span className="font-medium">
          {row.original.materialNames.join(" · ") || "—"}
        </span>
      ),
    },
    {
      accessorKey: "guideNumber",
      header: "Guía",
      cell: ({ row }) => (
        <span className="tabular">{row.original.guideNumber ?? "—"}</span>
      ),
    },
    {
      id: "invoiceRef",
      header: "Factura",
      accessorFn: (receipt) => receipt.invoiceRef ?? "",
      cell: ({ row }) => (
        <span className="tabular text-muted-foreground">
          {row.original.invoiceRef ?? "—"}
        </span>
      ),
    },
    {
      id: "origin",
      header: "Origen",
      accessorFn: (receipt) => receipt.origin ?? "",
      cell: ({ row }) => (
        <span className="text-muted-foreground">
          {row.original.origin ?? "—"}
        </span>
      ),
    },
    {
      id: "client",
      header: "Cliente",
      /* De los ROLLOS, no del encabezado: una guía compartida no tiene dueño
         arriba, y leerlo de ahí pondría "Fábrica" sobre tela que sí es de un
         cliente. Con más de dos se cuentan, para no reventar la columna. */
      accessorFn: (receipt) => ownersLabel(receipt.ownerNames),
      cell: ({ row }) => (
        <span className="text-muted-foreground">
          {ownersLabel(row.original.ownerNames)}
        </span>
      ),
    },
    {
      id: "lotCount",
      header: "Rollos",
      accessorFn: (receipt) => receipt.lotCount,
      cell: ({ row }) => (
        <span className="tabular font-medium">{row.original.lotCount}</span>
      ),
    },
    {
      // El metraje es el dato que se coteja contra la factura.
      id: "totalQuantity",
      header: "Metraje",
      accessorFn: (receipt) => receipt.totalQuantity,
      cell: ({ row }) => (
        <span className="tabular font-medium">
          {row.original.totalQuantity > 0
            ? formatQuantity(row.original.totalQuantity, {
                unit: row.original.unit
                  ? UNIT_SHORT_LABELS[row.original.unit]
                  : "",
              })
            : "—"}
        </span>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-3">
      <DataTable
        columns={columns}
        data={receipts}
        server={{
          page,
          totalPages,
          total,
          pageSize,
          onPageChange,
          onLoadMore: () => onLoadMore(page),
          onPageSizeChange,
        }}
        itemLabel={{ one: "recepción", many: "recepciones" }}
        getRowId={(receipt) => receipt.id}
        emptyState={
          <div className="flat-surface">
            <EmptyState
              icon={Truck}
              title={isFiltered ? "Sin resultados" : "Aún no hay recepciones"}
              description={
                isFiltered
                  ? "Prueba con otra guía, fecha o quita algún filtro."
                  : "Registra la primera recepción con el botón de arriba."
              }
            />
          </div>
        }
        renderMobileRow={(receipt) => <ReceiptCard receipt={receipt} />}
      />
    </div>
  );
}

/** Uno o dos dueños se nombran; de tres en adelante se cuentan. */
function ownersLabel(owners: string[]): string {
  if (owners.length === 0) return "Fábrica";
  if (owners.length <= 2) return owners.join(" · ");
  return `${owners.length} dueños`;
}
