import Link from "next/link";
import { Pencil } from "lucide-react";
import { GarmentPhoto } from "./garment-photo";
import { GarmentFormDialog } from "./garment-form-dialog";
import { Button } from "@/components/ui/button";

export interface GarmentCard {
  id: string;
  name: string;
  reference: string | null;
  notes: string | null;
  photoId: string | null;
  placementCount: number;
}

interface Props {
  folderId: string;
  garments: GarmentCard[];
  /** Sin permiso de catálogo se mira, no se edita. */
  canWrite: boolean;
}

/**
 * Las prendas de una carpeta, como un tablero de fotos.
 *
 * Cuadrícula y no lista porque la pregunta que trae aquí a alguien es "cuál de
 * estas chamarras es", y esa se contesta mirando, no leyendo: tres nombres que
 * empiezan igual —"Chamarra Tenaris", "Chamarra Tenaris Shawcor"— se
 * distinguen antes por la prenda que por el texto.
 *
 * Dos columnas en celular: una sola dejaría la foto enorme y obligaría a
 * deslizar por cada prenda, y con tres no se ve de qué es cada una.
 */
export function GarmentGrid({ folderId, garments, canWrite }: Props) {
  return (
    <ul className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
      {garments.map((garment) => (
        <li key={garment.id} className="flat-surface flex flex-col">
          <Link href={`/garments/${garment.id}`} className="block">
            <GarmentPhoto
              photoId={garment.photoId}
              alt={garment.name}
              className="aspect-square w-full"
            />
          </Link>

          <div className="flex flex-1 flex-col gap-1 p-2">
            <Link
              href={`/garments/${garment.id}`}
              className="text-sm font-medium leading-tight"
            >
              {garment.name}
            </Link>

            {garment.reference && (
              <p className="tabular truncate text-xs text-muted-foreground">
                {garment.reference}
              </p>
            )}

            <p className="mt-auto pt-1 text-xs text-muted-foreground">
              {garment.placementCount === 0
                ? "Sin marcados"
                : `${garment.placementCount} ${
                    garment.placementCount === 1 ? "marcado" : "marcados"
                  }`}
            </p>
          </div>

          {canWrite && (
            <GarmentFormDialog
              folderId={folderId}
              garment={{
                id: garment.id,
                name: garment.name,
                reference: garment.reference,
                notes: garment.notes,
                photoId: garment.photoId,
              }}
              trigger={
                <Button
                  variant="ghost"
                  className="touch-target w-full justify-start border-t border-border text-xs text-muted-foreground"
                >
                  <Pencil className="size-3.5" aria-hidden />
                  Editar
                </Button>
              }
            />
          )}
        </li>
      ))}
    </ul>
  );
}
