"use client";

import { Plus, Trash2 } from "lucide-react";
import { sumBundlePieces, sumBundles } from "@/lib/bundles";
import { SearchSelect } from "@/components/shared/search-select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/** Una talla que se puede elegir en un renglón. */
export interface SizeRowOption {
  /** Lo que el formulario manda: el id de la talla o el del renglón. */
  value: string;
  code: string;
  /** Segunda línea del desplegable: el nombre largo, el grupo. */
  hint?: string;
  /** Texto extra por el que también se busca sin enseñarlo. */
  keywords?: string;
}

/** Un renglón a medio teclear. */
export interface SizeBundleRow {
  /** Identidad local: un renglón nuevo no tiene id de base todavía. */
  key: string;
  value: string;
  /** Texto, no número: el input vive a medio teclear. */
  quantity: string;
  bundles: string;
}

interface Props {
  options: SizeRowOption[];
  rows: SizeBundleRow[];
  onChange: (rows: SizeBundleRow[]) => void;
  /** Qué se está contando: "Piezas de este corte", "Piezas que van". */
  label: string;
  /** Lo que se sabe de la talla elegida: cuánto lleva, cuánto falta. */
  renderHint?: (value: string) => React.ReactNode;
  /** Nota al pie del bloque. */
  footnote?: React.ReactNode;
}

/** Un renglón vacío, listo para teclear. */
export function emptyRow(): SizeBundleRow {
  return { key: crypto.randomUUID(), value: "", quantity: "", bundles: "1" };
}

/**
 * Los renglones ya tecleados que valen algo, en números.
 *
 * Un renglón sin talla o sin cantidad se descarta en silencio: es la tarjeta
 * que se agregó y no se llenó, y exigir que la borren antes de guardar sería
 * pedirles trabajo para decir "nada".
 *
 * El bulto en blanco cuenta como UNO. El campo llega con 1 puesto, así que
 * vaciarlo sólo puede querer decir "uno", y descartar el renglón entero por eso
 * lo haría desaparecer del total sin avisar.
 */
export function usableRows(rows: SizeBundleRow[]) {
  return rows
    .map((row) => ({
      value: row.value,
      quantity: Number(row.quantity),
      bundles: row.bundles.trim() === "" ? 1 : Number(row.bundles),
    }))
    .filter(
      (row) =>
        row.value !== "" &&
        Number.isFinite(row.quantity) &&
        row.quantity !== 0 &&
        Number.isInteger(row.bundles) &&
        row.bundles > 0,
    );
}

/**
 * La captura por BULTOS: un renglón por bulto, con su talla y su cuenta.
 *
 * Reproduce la plantilla de papel que ya se llena en la mesa. Lo que la hoja
 * fija permite y una lista de "un número por talla" no: **repetir la talla**.
 * De la 43 salen un bulto de 30 y otro de 20, y eso son dos renglones porque
 * el bulto no lleva la misma cantidad. Meterlos en un solo número obligaba a
 * sumarlos a mano y el desglose se perdía antes de llegar al vale.
 *
 * La cantidad es POR BULTO, igual que en la tabla de corte de la salida: "3
 * bultos de 60" son 180 prendas. Al lado de cada renglón se pinta ese total
 * calculado, porque el error de leer 60 donde van 180 no revienta nada —nadie
 * se entera hasta el conteo.
 */
export function SizeBundleRows({
  options,
  rows,
  onChange,
  label,
  renderHint,
  footnote,
}: Props) {
  function updateRow(key: string, patch: Partial<SizeBundleRow>) {
    onChange(rows.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  }

  function removeRow(key: string) {
    const next = rows.filter((row) => row.key !== key);
    // Nunca se queda sin renglones: una tarjeta vacía es la invitación a
    // capturar, y un bloque vacío obliga a buscar el botón antes de teclear.
    onChange(next.length > 0 ? next : [emptyRow()]);
  }

  /* NO se filtran las tallas ya usadas: repetirlas es justo el caso que este
     control existe para permitir. */
  const selectOptions = options.map((option) => ({
    value: option.value,
    label: option.code,
    hint: option.hint,
    keywords: option.keywords,
  }));

  const usable = usableRows(rows);
  const pieces = sumBundlePieces(usable);
  const bundles = sumBundles(usable);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <Label>{label}</Label>
        {usable.length > 0 && (
          <span className="tabular text-sm text-muted-foreground">
            {pieces} {pieces === 1 ? "pza" : "pzas"} · {bundles}{" "}
            {bundles === 1 ? "bulto" : "bultos"}
          </span>
        )}
      </div>

      {/* Tarjeta por renglón en los dos tamaños: el diálogo es angosto incluso
          en escritorio y una tabla de cuatro columnas ahí dentro se barre de
          lado con el teléfono en una mano. */}
      <ul className="flex max-h-[50vh] flex-col gap-2 overflow-y-auto">
        {rows.map((row) => {
          const quantity = Number(row.quantity) || 0;
          const count = row.bundles.trim() === "" ? 1 : Number(row.bundles) || 0;
          const total = quantity * count;

          return (
            <li key={row.key} className="flat-surface flex flex-col gap-2 p-2">
              <div className="flex items-center gap-2">
                <div className="min-w-0 flex-1">
                  <SearchSelect
                    options={selectOptions}
                    value={row.value}
                    onChange={(value) => updateRow(row.key, { value })}
                    placeholder="Talla"
                    searchPlaceholder="Buscar talla…"
                  />
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="touch-target shrink-0"
                  onClick={() => removeRow(row.key)}
                  aria-label="Quitar renglón"
                >
                  <Trash2 className="size-4" aria-hidden />
                </Button>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <label className="flex flex-col gap-1">
                  <span className="text-xs text-muted-foreground">
                    Piezas por bulto
                  </span>
                  <Input
                    inputMode="numeric"
                    placeholder="0"
                    value={row.quantity}
                    onChange={(event) =>
                      updateRow(row.key, { quantity: event.target.value })
                    }
                    className="tabular touch-target text-right"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-xs text-muted-foreground">Bultos</span>
                  <Input
                    inputMode="numeric"
                    placeholder="1"
                    value={row.bundles}
                    onChange={(event) =>
                      updateRow(row.key, { bundles: event.target.value })
                    }
                    className="tabular touch-target text-right"
                  />
                </label>
              </div>

              {/* El total del renglón sólo aparece cuando hay más de un bulto:
                  con uno solo repetiría la cifra de arriba y ensuciaría la
                  tarjeta con un dato que ya se está leyendo. */}
              <p className="tabular text-xs text-muted-foreground">
                {count > 1 && <span className="font-medium">= {total} pzas</span>}
                {count > 1 && row.value && " · "}
                {row.value && renderHint?.(row.value)}
              </p>
            </li>
          );
        })}
      </ul>

      <Button
        type="button"
        variant="outline"
        className="touch-target"
        onClick={() => onChange([...rows, emptyRow()])}
      >
        <Plus className="size-4" aria-hidden />
        Agregar talla
      </Button>

      {footnote && (
        <p className="text-xs text-muted-foreground">{footnote}</p>
      )}
    </div>
  );
}
