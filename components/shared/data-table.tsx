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
import {
  ArrowDown,
  ArrowUp,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ChevronsUpDown,
} from "lucide-react";
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

/**
 * Paginación servida por la BASE DE DATOS.
 *
 * La tabla no reparte estas filas: ya vienen recortadas. TanStack entra en
 * `manualPagination` para seguir gobernando el estado —qué página es, cuántas
 * hay— sin volver a cortar un bloque que ya viene cortado.
 */
export interface ServerPagination {
  page: number;
  totalPages: number;
  /** Total que cumple el filtro, no las filas de esta página. */
  total: number;
  pageSize: number;
  /** Navega a la página pedida. En la práctica, cambia la URL. */
  onPageChange: (page: number) => void;
  /**
   * "Cargar más" del celular: pide la siguiente página ACUMULANDO.
   *
   * Va aparte de `onPageChange` porque el servidor no sabe qué ancho tiene la
   * pantalla: el modo acumulado se pide explícitamente desde la URL, y así el
   * escritorio sigue trayendo una sola página aunque compartan el enlace.
   */
  onLoadMore?: () => void;
}

interface DataTableProps<TData> {
  columns: DataTableColumn<TData>[];
  data: TData[];
  /** Cómo se pinta cada fila en celular. Sin esto, no se muestra nada ahí. */
  renderMobileRow: (row: TData) => ReactNode;
  emptyState: ReactNode;
  /**
   * Filas por página EN EL NAVEGADOR.
   *
   * Sólo para listas cortas que llegan completas. Con `server` presente se
   * ignora: mandan los datos de la base.
   */
  pageSize?: number;
  /** Presente = la página la sirve Postgres, no el navegador. */
  server?: ServerPagination;
  /** Sustantivo para los contadores ("rollo"/"rollos"). */
  itemLabel?: { one: string; many: string };
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
  server,
  itemLabel = { one: "registro", many: "registros" },
  getRowId,
}: DataTableProps<TData>) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 1 });

  /**
   * ¿Reparte esta tabla las filas en el navegador?
   *
   * Con `server` NO: llegaron ya recortadas por Postgres. Volver a cortarlas
   * aquí es justo lo que escondía registros —el navegador sólo puede repartir
   * lo que ya recibió, y el resto no se alcanzaba por ninguna página.
   */
  const paginatesInMemory = !server && pageSize > 0;

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
    // En modo servidor TanStack sigue llevando el estado de la página —para
    // que los controles y el orden salgan de un solo lugar— pero no recorta:
    // eso ya lo hizo la consulta.
    manualPagination: Boolean(server),
    ...(server ? { rowCount: server.total } : {}),
    state: {
      sorting,
      ...(server
        ? {
            pagination: {
              pageIndex: server.page - 1,
              pageSize: server.pageSize,
            },
          }
        : paginatesInMemory
          ? { pagination }
          : {}),
    },
    // Sin esto, v9 arranca en descendente para columnas numéricas: el
    // usuario pica "Cantidad" esperando ver lo más chico primero y ve lo
    // más grande, con la flecha diciendo "ascendente".
    sortDescFirst: false,
    onSortingChange: setSorting,
    onPaginationChange: setPagination,
    ...(getRowId ? { getRowId } : {}),
  });

  const rows = paginatesInMemory
    ? table.getPaginatedRowModel().rows
    : table.getSortedRowModel().rows;

  if (data.length === 0) return <>{emptyState}</>;

  /* En celular `data` YA viene acumulada desde el servidor: al pedir la
     página 3 llegan las filas de la 1 a la 3. El acumulado NO puede vivir en
     estado del cliente porque cada "cargar más" es una navegación y remonta
     el componente, borrando cualquier `useState`. */
  const mobileRows = server
    ? data
    : rows.map((row) => row.original as TData);
  const hasMore = server ? server.page < server.totalPages : false;

  return (
    <div className="flex flex-col gap-3">
      {/* ── Celular: tarjetas ── */}
      <ul className="flex flex-col gap-2 md:hidden">
        {mobileRows.map((item, index) => (
          <li key={getRowId?.(item) ?? index}>{renderMobileRow(item)}</li>
        ))}
      </ul>

      {/* Avance de una mano: un botón ancho al final en vez de flechitas.
          Se apunta con el pulgar sin mirar, que es como se usa en el piso. */}
      {server && (
        <div className="flex flex-col gap-2 md:hidden">
          {hasMore ? (
            <Button
              type="button"
              variant="outline"
              className="touch-target h-12 w-full"
              onClick={() =>
                server.onLoadMore
                  ? server.onLoadMore()
                  : server.onPageChange(server.page + 1)
              }
            >
              Cargar más
            </Button>
          ) : (
            mobileRows.length > 0 && (
              <p className="tabular py-2 text-center text-xs text-muted-foreground">
                No hay más {itemLabel.many}.
              </p>
            )
          )}

          <p className="tabular text-center text-xs text-muted-foreground">
            {mobileRows.length} de {server.total}{" "}
            {server.total === 1 ? itemLabel.one : itemLabel.many}
          </p>
        </div>
      )}

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

      {/* Escritorio: el paginador completo, con "primera" y "última". En
          celular se esconde porque ahí manda el botón de "cargar más". */}
      {server && server.totalPages > 1 && (
        <div className="hidden md:block">
          <Pagination
            page={server.page}
            pageCount={server.totalPages}
            total={server.total}
            from={(server.page - 1) * server.pageSize + 1}
            to={Math.min(server.page * server.pageSize, server.total)}
            canPrevious={server.page > 1}
            canNext={server.page < server.totalPages}
            onFirst={() => server.onPageChange(1)}
            onPrevious={() => server.onPageChange(server.page - 1)}
            onNext={() => server.onPageChange(server.page + 1)}
            onLast={() => server.onPageChange(server.totalPages)}
          />
        </div>
      )}

      {paginatesInMemory && table.getPageCount() > 1 && (
        <Pagination
          page={pagination.pageIndex + 1}
          pageCount={table.getPageCount()}
          total={data.length}
          from={pagination.pageIndex * pagination.pageSize + 1}
          to={Math.min(
            (pagination.pageIndex + 1) * pagination.pageSize,
            data.length,
          )}
          canPrevious={table.getCanPreviousPage()}
          canNext={table.getCanNextPage()}
          onFirst={() => table.setPageIndex(0)}
          onPrevious={() => table.previousPage()}
          onNext={() => table.nextPage()}
          onLast={() => table.setPageIndex(table.getPageCount() - 1)}
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

/**
 * Controles de paginación.
 *
 * Lleva "primera" y "última" además de anterior/siguiente: con 10 páginas,
 * llegar al final picando "Siguiente" nueve veces es inaceptable, y en
 * celular todavía peor.
 *
 * Se declara el rango visible ("26–50 de 120") y no sólo el número de
 * página: quien busca un registro necesita saber si ya pasó por él.
 */
function Pagination({
  page,
  pageCount,
  total,
  from,
  to,
  canPrevious,
  canNext,
  onFirst,
  onPrevious,
  onNext,
  onLast,
}: {
  page: number;
  pageCount: number;
  total: number;
  from: number;
  to: number;
  canPrevious: boolean;
  canNext: boolean;
  onFirst: () => void;
  onPrevious: () => void;
  onNext: () => void;
  onLast: () => void;
}) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <p className="tabular text-xs text-muted-foreground">
        {from}–{to} de {total} {total === 1 ? "registro" : "registros"} · Página{" "}
        {page} de {pageCount}
      </p>

      <div className="flex gap-2">
        <PageButton
          label="Primera"
          onClick={onFirst}
          disabled={!canPrevious}
          icon={ChevronsLeft}
          iconOnly
        />
        <PageButton
          label="Anterior"
          onClick={onPrevious}
          disabled={!canPrevious}
          icon={ChevronLeft}
        />
        <PageButton
          label="Siguiente"
          onClick={onNext}
          disabled={!canNext}
          icon={ChevronRight}
          trailingIcon
        />
        <PageButton
          label="Última"
          onClick={onLast}
          disabled={!canNext}
          icon={ChevronsRight}
          iconOnly
        />
      </div>
    </div>
  );
}

function PageButton({
  label,
  onClick,
  disabled,
  icon: Icon,
  iconOnly,
  trailingIcon,
}: {
  label: string;
  onClick: () => void;
  disabled: boolean;
  icon: typeof ChevronLeft;
  /** Sólo el icono: "primera" y "última" no necesitan texto y ahorran ancho. */
  iconOnly?: boolean;
  trailingIcon?: boolean;
}) {
  return (
    <Button
      type="button"
      variant="outline"
      className={cn("touch-target", disabled && "opacity-50")}
      disabled={disabled}
      onClick={onClick}
      aria-label={label}
      title={label}
    >
      {!trailingIcon && <Icon className="size-4" aria-hidden />}
      {!iconOnly && <span className="hidden sm:inline">{label}</span>}
      {trailingIcon && <Icon className="size-4" aria-hidden />}
    </Button>
  );
}
