"use client";

import Link from "next/link";
import { AlertTriangle, Package } from "lucide-react";
import type { Material } from "@prisma/client";
import {
  MATERIAL_TYPE_LABELS,
  UNIT_SHORT_LABELS,
} from "@/lib/constants/labels";
import { formatFabricSpec } from "@/lib/material-spec";
import { cn, formatQuantity, type PlainObject } from "@/lib/utils";
import { EmptyState } from "@/components/shared/empty-state";
import {
  DataTable,
  type DataTableColumn,
} from "@/components/shared/data-table";
import { usePageParam } from "@/components/shared/use-page-param";
import { Badge } from "@/components/ui/badge";
import { MaterialActions } from "./material-actions";

/** Material con los Decimal ya convertidos: es lo que puede cruzar al cliente. */
type PlainMaterial = PlainObject<Material>;

interface MaterialListProps {
  materials: PlainMaterial[];
  /** Existencia disponible por material, resuelta con groupBy en la base. */
  stock: Map<string, number>;
  /** Total que cumple el filtro, no los que llegaron a esta página. */
  total: number;
  page: number;
  totalPages: number;
  pageSize: number;
  isFiltered?: boolean;
}

export function MaterialList({
  materials,
  stock,
  total,
  page,
  totalPages,
  pageSize,
  isFiltered,
}: MaterialListProps) {
  const { onPageChange, onLoadMore, onPageSizeChange } = usePageParam();

  const columns: DataTableColumn<PlainMaterial>[] = [
    {
      accessorKey: "code",
      header: "Código",
      /* El código lleva al inventario filtrado por este material: ver la pila
         es lo que más se hace desde el catálogo, y obligaba a ir a Inventario
         y volver a elegir la clave en el filtro. */
      cell: ({ row }) => (
        <div className="tabular flex items-center gap-2 font-medium">
          <Link
            href={`/lots?materialId=${row.original.id}`}
            className="hover:underline"
          >
            {row.original.code}
          </Link>
          {!row.original.active && (
            <Badge variant="secondary" className="text-xs">
              Inactivo
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
          {MATERIAL_TYPE_LABELS[row.original.type]}
        </span>
      ),
    },
    {
      id: "especificacion",
      header: "Especif.",
      enableSorting: false,
      cell: ({ row }) => (
        <span className="tabular text-muted-foreground">
          {formatFabricSpec(row.original) ?? "—"}
        </span>
      ),
    },
    {
      id: "existencia",
      header: "Existencia",
      // Ordena por el número real, no por el texto formateado: si no,
      // "1,000" quedaría antes que "9".
      accessorFn: (material) => stock.get(material.id) ?? 0,
      cell: ({ row }) => {
        const available = stock.get(row.original.id) ?? 0;
        const isLow = isBelowReorder(row.original, available);

        return (
          <div className="flex items-center justify-end gap-1.5">
            {isLow && (
              <AlertTriangle
                className="size-3.5 text-state-reserved"
                aria-label="Bajo el punto de reorden"
              />
            )}
            <span
              className={cn(
                "tabular",
                isLow && "font-medium text-state-reserved",
              )}
            >
              {formatQuantity(available, {
                unit: UNIT_SHORT_LABELS[row.original.baseUnit],
              })}
            </span>
          </div>
        );
      },
    },
    {
      id: "acciones",
      header: "",
      enableSorting: false,
      cell: ({ row }) => (
        <div className="text-right">
          <MaterialActions material={row.original} />
        </div>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-3">
      <DataTable
        columns={columns}
        data={materials}
        server={{
          page,
          totalPages,
          total,
          pageSize,
          onPageChange,
          onLoadMore: () => onLoadMore(page),
          onPageSizeChange,
        }}
        itemLabel={{ one: "material", many: "materiales" }}
        getRowId={(material) => material.id}
        emptyState={
          <div className="flat-surface">
            <EmptyState
              icon={Package}
              title={isFiltered ? "Sin resultados" : "Aún no hay materiales"}
              description={
                isFiltered
                  ? "Prueba con otro código, nombre o color."
                  : "Da de alta la primera tela o insumo."
              }
            />
          </div>
        }
        renderMobileRow={(material) => {
          const available = stock.get(material.id) ?? 0;
          const isLow = isBelowReorder(material, available);

          return (
            <div className="flat-surface flex items-start gap-3 p-3">
              {/* Toda la tarjeta lleva a la pila: en el piso se toca con el
                  pulgar, y obligar a atinarle al menú de tres puntos para ver
                  los rollos de una clave es un toque de más cada vez. */}
              <Link
                href={`/lots?materialId=${material.id}`}
                className="min-w-0 flex-1"
              >
                <div className="flex items-center gap-2">
                  <span className="tabular text-sm font-medium">
                    {material.code}
                  </span>
                  {!material.active && (
                    <Badge variant="secondary" className="text-xs">
                      Inactivo
                    </Badge>
                  )}
                </div>

                <p className="truncate text-sm">{material.name}</p>

                <p className="mt-1 text-xs text-muted-foreground">
                  {MATERIAL_TYPE_LABELS[material.type]}
                  <MaterialSpec material={material} />
                </p>

                <StockLine
                  available={available}
                  unit={UNIT_SHORT_LABELS[material.baseUnit]}
                  isLow={isLow}
                  reorderPoint={Number(material.reorderPoint)}
                />
              </Link>

              <MaterialActions material={material} />
            </div>
          );
        }}
        />
    </div>
  );
}

/** El grosor se muestra en la unidad que esté capturada: oz o mm. */
function MaterialSpec({ material }: { material: PlainMaterial }) {
  const spec = formatFabricSpec(material);
  if (!spec) return null;

  return (
    <>
      {" · "}
      <span className="tabular">{spec}</span>
    </>
  );
}

function StockLine({
  available,
  unit,
  isLow,
  reorderPoint,
}: {
  available: number;
  unit: string;
  isLow: boolean;
  reorderPoint: number;
}) {
  return (
    <div className="mt-1.5 flex items-center gap-1.5">
      {isLow && (
        <AlertTriangle
          className="size-3.5 shrink-0 text-state-reserved"
          aria-hidden
        />
      )}
      <span
        className={cn(
          "tabular text-sm",
          isLow ? "font-medium text-state-reserved" : "text-muted-foreground",
        )}
      >
        {formatQuantity(available, { unit })}
      </span>
      {isLow && (
        <span className="text-xs text-muted-foreground">
          (reorden{" "}
          <span className="tabular">{formatQuantity(reorderPoint)}</span>)
        </span>
      )}
    </div>
  );
}

/**
 * Bajo el punto de reorden = hay que comprar.
 *
 * Un punto de reorden en cero significa "no se controla", no "siempre falta":
 * sin esa guarda, todo material sin configurar saldría en rojo.
 */
function isBelowReorder(material: PlainMaterial, available: number): boolean {
  const reorderPoint = Number(material.reorderPoint);
  if (reorderPoint <= 0) return false;
  return available < reorderPoint;
}
