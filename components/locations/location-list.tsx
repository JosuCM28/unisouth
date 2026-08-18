"use client";

import { MapPin } from "lucide-react";
import type { Location } from "@prisma/client";
import { LOCATION_TYPE_LABELS } from "@/lib/constants/labels";
import type { LocationWithLotCount } from "@/lib/repositories/location.repository";
import { EmptyState } from "@/components/shared/empty-state";
import {
  DataTable,
  type DataTableColumn,
} from "@/components/shared/data-table";
import { usePageParam } from "@/components/shared/use-page-param";
import { Badge } from "@/components/ui/badge";
import { LocationActions } from "./location-actions";

interface LocationListProps {
  locations: LocationWithLotCount[];
  parents: Pick<Location, "id" | "code" | "name">[];
  warehouses: { id: string; code: string; name: string }[];
  /** Total que cumple el filtro, no las que llegaron a esta página. */
  total: number;
  page: number;
  totalPages: number;
  pageSize: number;
  /** Para distinguir "no hay nada" de "la búsqueda no encontró nada". */
  isFiltered?: boolean;
}

export function LocationList({
  locations,
  parents,
  warehouses,
  total,
  page,
  totalPages,
  pageSize,
  isFiltered,
}: LocationListProps) {
  const { onPageChange, onLoadMore, onPageSizeChange } = usePageParam();

  const columns: DataTableColumn<LocationWithLotCount>[] = [
    {
      accessorKey: "code",
      header: "Código",
      cell: ({ row }) => (
        <div className="tabular flex items-center gap-2 font-medium">
          {row.original.code}
          {!row.original.active && (
            <Badge variant="secondary" className="text-xs">
              Inactiva
            </Badge>
          )}
        </div>
      ),
    },
    { accessorKey: "name", header: "Nombre" },
    {
      accessorKey: "type",
      header: "Tipo",
      cell: ({ row }) => (
        <span className="text-muted-foreground">
          {LOCATION_TYPE_LABELS[row.original.type]}
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
          <LocationActions
            location={row.original}
            parents={parents}
            warehouses={warehouses}
          />
        </div>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-3">
      <DataTable
        columns={columns}
        data={locations}
        server={{
          page,
          totalPages,
          total,
          pageSize,
          onPageChange,
          onLoadMore: () => onLoadMore(page),
          onPageSizeChange,
        }}
        itemLabel={{ one: "ubicación", many: "ubicaciones" }}
        getRowId={(location) => location.id}
        emptyState={
          <div className="flat-surface">
            <EmptyState
              icon={MapPin}
              title={isFiltered ? "Sin resultados" : "Aún no hay ubicaciones"}
              description={
                isFiltered
                  ? "Prueba con otro código o nombre."
                  : "Da de alta la primera fila o rack de la bodega."
              }
            />
          </div>
        }
        // En celular, tarjetas: una tabla obligaría a barrer de lado para leer
        // una fila, con el teléfono en una mano.
        renderMobileRow={(location) => (
          <div className="flat-surface flex items-start gap-3 p-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="tabular font-medium">{location.code}</span>
                {!location.active && (
                  <Badge variant="secondary" className="text-xs">
                    Inactiva
                  </Badge>
                )}
              </div>
              <p className="truncate text-sm text-muted-foreground">
                {location.name}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {LOCATION_TYPE_LABELS[location.type]} ·{" "}
                <span className="tabular">{location.lotCount}</span>{" "}
                {location.lotCount === 1 ? "rollo" : "rollos"}
              </p>
            </div>

            <LocationActions
              location={location}
              parents={parents}
              warehouses={warehouses}
            />
          </div>
        )}
      />
    </div>
  );
}
