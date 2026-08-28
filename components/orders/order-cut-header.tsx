"use client";

import { Plus, Trash2 } from "lucide-react";
import type { CutVersion } from "@prisma/client";
import { CUT_VERSION_LABELS } from "@/lib/constants/labels";
import { FormSelectField } from "@/components/shared/form-field";
import { SearchSelect } from "@/components/shared/search-select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/** El encabezado del corte tal como se captura en la orden. */
export interface OrderCutHeaderDraft {
  cutFabricText: string;
  cutPattern: string;
  cutVersion: string;
  cutVersionNotes: string;
  /** Notas del pie, en el orden en que se imprimen numeradas. */
  cutNotes: string[];
}

/** Encabezado en blanco: el estado inicial de una orden nueva. */
export const EMPTY_ORDER_CUT_HEADER: OrderCutHeaderDraft = {
  cutFabricText: "",
  cutPattern: "",
  cutVersion: "",
  cutVersionNotes: "",
  cutNotes: [],
};

const VERSION_OPTIONS = (Object.keys(CUT_VERSION_LABELS) as CutVersion[]).map(
  (version) => ({ value: version, label: CUT_VERSION_LABELS[version] }),
);

interface Props {
  value: OrderCutHeaderDraft;
  onChange: (value: OrderCutHeaderDraft) => void;
}

/**
 * El encabezado de la hoja de corte, capturado desde la ORDEN.
 *
 * Es el mismo bloque que imprime el vale de salida, y se llena aquí porque es
 * aquí donde se sabe: quien toma el pedido conoce el molde y la versión, y el
 * auxiliar que llena el vale no. Al mandar la orden a salidas estos datos
 * viajan con ella, así que el vale sale escrito y no en blanco.
 *
 * La descripción y la tela del catálogo NO están en este bloque: ya son la
 * `Descripción` y el `Material` de la orden, arriba. Repetirlas aquí abriría
 * la puerta a que la orden y su vale digan prendas distintas.
 */
export function OrderCutHeader({ value, onChange }: Props) {
  function patch(changes: Partial<OrderCutHeaderDraft>) {
    onChange({ ...value, ...changes });
  }

  function addNote() {
    patch({ cutNotes: [...value.cutNotes, ""] });
  }

  function updateNote(index: number, text: string) {
    patch({
      cutNotes: value.cutNotes.map((note, position) =>
        position === index ? text : note,
      ),
    });
  }

  function removeNote(index: number) {
    patch({
      cutNotes: value.cutNotes.filter((_, position) => position !== index),
    });
  }

  return (
    <div className="flex flex-col gap-4">
      {/* La tela a mano existe porque el pedido no puede esperar a que alguien
          dé de alta el material: se apunta el nombre y se sigue. */}
      <div className="flex flex-col gap-2">
        <Label htmlFor="order-cut-fabric-text">Tela (escrita a mano)</Label>
        <Input
          id="order-cut-fabric-text"
          placeholder="Sólo si no está en el catálogo"
          value={value.cutFabricText}
          onChange={(event) => patch({ cutFabricText: event.target.value })}
          className="touch-target"
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="order-cut-pattern">Molde</Label>
          <Input
            id="order-cut-pattern"
            placeholder="Opcional"
            value={value.cutPattern}
            onChange={(event) => patch({ cutPattern: event.target.value })}
            className="touch-target"
          />
        </div>

        <FormSelectField id="order-cut-version" label="Versión">
          <SearchSelect
            id="order-cut-version"
            options={VERSION_OPTIONS}
            value={value.cutVersion}
            onChange={(version) => patch({ cutVersion: version })}
            placeholder="Sin versión"
            searchPlaceholder="Buscar versión…"
            clearLabel="Sin versión"
          />
        </FormSelectField>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="order-cut-version-notes">
          Descripción de la versión
        </Label>
        <Input
          id="order-cut-version-notes"
          placeholder="Qué cambia respecto a la anterior"
          value={value.cutVersionNotes}
          onChange={(event) => patch({ cutVersionNotes: event.target.value })}
          className="touch-target"
        />
      </div>

      {/* Las notas se capturan como LISTA y no como un párrafo: en la hoja se
          imprimen numeradas y en el taller se van palomeando una por una. */}
      <div className="flex flex-col gap-2">
        <Label>Notas del corte</Label>

        {value.cutNotes.length === 0 && (
          <p className="text-xs text-muted-foreground">
            Sin notas. Ej. &ldquo;va sin serigrafiar&rdquo;.
          </p>
        )}

        <ol className="flex flex-col gap-2">
          {value.cutNotes.map((note, index) => (
            <li key={index} className="flex items-center gap-2">
              <span className="tabular w-6 shrink-0 text-sm text-muted-foreground">
                {index + 1}.
              </span>
              <Input
                value={note}
                onChange={(event) => updateNote(index, event.target.value)}
                placeholder="Va sin serigrafiar"
                className="touch-target"
                aria-label={`Nota ${index + 1}`}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="touch-target shrink-0"
                onClick={() => removeNote(index)}
                aria-label={`Quitar nota ${index + 1}`}
              >
                <Trash2 className="size-4" aria-hidden />
              </Button>
            </li>
          ))}
        </ol>

        <Button
          type="button"
          variant="outline"
          className="touch-target w-fit"
          onClick={addNote}
        >
          <Plus className="size-4" aria-hidden />
          Agregar nota
        </Button>
      </div>
    </div>
  );
}
