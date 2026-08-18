"use client";

import Link from "next/link";
import { Truck } from "lucide-react";
import type { ReceiptCardData } from "@/lib/repositories/receipt.repository";
import { formatDate } from "@/lib/utils";
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
  const { onPageChange, onLoadMore } = usePageParam();

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
      accessorKey: "guideNumber",
      header: "Guía",
      cell: ({ row }) => (
        <span className="tabular">{row.original.guideNumber ?? "—"}</span>
      ),
    },
    {
      id: "carrier",
      header: "Paquetería",
      accessorFn: (receipt) => receipt.carrier?.name ?? "",
      cell: ({ row }) => (
        <span className="text-muted-foreground">
          {row.original.carrier?.name ?? "—"}
        </span>
      ),
    },
    {
      id: "supplier",
      header: "Proveedor",
      accessorFn: (receipt) => receipt.supplier?.name ?? "",
      cell: ({ row }) => (
        <span className="text-muted-foreground">
          {row.original.supplier?.name ?? "—"}
        </span>
      ),
    },
    {
      id: "client",
      header: "Cliente",
      accessorFn: (receipt) => receipt.client?.name ?? "Fábrica",
      cell: ({ row }) => (
        <span className="text-muted-foreground">
          {row.original.client?.name ?? "Fábrica"}
        </span>
      ),
    },
    {
      id: "lotCount",
      header: "Rollos",
      accessorFn: (receipt) => receipt.lotCount,
      cell: ({ row }) => (
        <span className="tabular text-right font-medium">
          {row.original.lotCount}
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
