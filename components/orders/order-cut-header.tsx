"use client";

import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/** El encabezado del corte tal como se captura en la orden. */
export interface OrderCutHeaderDraft {
  cutFabricText: string;
  cutPattern: string;
  /** Notas del pie, en el orden en que se imprimen numeradas. */
  cutNotes: string[];
}

/** Encabezado en blanco: el estado inicial de una orden nueva. */
export const EMPTY_ORDER_CUT_HEADER: OrderCutHeaderDraft = {
  cutFabricText: "",
  cutPattern: "",
  cutNotes: [],
};

interface Props {
  value: OrderCutHeaderDraft;
  onChange: (value: OrderCutHeaderDraft) => void;
}

/**
 * Las notas del corte, capturadas desde la ORDEN.
 *
 * El borrador sigue llevando tela a mano y molde porque viajan juntos al
 * vale, pero esos dos se capturan ARRIBA, junto a cliente y descripción: son
 * lo primero que se busca al dar de alta la orden y no deben quedar
 * escondidos en un bloque plegado. Aquí sólo se capturan las notas.
 *
 * Se llenan en la orden porque es aquí donde se saben: quien toma el pedido
 * conoce el molde y las notas, y el auxiliar que llena el vale no. Al mandar
 * la orden a salidas viajan con ella, así que el vale sale escrito.
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
