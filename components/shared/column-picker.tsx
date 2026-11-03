"use client";

import { Columns3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { ColumnVisibility } from "./use-column-visibility";

interface Props {
  /** Las columnas que se pueden prender y apagar, en el orden de la tabla. */
  columns: { id: string; label: string }[];
  visibility: ColumnVisibility;
  onChange: (columnId: string, visible: boolean) => void;
}

/**
 * Menú para elegir qué columnas se ven.
 *
 * El menú NO se cierra al marcar una casilla: quien acomoda la tabla suele
 * mover tres o cuatro columnas seguidas, y reabrirlo cada vez estorba.
 */
export function ColumnPicker({ columns, visibility, onChange }: Props) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="outline" className="touch-target">
          <Columns3 className="size-4" aria-hidden />
          Columnas
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuLabel>Columnas visibles</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {columns.map((column) => (
          <DropdownMenuCheckboxItem
            key={column.id}
            checked={visibility[column.id] !== false}
            onCheckedChange={(checked) => onChange(column.id, checked === true)}
            onSelect={(event) => event.preventDefault()}
          >
            {column.label}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
