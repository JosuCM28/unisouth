"use client";

import { Pencil } from "lucide-react";
import type { ProductionRun } from "@prisma/client";
import { cancelProductionRunAction } from "@/app/actions/production-run.actions";
import { RowActions } from "@/components/shared/row-actions";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { ProductionRunFormDialog } from "./production-run-form-dialog";

interface Props {
  run: ProductionRun;
  clients: { id: string; name: string }[];
}

export function ProductionRunActions({ run, clients }: Props) {
  return (
    <RowActions
      label={run.code}
      editItem={
        <ProductionRunFormDialog
          run={run}
          clients={clients}
          trigger={
            <DropdownMenuItem onSelect={(event) => event.preventDefault()}>
              <Pencil className="size-4" aria-hidden />
              Editar
            </DropdownMenuItem>
          }
        />
      }
      removeTitle={`¿Cancelar ${run.code}?`}
      removeDescription="La producción pasará a cancelada. No se borra: su consumo histórico se conserva. Si todavía tiene rollos asignados, no se podrá cancelar."
      onRemove={() =>
        cancelProductionRunAction({
          id: run.id,
          reason: `Cancelación de la producción ${run.code}`,
        })
      }
    />
  );
}
