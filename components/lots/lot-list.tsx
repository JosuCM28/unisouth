"use client";

import Link from "next/link";
import { Boxes } from "lucide-react";
import { UNIT_SHORT_LABELS } from "@/lib/constants/labels";
import { formatDate, formatQuantity } from "@/lib/utils";
import { EmptyState } from "@/components/shared/empty-state";
import { DataTable, type DataTableColumn } from "@/components/shared/data-table";
import { usePageParam } from "@/components/shared/use-page-param";
import { LotCard, StatusChip, type LotCardData } from "./lot-card";

interface LotListProps {
  lots: LotCardData[];
  /** Total de rollos que cumplen el filtro, no los que llegaron a esta página. */
  total: number;
  page: number;
  totalPages: number;
  pageSize: number;
  isFiltered?: boolean;
}

export function LotList({
  lots,
  total,
  page,
  totalPages,
  pageSize,
  isFiltered,
}: LotListProps) {
  const { onPageChange, onLoadMore } = usePageParam();

  const columns: DataTableColumn<LotCardData>[] = [
    {
      accessorKey: "code",
      header: "Folio",
      cell: ({ row }) => (
        <Link href={`/lots/${row.original.code}`} className="tabular font-medium hover:underline">
          {row.original.code}
        </Link>
      ),
    },
    {
      id: "material",
      header: "Material",
      accessorFn: (lot) => lot.material.name,
      cell: ({ row }) => (
        <>
          {row.original.material.name}
          {row.original.colorText && (
            <span className="text-muted-foreground"> · {row.original.colorText}</span>
          )}
        </>
      ),
    },
    {
      accessorKey: "shade",
      header: "Tono",
      cell: ({ row }) => (
        <span className="tabular text-muted-foreground">{row.original.shade ?? "—"}</span>
      ),
    },
    {
      id: "ubicacion",
      header: "Ubicación",
      accessorFn: (lot) => lot.location?.code ?? "",
      cell: ({ row }) => (
        <span className="tabular text-muted-foreground">
          {row.original.location?.code ?? "—"}
        </span>
      ),
    },
    {
      id: "cliente",
      header: "Cliente",
      accessorFn: (lot) => lot.client?.name ?? "Fábrica",
      cell: ({ row }) => (
        <span className="text-muted-foreground">
          {row.original.client?.name ?? "Fábrica"}
        </span>
      ),
    },
    {
      accessorKey: "status",
      header: "Estado",
      cell: ({ row }) => <StatusChip status={row.original.status} />,
    },
    {
      id: "cantidad",
      header: "Cantidad",
      // Ordena por el número, no por el texto: "1,000" iría antes que "9".
      accessorFn: (lot) => Number(lot.currentQuantity),
      cell: ({ row }) => (
        <span className="tabular text-right font-medium">
          {formatQuantity(row.original.currentQuantity, {
            unit: UNIT_SHORT_LABELS[row.original.unit],
          })}
        </span>
      ),
    },
    {
      accessorKey: "receivedAt",
      header: "Recibido",
      cell: ({ row }) => (
        <span className="tabular text-muted-foreground">
          {formatDate(row.original.receivedAt)}
        </span>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-3">
      <DataTable
        columns={columns}
        data={lots}
        server={{
          page,
          totalPages,
          total,
          pageSize,
          onPageChange,
          onLoadMore: () => onLoadMore(page),
        }}
        itemLabel={{ one: "rollo", many: "rollos" }}
        getRowId={(lot) => lot.id}
        emptyState={
          <div className="flat-surface">
            <EmptyState
              icon={Boxes}
              title={isFiltered ? "Sin resultados" : "Aún no hay rollos"}
              description={
                isFiltered
                  ? "Prueba con otro folio, material o quita algún filtro."
                  : "Da de alta el primer rollo con el botón de arriba."
              }
            />
          </div>
        }
        renderMobileRow={(lot) => <LotCard lot={lot} />}
      />
    </div>
  );
}
