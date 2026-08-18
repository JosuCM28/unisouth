"use client";

import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/** Tamaños de página que se ofrecen. */
const PAGE_SIZES = [10, 25, 50, 100] as const;

interface Props {
  page: number;
  totalPages: number;
  total: number;
  pageSize: number;
  itemLabel: { one: string; many: string };
  onPageChange: (page: number) => void;
  /** Sin esto no se ofrece cambiar el tamaño de página. */
  onPageSizeChange?: (size: number) => void;
  className?: string;
}

/**
 * Paginador de tabla: rango, números de página y filas por página.
 *
 * Los NÚMEROS son el punto: con sólo "anterior/siguiente" llegar a la página 6
 * son cinco clics y no hay forma de saber en cuál se está sin leer el texto.
 * Aquí se salta directo y la página actual se ve de un vistazo.
 *
 * Se declara el rango ("1 a 10 de 65") además del número de página porque
 * quien busca un registro necesita saber si ya pasó por él.
 */
export function TablePagination({
  page,
  totalPages,
  total,
  pageSize,
  itemLabel,
  onPageChange,
  onPageSizeChange,
  className,
}: Props) {
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  const hasPrevious = page > 1;
  const hasNext = page < totalPages;

  return (
    <div
      className={cn(
        "flex flex-col gap-3 border-t border-border pt-3",
        "sm:flex-row sm:items-center sm:justify-between",
        className,
      )}
    >
      <p className="tabular text-xs text-muted-foreground">
        Mostrando <span className="font-medium text-foreground">{from}</span> a{" "}
        <span className="font-medium text-foreground">{to}</span> de{" "}
        <span className="font-medium text-foreground">{total}</span>{" "}
        {total === 1 ? itemLabel.one : itemLabel.many}
      </p>

      <div className="flex items-center gap-1.5">
        <PageButton
          label="Primera página"
          icon={ChevronsLeft}
          disabled={!hasPrevious}
          onClick={() => onPageChange(1)}
        />
        <PageButton
          label="Página anterior"
          icon={ChevronLeft}
          disabled={!hasPrevious}
          onClick={() => onPageChange(page - 1)}
        />

        {/* Los números: en pantallas angostas se reducen a "Página X de Y",
            que ocupa una fracción del ancho y dice lo mismo. */}
        <div className="hidden items-center gap-1 lg:flex">
          {buildPageList(page, totalPages).map((entry, index) =>
            entry === "gap" ? (
              <span
                key={`gap-${index}`}
                className="px-1 text-xs text-muted-foreground"
                aria-hidden
              >
                …
              </span>
            ) : (
              <Button
                key={entry}
                type="button"
                variant={entry === page ? "default" : "outline"}
                className="tabular touch-target min-w-11 px-2"
                aria-current={entry === page ? "page" : undefined}
                aria-label={`Página ${entry}`}
                onClick={() => onPageChange(entry)}
              >
                {entry}
              </Button>
            ),
          )}
        </div>

        <span className="tabular px-2 text-xs text-muted-foreground lg:hidden">
          Página {page} de {totalPages}
        </span>

        <PageButton
          label="Página siguiente"
          icon={ChevronRight}
          disabled={!hasNext}
          onClick={() => onPageChange(page + 1)}
        />
        <PageButton
          label="Última página"
          icon={ChevronsRight}
          disabled={!hasNext}
          onClick={() => onPageChange(totalPages)}
        />

        {onPageSizeChange && (
          <Select
            value={String(pageSize)}
            onValueChange={(value) => onPageSizeChange(Number(value))}
          >
            <SelectTrigger
              className="tabular touch-target ml-1 w-28"
              aria-label="Filas por página"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PAGE_SIZES.map((size) => (
                <SelectItem key={size} value={String(size)}>
                  {size} filas
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>
    </div>
  );
}

/**
 * Qué números se pintan: siempre la primera, la última y las vecinas.
 *
 * Con 40 páginas no caben todas, y una lista que se desborda es peor que
 * ninguna. Se conservan los extremos —"ir al final" es una intención real— y
 * una ventana alrededor de la actual, con puntos suspensivos en los saltos.
 */
function buildPageList(page: number, totalPages: number): (number | "gap")[] {
  // Hasta siete caben sin recortar y es más cómodo verlas todas.
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  const pages = new Set<number>([1, totalPages, page]);
  if (page - 1 > 1) pages.add(page - 1);
  if (page + 1 < totalPages) pages.add(page + 1);

  // Cerca de un extremo se alarga la ventana de ese lado: si no, el paginador
  // cambia de ancho al moverse y los botones bailan bajo el dedo.
  if (page <= 3) [2, 3, 4].forEach((n) => n < totalPages && pages.add(n));
  if (page >= totalPages - 2) {
    [totalPages - 1, totalPages - 2, totalPages - 3].forEach(
      (n) => n > 1 && pages.add(n),
    );
  }

  const sorted = [...pages].sort((a, b) => a - b);
  const result: (number | "gap")[] = [];

  for (const [index, value] of sorted.entries()) {
    const previous = sorted[index - 1];
    if (previous !== undefined && value - previous > 1) result.push("gap");
    result.push(value);
  }

  return result;
}

function PageButton({
  label,
  icon: Icon,
  disabled,
  onClick,
}: {
  label: string;
  icon: typeof ChevronLeft;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      className={cn("touch-target", disabled && "opacity-40")}
      disabled={disabled}
      onClick={onClick}
      aria-label={label}
      title={label}
    >
      <Icon className="size-4" aria-hidden />
    </Button>
  );
}
