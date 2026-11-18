"use client";

import { Trash2 } from "lucide-react";
import type { DraftRow } from "@/lib/packing/packing-list-draft";
import { cn, formatQuantity } from "@/lib/utils";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type TextField = "orderRef" | "destination" | "description" | "color" | "boxNumber" | "size" | "quantity";

interface FieldSpec {
  field: TextField;
  label: string;
  /** Ancho de la columna en escritorio. */
  width: string;
  inputMode?: "numeric";
  align?: "right";
}

/** Las columnas de la hoja de papel, en su orden. */
const FIELDS: FieldSpec[] = [
  { field: "orderRef", label: "Orden", width: "w-28" },
  { field: "destination", label: "Destino", width: "w-32" },
  { field: "description", label: "Descripción", width: "min-w-56" },
  { field: "color", label: "Color", width: "w-28" },
  { field: "boxNumber", label: "Caja", width: "w-20", inputMode: "numeric" },
  { field: "size", label: "Talla", width: "w-20" },
  { field: "quantity", label: "Cantidad", width: "w-24", inputMode: "numeric", align: "right" },
];

interface RowsProps {
  rows: DraftRow[];
  onChange: (rows: DraftRow[]) => void;
  readOnly: boolean;
  /** Renglón → lo que de verdad lleva su caja en su talla. Sólo los que no cuadran. */
  mismatches: Map<string, number>;
  pieces: number;
}

/**
 * Los renglones del packing list, celda por celda. Tabla desde `md:`;
 * en el celular, una tarjeta por renglón con las mismas etiquetas.
 */
export function PackingListEditorRows({ rows, onChange, readOnly, mismatches, pieces }: RowsProps) {
  function update(key: string, field: TextField, value: string) {
    onChange(rows.map((row) => (row.key === key ? { ...row, [field]: value } : row)));
  }

  function remove(key: string) {
    onChange(rows.filter((row) => row.key !== key));
  }

  if (rows.length === 0) {
    return (
      <p className="flat-surface p-6 text-center text-sm text-muted-foreground">
        Sin renglones. Agrega uno o vuelve a llenar desde las cajas.
      </p>
    );
  }

  return (
    <>
      <ul className="flex flex-col gap-2 md:hidden">
        {rows.map((row, index) => (
          <li key={row.key}
            className={cn("flat-surface flex flex-col gap-2 p-3", mismatches.has(row.key) && "border-state-reserved")}>
            <div className="flex items-center justify-between">
              <span className="tabular text-xs text-muted-foreground">Renglón {index + 1}</span>
              {!readOnly && <RemoveButton row={row} onConfirm={() => remove(row.key)} />}
            </div>
            <div className="grid grid-cols-2 gap-2">
              {FIELDS.map((spec) => (
                <label key={spec.field} className={cn("flex flex-col gap-1", spec.field === "description" && "col-span-2")}>
                  <span className="text-xs text-muted-foreground">{spec.label}</span>
                  <CellInput row={row} spec={spec} readOnly={readOnly} onChange={update}
                    flagged={spec.field === "quantity" && mismatches.has(row.key)} />
                </label>
              ))}
            </div>
            <MismatchHint row={row} actual={mismatches.get(row.key)} />
          </li>
        ))}
        <li className="tabular flex justify-between border border-border bg-muted px-3 py-2 text-sm font-medium">
          <span>Total</span>
          <span>{formatQuantity(pieces)} pzas</span>
        </li>
      </ul>

      <div className="flat-surface hidden overflow-x-auto md:block">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted hover:bg-muted">
              {FIELDS.map((spec) => (
                <TableHead key={spec.field}
                  className={cn(spec.width, "text-xs uppercase tracking-wide", spec.align === "right" && "text-right")}>
                  {spec.label}
                </TableHead>
              ))}
              {!readOnly && <TableHead className="w-12"><span className="sr-only">Quitar</span></TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => {
              const actual = mismatches.get(row.key);
              return (
                <TableRow key={row.key} className={cn(actual !== undefined && "bg-state-reserved-muted hover:bg-state-reserved-muted")}>
                  {FIELDS.map((spec) => (
                    <TableCell key={spec.field} className="p-1 align-top">
                      <CellInput row={row} spec={spec} readOnly={readOnly} onChange={update}
                        flagged={spec.field === "quantity" && actual !== undefined} />
                      {spec.field === "quantity" && <MismatchHint row={row} actual={actual} compact />}
                    </TableCell>
                  ))}
                  {!readOnly && (
                    <TableCell className="p-1 align-top">
                      <RemoveButton row={row} onConfirm={() => remove(row.key)} />
                    </TableCell>
                  )}
                </TableRow>
              );
            })}
          </TableBody>
          <TableFooter>
            <TableRow className="hover:bg-transparent">
              <TableCell colSpan={FIELDS.length - 1} className="text-right text-xs uppercase tracking-wide text-muted-foreground">
                Total
              </TableCell>
              <TableCell className="tabular px-3 text-right font-semibold">{formatQuantity(pieces)}</TableCell>
              {!readOnly && <TableCell />}
            </TableRow>
          </TableFooter>
        </Table>
      </div>
    </>
  );
}

/** "La caja 1 lleva 2 de CH": lo que de verdad hay, para que el error se vea en su renglón. */
function MismatchHint({ row, actual, compact = false }: { row: DraftRow; actual: number | undefined; compact?: boolean }) {
  if (actual === undefined) return null;
  const box = Number.parseInt(row.boxNumber, 10);
  const size = row.size.trim().toUpperCase();
  const text = actual === 0 ? `La caja ${box} no lleva ${size}` : `La caja ${box} lleva ${formatQuantity(actual)} de ${size}`;
  return (
    <p className={cn("tabular text-xs font-medium text-foreground", compact ? "px-1 pt-1 text-right" : "")}>
      {text}
    </p>
  );
}

function CellInput({
  row,
  spec,
  readOnly,
  onChange,
  flagged,
}: {
  row: DraftRow;
  spec: FieldSpec;
  readOnly: boolean;
  onChange: (key: string, field: TextField, value: string) => void;
  flagged: boolean;
}) {
  const numeric = spec.inputMode === "numeric";
  return (
    <Input
      value={row[spec.field]}
      onChange={(event) => onChange(row.key, spec.field, event.target.value)}
      readOnly={readOnly}
      inputMode={spec.inputMode}
      aria-label={spec.label}
      aria-invalid={flagged || undefined}
      className={cn(
        "touch-target bg-background",
        numeric ? "tabular" : "uppercase",
        spec.align === "right" && "text-right",
        flagged && "border-state-reserved font-semibold",
      )}
    />
  );
}

function RemoveButton({ row, onConfirm }: { row: DraftRow; onConfirm: () => void }) {
  const what = [row.description, row.size, row.boxNumber && `caja ${row.boxNumber}`].filter(Boolean).join(" · ");
  return (
    <ConfirmDialog
      title="¿Quitar este renglón?"
      description={
        <>
          {what && <span className="mb-2 block font-medium text-foreground">{what}</span>}
          Sale sólo de la hoja: la caja y el inventario no cambian. Hasta que guardes, puedes descartar los cambios.
        </>
      }
      confirmLabel="Quitar renglón"
      tone="destructive"
      onConfirm={onConfirm}
      trigger={
        <Button type="button" variant="ghost" size="icon" className="touch-target text-muted-foreground hover:text-destructive"
          aria-label="Quitar renglón">
          <Trash2 className="size-4" aria-hidden />
        </Button>
      }
    />
  );
}
