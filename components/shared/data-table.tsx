"use client";

import { useState, type ReactNode } from "react";
import {
  createPaginatedRowModel,
  createSortedRowModel,
  flexRender,
  rowPaginationFeature,
  rowSortingFeature,
  sortFn_alphanumeric,
  sortFn_basic,
  sortFn_datetime,
  sortFn_text,
  tableFeatures,
  useTable,
  type ColumnDef,
  type RowData,
  type SortingState,
} from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

/**
 * Funciones que se activan en las tablas.
 *
 * TanStack v9 obliga a declararlas: lo que no se pide, no se empaqueta. Aquí
 * sólo hacen falta ordenar y paginar —el filtrado ya vive en la URL y lo
 * resuelve el servidor, que es donde están los datos completos.
 */
const tableFeaturesConfig = tableFeatures({
  rowSortingFeature,
  rowPaginationFeature,
  // Los row models y las funciones de orden van AQUÍ en v9: lo que no se
  // registra, no entra al bundle.
  sortedRowModel: createSortedRowModel(),
  paginatedRowModel: createPaginatedRowModel(),
  sortFns: {
    alphanumeric: sortFn_alphanumeric,
    text: sortFn_text,
    datetime: sortFn_datetime,
    basic: sortFn_basic,
  },
});

type Features = typeof tableFeaturesConfig;

/**
 * Definición de columna ya atada a las features de esta tabla.
 *
 * Quien define columnas escribe `DataTableColumn<Material>` y recupera el
 * tipado completo de sus datos.
 */
export type DataTableColumn<TData> = ColumnDef<Features, TData & RowData>;

interface DataTableProps<TData> {
  columns: DataTableColumn<TData>[];
  data: TData[];
  /** Cómo se pinta cada fila en celular. Sin esto, no se muestra nada ahí. */
  renderMobileRow: (row: TData) => ReactNode;
  emptyState: ReactNode;
  /** Filas por página. 0 desactiva la paginación. */
  pageSize?: number;
  getRowId?: (row: TData) => string;
}

/**
 * Tabla de datos sobre TanStack + shadcn.
 *
 * Doble presentación deliberada: tarjetas apiladas en celular y tabla desde
 * `md:`. Una tabla en 375px obliga a barrer de lado para leer una sola fila,
 * con el teléfono en una mano y un rollo en la otra.
 *
 * TanStack gobierna los DATOS —orden, página— y las dos vistas leen del mismo
 * modelo, así que no pueden desincronizarse.
 */
export function DataTable<TData>({
  columns,
  data,
  renderMobileRow,
  emptyState,
  pageSize = 25,
  getRowId,
}: DataTableProps<TData>) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [pagination, setPagination] = useState({
    pageIndex: 0,
    pageSize: pageSize > 0 ? pageSize : data.length || 1,
  });

  /**
   * ÚNICO `any` de la capa de tablas.
   *
   * TanStack v9 tipa `RowData` como `any[] | Record<string, any>`, lo que
   * hace imposible escribir un componente genérico reutilizable sin borrar
   * el tipo en la frontera. Se aísla aquí: las columnas que reciben las
   * pantallas SÍ están tipadas con `DataTableColumn<Material>`, así que la
   * seguridad de tipos se conserva donde importa.
   */
  /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
  const table = useTable<Features, any>({
    features: tableFeaturesConfig,
    columns,
    data,
    state: { sorting, pagination },
    // Sin esto, v9 arranca en descendente para columnas numéricas: el
    // usuario pica "Cantidad" esperando ver lo más chico primero y ve lo
    // más grande, con la flecha diciendo "ascendente".
    sortDescFirst: false,
    onSortingChange: setSorting,
    onPaginationChange: setPagination,
    ...(getRowId ? { getRowId } : {}),
  });

  const rows = table.getPaginatedRowModel().rows;

  if (data.length === 0) return <>{emptyState}</>;

  return (
    <div className="flex flex-col gap-3">
      {/* ── Celular: tarjetas ── */}
      <ul className="flex flex-col gap-2 md:hidden">
        {rows.map((row) => (
          <li key={row.id}>{renderMobileRow(row.original as TData)}</li>
        ))}
      </ul>

      {/* ── Desde md: tabla ── */}
      <div className="hidden md:block">
        <div className="flat-surface overflow-x-auto">
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => {
                    const canSort = header.column.getCanSort();

                    return (
                      <TableHead key={header.id}>
                        {header.isPlaceholder ? null : canSort ? (
                          <button
                            type="button"
                            onClick={header.column.getToggleSortingHandler()}
                            className="flex items-center gap-1.5 transition-colors hover:text-foreground"
                          >
                            {flexRender(
                              header.column.columnDef.header,
                              header.getContext(),
                            )}
                            <SortIcon direction={header.column.getIsSorted()} />
                          </button>
                        ) : (
                          flexRender(
                            header.column.columnDef.header,
                            header.getContext(),
                          )
                        )}
                      </TableHead>
                    );
                  })}
                </TableRow>
              ))}
            </TableHeader>

            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getAllCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      {pageSize > 0 && table.getPageCount() > 1 && (
        <Pagination
          page={pagination.pageIndex + 1}
          pageCount={table.getPageCount()}
          total={data.length}
          canPrevious={table.getCanPreviousPage()}
          canNext={table.getCanNextPage()}
          onPrevious={() => table.previousPage()}
          onNext={() => table.nextPage()}
        />
      )}
    </div>
  );
}

/**
 * Indicador de orden.
 *
 * Con salidas tempranas y no con ternarias anidadas: son tres estados
 * distintos, no dos.
 */
function SortIcon({ direction }: { direction: false | "asc" | "desc" }) {
  if (direction === "asc") {
    return <ArrowUp className="size-3.5 shrink-0" aria-label="Ascendente" />;
  }
  if (direction === "desc") {
    return <ArrowDown className="size-3.5 shrink-0" aria-label="Descendente" />;
  }
  return (
    <ChevronsUpDown className="size-3.5 shrink-0 opacity-40" aria-hidden />
  );
}

function Pagination({
  page,
  pageCount,
  total,
  canPrevious,
  canNext,
  onPrevious,
  onNext,
}: {
  page: number;
  pageCount: number;
  total: number;
  canPrevious: boolean;
  canNext: boolean;
  onPrevious: () => void;
  onNext: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <p className="tabular text-xs text-muted-foreground">
        Página {page} de {pageCount} · {total}{" "}
        {total === 1 ? "registro" : "registros"}
      </p>

      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          className={cn("touch-target", !canPrevious && "opacity-50")}
          disabled={!canPrevious}
          onClick={onPrevious}
        >
          Anterior
        </Button>
        <Button
          type="button"
          variant="outline"
          className={cn("touch-target", !canNext && "opacity-50")}
          disabled={!canNext}
          onClick={onNext}
        >
          Siguiente
        </Button>
      </div>
    </div>
  );
}
