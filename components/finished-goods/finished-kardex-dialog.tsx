"use client";

import { useState } from "react";
import { History } from "lucide-react";
import { toast } from "sonner";
import { finishedMovementsAction } from "@/app/actions/finished-goods.actions";
import { FINISHED_MOVEMENT_TYPE_LABELS } from "@/lib/constants/labels";
import type { FinishedMovementRow } from "@/lib/repositories/finished-goods.repository";
import { runAction } from "@/lib/offline/run-action";
import { formatDateTime, formatQuantity } from "@/lib/utils";
import { ResponsiveFormDialog } from "@/components/shared/responsive-form-dialog";
import { Button } from "@/components/ui/button";

/**
 * El kárdex de UN renglón: de dónde salió cada pieza. Se pide al abrir, no
 * con la lista: casi nadie lo abre, y bajarlo para cada renglón sería
 * cargar cientos de movimientos para enseñar una tabla.
 */
export function FinishedKardexDialog({ stockId, title }: { stockId: string; title: string }) {
  const [open, setOpen] = useState(false);
  const [movements, setMovements] = useState<FinishedMovementRow[] | null>(null);

  async function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next || movements) return;

    const result = await runAction(() => finishedMovementsAction({ stockId }));
    if (!result.success) {
      toast.error(result.error);
      return;
    }
    setMovements(result.data);
  }

  return (
    <ResponsiveFormDialog
      open={open}
      onOpenChange={handleOpenChange}
      title="Kárdex"
      description={title}
      trigger={
        <Button variant="ghost" size="icon" className="touch-target" aria-label={`Kárdex de ${title}`}>
          <History className="size-4" aria-hidden />
        </Button>
      }
    >
      {movements === null && <p className="text-sm text-muted-foreground">Cargando…</p>}
      {movements?.length === 0 && <p className="text-sm text-muted-foreground">Sin movimientos.</p>}
      {movements && movements.length > 0 && (
        <ul className="flex flex-col">
          {movements.map((movement) => (
            <li key={movement.id} className="flex flex-col gap-0.5 border-b border-border py-2 last:border-0">
              <span className="flex justify-between gap-3 text-sm">
                <span>{FINISHED_MOVEMENT_TYPE_LABELS[movement.type]}</span>
                <span className="tabular font-medium">
                  {movement.quantity > 0 ? "+" : ""}{formatQuantity(movement.quantity)}
                </span>
              </span>
              <span className="tabular text-xs text-muted-foreground">
                {formatDateTime(movement.createdAt)}
                {movement.user && ` · ${movement.user.name}`}
              </span>
              {movement.workshopOutput && (
                <span className="tabular text-xs">
                  {movement.workshopOutput.code} · {movement.workshopOutput.workshop.name} · orden{" "}
                  {movement.workshopOutput.order.reference ?? movement.workshopOutput.order.code}
                </span>
              )}
              {movement.reason && <span className="text-xs">{movement.reason}</span>}
            </li>
          ))}
        </ul>
      )}
    </ResponsiveFormDialog>
  );
}
