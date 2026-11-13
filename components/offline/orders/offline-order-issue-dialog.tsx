"use client";

import { useState } from "react";
import { PackageMinus } from "lucide-react";
import type { OfflineOrder } from "@/lib/offline/snapshot.types";
import { ResponsiveFormDialog } from "@/components/shared/responsive-form-dialog";
import { OfflineIssueForm } from "@/components/offline/issue/offline-issue-form";
import { Button } from "@/components/ui/button";

/**
 * Salida de tela para UNA orden, sin internet.
 *
 * Es la misma salida sin conexión de siempre —se aplica al subir y vuelve a
 * revisar el saldo de cada rollo con la fila bloqueada—, sólo que abre con el
 * cliente dueño de la orden y queda ligada a ella.
 */
export function OfflineOrderIssueDialog({ order }: { order: OfflineOrder }) {
  const [open, setOpen] = useState(false);

  return (
    <ResponsiveFormDialog
      open={open}
      onOpenChange={setOpen}
      wide
      title={`Salida de tela · ${order.code}`}
      description="Se aplica al momento si hay señal; si no, en cuanto vuelva el internet."
      trigger={
        <Button type="button" variant="outline" className="touch-target">
          <PackageMinus className="size-4" aria-hidden />
          Salida de tela
        </Button>
      }
    >
      {/* Se monta sólo abierto: así cada salida arranca limpia, con el
          cliente de la orden, y no con lo que quedó de la anterior. */}
      {open && (
        <OfflineIssueForm
          order={{ id: order.id, clientId: order.clientId }}
          onClose={() => setOpen(false)}
        />
      )}
    </ResponsiveFormDialog>
  );
}
