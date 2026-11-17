"use client";

import { Trash2 } from "lucide-react";
import type { DraftRow } from "@/lib/packing/packing-list-draft";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
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
}

/**
 * Los renglones del packing list, celda por celda. Tabla desde `md:`;
 * en el celular, una tarjeta por renglón con las mismas etiquetas.
 */
export function PackingListEditorRows({ rows, onChange, readOnly }: RowsProps) {
  function update(key: string, field: TextField, value: string) {
    onChange(rows.map((row) => (row.key === key ? { ...row, [field]: value } : row)));
  }

  function remove(key: string) {
    onChange(rows.filter((row) => row.key !== key));
  }

  return (
    <>
      <ul className="flex flex-col gap-2 md:hidden">
        {rows.map((row, index) => (
          <li key={row.key} className="flat-surface flex flex-col gap-2 p-3">
            <div className="flex items-center justify-between">
              <span className="tabular text-xs text-muted-foreground">Renglón {index + 1}</span>
              {!readOnly && <RemoveButton onClick={() => remove(row.key)} />}
            </div>
            <div className="grid grid-cols-2 gap-2">
              {FIELDS.map((spec) => (
                <label key={spec.field} className={cn("flex flex-col gap-1", spec.field === "description" && "col-span-2")}>
                  <span className="text-xs text-muted-foreground">{spec.label}</span>
                  <CellInput row={row} spec={spec} readOnly={readOnly} onChange={update} />
                </label>
              ))}
            </div>
          </li>
        ))}
      </ul>

      <div className="flat-surface hidden overflow-x-auto md:block">
        <Table>
          <TableHeader>
            <TableRow>
              {FIELDS.map((spec) => (
                <TableHead key={spec.field} className={cn(spec.width, spec.align === "right" && "text-right")}>
                  {spec.label}
                </TableHead>
              ))}
              {!readOnly && <TableHead className="w-12"><span className="sr-only">Quitar</span></TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.key}>
                {FIELDS.map((spec) => (
                  <TableCell key={spec.field} className="p-1">
                    <CellInput row={row} spec={spec} readOnly={readOnly} onChange={update} />
                  </TableCell>
                ))}
                {!readOnly && (
                  <TableCell className="p-1">
                    <RemoveButton onClick={() => remove(row.key)} />
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  );
}

function CellInput({
  row,
  spec,
  readOnly,
  onChange,
}: {
  row: DraftRow;
  spec: FieldSpec;
  readOnly: boolean;
  onChange: (key: string, field: TextField, value: string) => void;
}) {
  const numeric = spec.inputMode === "numeric";
  return (
    <Input
      value={row[spec.field]}
      onChange={(event) => onChange(row.key, spec.field, event.target.value)}
      readOnly={readOnly}
      inputMode={spec.inputMode}
      aria-label={spec.label}
      className={cn("touch-target", numeric ? "tabular" : "uppercase", spec.align === "right" && "text-right")}
    />
  );
}

function RemoveButton({ onClick }: { onClick: () => void }) {
  return (
    <Button type="button" variant="ghost" size="icon" className="touch-target" aria-label="Quitar renglón" onClick={onClick}>
      <Trash2 className="size-4" aria-hidden />
    </Button>
  );
}
