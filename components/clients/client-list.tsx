"use client";

import { Users } from "lucide-react";
import type { ClientWithLotCount } from "@/lib/repositories/client.repository";
import { EmptyState } from "@/components/shared/empty-state";
import {
  DataTable,
  type DataTableColumn,
} from "@/components/shared/data-table";
import { usePageParam } from "@/components/shared/use-page-param";
import { Badge } from "@/components/ui/badge";
import { ClientActions } from "./client-actions";

interface Props {
  clients: ClientWithLotCount[];
  /** Total que cumple el filtro, no los que llegaron a esta página. */
  total: number;
  page: number;
  totalPages: number;
  pageSize: number;
  isFiltered?: boolean;
}

export function ClientList({
  clients,
  total,
  page,
  totalPages,
  pageSize,
  isFiltered,
}: Props) {
  const { onPageChange, onLoadMore } = usePageParam();

  const columns: DataTableColumn<ClientWithLotCount>[] = [
    {
      accessorKey: "name",
      header: "Nombre",
      cell: ({ row }) => (
        <div className="flex items-center gap-2 font-medium">
          {row.original.name}
          {!row.original.active && (
            <Badge variant="secondary" className="text-xs">
              Inactivo
            </Badge>
          )}
        </div>
      ),
    },
    {
      accessorKey: "code",
      header: "Código",
      cell: ({ row }) => (
        <span className="tabular text-muted-foreground">
          {row.original.code ?? "—"}
        </span>
      ),
    },
    {
      accessorKey: "contact",
      header: "Contacto",
      cell: ({ row }) => (
        <span className="text-muted-foreground">
          {row.original.contact ?? "—"}
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
          <ClientActions client={row.original} />
        </div>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-3">
      <DataTable
        columns={columns}
        data={clients}
        server={{
          page,
          totalPages,
          total,
          pageSize,
          onPageChange,
          onLoadMore: () => onLoadMore(page),
        }}
        itemLabel={{ one: "cliente", many: "clientes" }}
        getRowId={(client) => client.id}
        emptyState={
          <div className="flat-surface">
            <EmptyState
              icon={Users}
              title={isFiltered ? "Sin resultados" : "Aún no hay clientes"}
              description={
                isFiltered
                  ? "Prueba con otro nombre o código."
                  : "Da de alta al primer cliente dueño de material."
              }
            />
          </div>
        }
        renderMobileRow={(client) => (
          <div className="flat-surface flex items-start gap-3 p-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="truncate font-medium">{client.name}</span>
                {!client.active && (
                  <Badge variant="secondary" className="text-xs">
                    Inactivo
                  </Badge>
                )}
              </div>
              {client.contact && (
                <p className="truncate text-sm text-muted-foreground">
                  {client.contact}
                </p>
              )}
              <p className="mt-1 text-xs text-muted-foreground">
                <span className="tabular">{client.lotCount}</span>{" "}
                {client.lotCount === 1 ? "rollo" : "rollos"} en bodega
              </p>
            </div>

            <ClientActions client={client} />
          </div>
        )}
      />
    </div>
  );
}
