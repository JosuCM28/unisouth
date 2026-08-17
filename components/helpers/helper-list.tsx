"use client";

import { HardHat } from "lucide-react";
import type { HelperWithWork } from "@/lib/repositories/helper.repository";
import { formatQuantity } from "@/lib/utils";
import { EmptyState } from "@/components/shared/empty-state";
import { DataTable, type DataTableColumn } from "@/components/shared/data-table";
import { Badge } from "@/components/ui/badge";
import { HelperActions } from "./helper-actions";

export function HelperList({ helpers }: { helpers: HelperWithWork[] }) {
  const columns: DataTableColumn<HelperWithWork>[] = [
    {
      accessorKey: "name",
      header: "Nombre",
      cell: ({ row }) => (
        <div className="flex items-center gap-2 font-medium">
          {row.original.name}
          {!row.original.active && (
            <Badge variant="secondary" className="text-xs">Inactivo</Badge>
          )}
        </div>
      ),
    },
    {
      accessorKey: "code",
      header: "Código",
      cell: ({ row }) => (
        <span className="tabular text-muted-foreground">{row.original.code ?? "—"}</span>
      ),
    },
    {
      accessorKey: "phone",
      header: "Teléfono",
      cell: ({ row }) => (
        <span className="tabular text-muted-foreground">{row.original.phone ?? "—"}</span>
      ),
    },
    {
      accessorKey: "lotCount",
      header: "Rollos bajados",
      cell: ({ row }) => (
        <span className="tabular font-medium">{row.original.lotCount}</span>
      ),
    },
    {
      accessorKey: "totalQuantity",
      header: "Cantidad total",
      cell: ({ row }) => (
        <span className="tabular text-muted-foreground">
          {formatQuantity(row.original.totalQuantity)}
        </span>
      ),
    },
    {
      id: "acciones",
      header: "",
      enableSorting: false,
      cell: ({ row }) => (
        <div className="text-right"><HelperActions helper={row.original} /></div>
      ),
    },
  ];

  return (
    <DataTable
      columns={columns}
      data={helpers}
      pageSize={25}
      getRowId={(helper) => helper.id}
      emptyState={
        <div className="flat-surface">
          <EmptyState icon={HardHat} title="Aún no hay ayudantes"
            description="Da de alta a quienes descargan el camión, para poder asignarles rollos y bonificarlos." />
        </div>
      }
      renderMobileRow={(helper) => (
        <div className="flat-surface flex items-start gap-3 p-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="truncate font-medium">{helper.name}</span>
              {!helper.active && (
                <Badge variant="secondary" className="text-xs">Inactivo</Badge>
              )}
            </div>
            {helper.code && (
              <p className="tabular text-xs text-muted-foreground">{helper.code}</p>
            )}
            <p className="mt-1 text-sm">
              <span className="tabular font-medium">{helper.lotCount}</span>{" "}
              {helper.lotCount === 1 ? "rollo bajado" : "rollos bajados"}
              {helper.totalQuantity > 0 && (
                <span className="tabular text-muted-foreground">
                  {" · "}{formatQuantity(helper.totalQuantity)}
                </span>
              )}
            </p>
          </div>

          <HelperActions helper={helper} />
        </div>
      )}
    />
  );
}
