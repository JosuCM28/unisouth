import { Pencil, Trash2 } from "lucide-react";
import { GarmentPhoto } from "./garment-photo";
import { PhotoViewer } from "./photo-viewer";
import { PlacementFormDialog } from "./placement-form-dialog";
import { GarmentDeleteButton } from "./garment-delete-button";
import { Button } from "@/components/ui/button";

export interface PlacementRow {
  id: string;
  name: string;
  notes: string | null;
  photoId: string | null;
}

interface Props {
  garmentId: string;
  placements: PlacementRow[];
  canWrite: boolean;
}

/**
 * Dónde va cada bordado o serigrafía de esta prenda.
 *
 * Es la pantalla por la que existe todo el módulo: el taller la abre con el
 * teléfono en la mano, delante de la prenda, y compara. Por eso la foto va a la
 * izquierda y se puede tocar para verla completa —en una miniatura no se
 * distingue a qué altura del pecho va el logo— y por eso las notas se pintan
 * enteras y no recortadas: "a 12 cm del cuello" es el dato, no un detalle.
 *
 * Se conserva el orden guardado, que es el que alguien puso: es el orden en el
 * que se bordan.
 */
export function PlacementList({ garmentId, placements, canWrite }: Props) {
  if (placements.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Todavía no hay marcados. Agrega el primero —“Manga izquierda bordado”—
        aunque la foto llegue después.
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-2">
      {placements.map((placement) => (
        <li key={placement.id} className="flat-surface flex gap-3 p-2">
          <PhotoViewer photoId={placement.photoId} title={placement.name}>
            <GarmentPhoto
              photoId={placement.photoId}
              alt={placement.name}
              className="size-20 shrink-0"
              emptyLabel="Sin foto"
            />
          </PhotoViewer>

          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <p className="text-sm font-medium leading-tight">
              {placement.name}
            </p>

            {placement.notes && (
              <p className="whitespace-pre-wrap text-xs text-muted-foreground">
                {placement.notes}
              </p>
            )}

            {canWrite && (
              <div className="mt-auto flex items-center gap-1 pt-1">
                <PlacementFormDialog
                  garmentId={garmentId}
                  placement={placement}
                  trigger={
                    <Button
                      variant="ghost"
                      size="sm"
                      className="touch-target text-xs text-muted-foreground"
                    >
                      <Pencil className="size-3.5" aria-hidden />
                      Editar
                    </Button>
                  }
                />

                <GarmentDeleteButton
                  target="placement"
                  id={placement.id}
                  name={placement.name}
                  warning={
                    placement.photoId
                      ? "Su foto se borra con él y no se puede recuperar."
                      : undefined
                  }
                  trigger={
                    <Button
                      variant="ghost"
                      size="sm"
                      className="touch-target text-xs text-muted-foreground"
                    >
                      <Trash2 className="size-3.5" aria-hidden />
                      Quitar
                    </Button>
                  }
                />
              </div>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}
