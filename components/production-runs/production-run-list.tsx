"use client";

import { Factory } from "lucide-react";
import {
  PRODUCTION_RUN_STATUS_LABELS,
  PRODUCTION_RUN_STATUS_STYLES,
} from "@/lib/constants/labels";
import type { ProductionRunWithDetail } from "@/lib/repositories/production-run.repository";
import { cn, formatDate } from "@/lib/utils";
import { EmptyState } from "@/components/shared/empty-state";
import {
  DataTable,
  type DataTableColumn,
} from "@/components/shared/data-table";
import { usePageParam } from "@/components/shared/use-page-param";
import { ProductionRunActions } from "./production-run-actions";

interface Props {
  runs: ProductionRunWithDetail[];
  clients: { id: string; name: string }[];
  /** Total que cumple el filtro, no las que llegaron a esta página. */
  total: number;
  page: number;
  totalPages: number;
  pageSize: number;
  isFiltered?: boolean;
}

export function ProductionRunList({
  runs,
  clients,
  total,
  page,
  totalPages,
  pageSize,
  isFiltered,
}: Props) {
  const { onPageChange, onLoadMore } = usePageParam();

  const columns: DataTableColumn<ProductionRunWithDetail>[] = [
    {
      accessorKey: "code",
      header: "Código",
      cell: ({ row }) => (
        <span className="tabular font-medium">{row.original.code}</span>
      ),
    },
    { accessorKey: "name", header: "Nombre" },
    {
      accessorKey: "clientName",
      header: "Cliente",
      cell: ({ row }) => (
        <span className="text-muted-foreground">{row.original.clientName}</span>
      ),
    },
    {
      accessorKey: "status",
      header: "Estado",
      cell: ({ row }) => (
        <span
          className={cn(
            "rounded px-1.5 py-0.5 text-xs",
            PRODUCTION_RUN_STATUS_STYLES[row.original.status],
          )}
        >
          {PRODUCTION_RUN_STATUS_LABELS[row.original.status]}
        </span>
      ),
    },
    {
      accessorKey: "startDate",
      header: "Inicio",
      cell: ({ row }) => (
        <span className="tabular text-muted-foreground">
          {formatDate(row.original.startDate)}
        </span>
      ),
    },
    {
      accessorKey: "lotCount",
      header: "Rollos",
      cell: ({ row }) => (
        <span className="tabular">{row.original.lotCount}</span>
      ),
    },
    {
      id: "acciones",
      header: "",
      enableSorting: false,
      cell: ({ row }) => (
        <div className="text-right">
          <ProductionRunActions run={row.original} clients={clients} />
        </div>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-3">
      <DataTable
        columns={columns}
        data={runs}
        server={{
          page,
          totalPages,
          total,
          pageSize,
          onPageChange,
          onLoadMore: () => onLoadMore(page),
        }}
        itemLabel={{ one: "producción", many: "producciones" }}
        getRowId={(run) => run.id}
        emptyState={
          <div className="flat-surface">
            <EmptyState
              icon={Factory}
              title={isFiltered ? "Sin resultados" : "Aún no hay producciones"}
              description={
                isFiltered
                  ? "Prueba con otro código, nombre o cliente."
                  : "Crea la primera corrida de producción."
              }
            />
          </div>
        }
        renderMobileRow={(run) => (
          <div className="flat-surface flex items-start gap-3 p-3">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="tabular text-sm font-medium">{run.code}</span>
                <span
                  className={cn(
                    "rounded px-1.5 py-0.5 text-xs",
                    PRODUCTION_RUN_STATUS_STYLES[run.status],
                  )}
                >
                  {PRODUCTION_RUN_STATUS_LABELS[run.status]}
                </span>
              </div>
              <p className="truncate text-sm">{run.name}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {run.clientName} · <span className="tabular">{run.lotCount}</span>{" "}
                {run.lotCount === 1 ? "rollo" : "rollos"}
              </p>
            </div>

            <ProductionRunActions run={run} clients={clients} />
          </div>
        )}
      />
    </div>
  );
}
