"use client";

import { Pencil } from "lucide-react";
import type { Location } from "@prisma/client";
import { removeLocationAction } from "@/app/actions/location.actions";
import { RowActions } from "@/components/shared/row-actions";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { LocationFormDialog } from "./location-form-dialog";

interface LocationActionsProps {
  location: Location;
  parents?: Pick<Location, "id" | "code" | "name">[];
}

export function LocationActions({ location, parents }: LocationActionsProps) {
  return (
    <RowActions
      label={location.code}
      editItem={
        <LocationFormDialog
          location={location}
          parents={parents}
          trigger={
            <DropdownMenuItem onSelect={(event) => event.preventDefault()}>
              <Pencil className="size-4" aria-hidden />
              Editar
            </DropdownMenuItem>
          }
        />
      }
      removeDescription="La ubicación dejará de aparecer en los listados. El historial de los rollos que pasaron por ella se conserva. Si todavía tiene rollos encima, no se podrá dar de baja."
      onRemove={() =>
        removeLocationAction({
          id: location.id,
          reason: `Baja de la ubicación ${location.code}`,
        })
      }
    />
  );
}
