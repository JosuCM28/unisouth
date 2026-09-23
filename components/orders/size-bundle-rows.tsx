"use client";

import { Plus, Trash2 } from "lucide-react";
import { sumBundlePieces, sumBundles } from "@/lib/bundles";
import { SearchSelect } from "@/components/shared/search-select";
import { SizeNote, type SizeAnnotation } from "@/components/orders/size-note";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/** Una talla que se puede elegir en un renglón. */
export interface SizeRowOption extends SizeAnnotation {
  /** Lo que el formulario manda: el id de la talla o el del renglón. */
  value: string;
  code: string;
  /** Segunda línea del desplegable: el nombre largo, el grupo. */
  hint?: string;
  /** Texto extra por el que también se busca sin enseñarlo. */
  keywords?: string;
  /**
   * El foleo que se pone en el renglón al elegir esta talla.
   *
   * Lo manda el envío a taller: ahí la talla se elige a mano y sin esto el
   * bulto salía sin el color que ya se le había amarrado en el corte.
   * Ausente = elegir la talla no toca el foleo del renglón.
   */
  defaultTagId?: string | null;
}

/** Un renglón a medio teclear. */
export interface SizeBundleRow {
  /** Identidad local: un renglón nuevo no tiene id de base todavía. */
  key: string;
  value: string;
  /** Texto, no número: el input vive a medio teclear. */
  quantity: string;
  bundles: string;
  /** El foleo de ESTE bulto. Cadena vacía = sin foleo. */
  tagId: string;
  /**
   * La anotación que viaja con ESTE bulto al vale.
   *
   * Sólo la usan los bloques con `editableNotes`: la captura del corte la lee
   * de la orden y no la guarda. Cadena vacía = sin anotación.
   */
  note: string;
}

/** Un foleo del catálogo, como se ofrece en el renglón. */
export interface CutTagChoice {
  id: string;
  name: string;
  color: string;
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
  /**
   * Los foleos que se pueden amarrar a un bulto.
   *
   * Ausente = el bloque no pregunta por color. Lo pide la captura de corte,
   * que es donde el papelito se amarra de verdad; el envío a taller manda lo
   * que ya trae capturado y no vuelve a elegirlo.
   */
  tags?: CutTagChoice[];
  /**
   * La anotación de la talla se vuelve un campo editable del renglón.
   *
   * Lo pide el envío a taller: la anotación que se escribió al levantar la
   * orden tiene que salir en el vale que firma el taller, llega copiada tal
   * cual y quien manda la corrige ahí si ese envío lleva otra instrucción. En
   * la captura del corte se queda como texto de sólo lectura.
   */
  editableNotes?: boolean;
}

/** Un renglón vacío, listo para teclear. */
export function emptyRow(tagId = ""): SizeBundleRow {
  return {
    key: crypto.randomUUID(),
    value: "",
    quantity: "",
    bundles: "1",
    tagId,
    note: "",
  };
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
      // Vacío se manda como `undefined`: en la base es "sin foleo", no una
      // cadena vacía que después nadie sabe si es un color sin nombre.
      tagId: row.tagId === "" ? undefined : row.tagId,
      // Igual que el foleo: vacía no se guarda como cadena vacía.
      note: row.note.trim() === "" ? undefined : row.note.trim(),
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
 * Lo que cambia en el renglón al elegirle talla.
 *
 * La anotación y el foleo de la talla nueva REEMPLAZAN a los que había: son
 * de la talla, y dejar los de la 38 sobre un bulto que ahora es de la 42
 * mandaría al taller la instrucción y el color equivocados.
 */
function selectSize(
  value: string,
  byValue: Map<string, SizeRowOption>,
  editableNotes: boolean,
): Partial<SizeBundleRow> {
  const option = byValue.get(value);
  const patch: Partial<SizeBundleRow> = { value };

  if (editableNotes) patch.note = option?.note ?? "";
  if (option?.defaultTagId !== undefined) {
    patch.tagId = option.defaultTagId ?? "";
  }

  return patch;
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
  tags,
  editableNotes = false,
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

  // La anotación del renglón elegido, para pintarla dentro de su tarjeta.
  const byValue = new Map(options.map((option) => [option.value, option]));
  const tagById = new Map((tags ?? []).map((tag) => [tag.id, tag]));

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
          const option = byValue.get(row.value);

          return (
            <li key={row.key} className="flat-surface flex flex-col gap-2 p-2">
              <div className="flex items-center gap-2">
                <div className="min-w-0 flex-1">
                  <SearchSelect
                    options={selectOptions}
                    value={row.value}
                    onChange={(value) =>
                      updateRow(row.key, selectSize(value, byValue, editableNotes))
                    }
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

              {/* Lo que se le anotó a esta talla al levantar la orden, pegado
                  a su renglón: es la instrucción que hay que tener enfrente
                  justo antes de teclear cuántas salieron. */}
              <SizeNote
                note={editableNotes ? null : option?.note}
                tag={option?.tag}
              />

              {editableNotes && (
                <label className="flex flex-col gap-1">
                  <span className="text-xs text-muted-foreground">
                    Anotación
                  </span>
                  <Input
                    placeholder="Sin anotación"
                    value={row.note}
                    onChange={(event) =>
                      updateRow(row.key, { note: event.target.value })
                    }
                    className="touch-target"
                  />
                </label>
              )}

              {/* El foleo va ARRIBA de las cantidades y no al lado: en el
                  celular una tercera columna dejaba los tres campos
                  demasiado angostos para teclear con el pulgar, y el color
                  se elige una vez mientras los números se corrigen varias. */}
              {tags && (
                <div className="flex items-center gap-2">
                  <div className="min-w-0 flex-1">
                    <SearchSelect
                      options={tags.map((tag) => ({
                        value: tag.id,
                        label: tag.name,
                      }))}
                      value={row.tagId}
                      onChange={(value) =>
                        updateRow(row.key, { tagId: value })
                      }
                      placeholder="Sin foleo"
                      searchPlaceholder="Buscar color…"
                      clearLabel="Sin foleo"
                    />
                  </div>
                  {/* El cuadrito del color al lado del nombre: el papelito se
                      reconoce por el color, no por leer "Naranja". */}
                  {tagById.get(row.tagId) && (
                    <span
                      className="size-6 shrink-0 border border-border"
                      style={{
                        backgroundColor: tagById.get(row.tagId)?.color,
                      }}
                      aria-hidden
                    />
                  )}
                </div>
              )}

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
