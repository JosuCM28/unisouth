"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Ban, Check, Printer, Send, Truck } from "lucide-react";
import { toast } from "sonner";
import type { PurchaseRequestStatus } from "@prisma/client";
import {
  approvePurchaseRequestAction,
  markOrderedAction,
  markReceivedAction,
  rejectPurchaseRequestAction,
  submitPurchaseRequestAction,
} from "@/app/actions/purchase-request.actions";
import { ResponsiveFormDialog } from "@/components/shared/responsive-form-dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface Props {
  id: string;
  code: string;
  status: PurchaseRequestStatus;
  /** Si el usuario puede autorizar. Ocultar el botón es comodidad: la
   *  barrera real es el permiso que exige la action en el servidor. */
  canApprove: boolean;
}

export function PurchaseActions({ id, code, status, canApprove }: Props) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [reason, setReason] = useState("");

  async function run(
    action: () => Promise<{ success: boolean; error?: string; message?: string }>,
  ) {
    setPending(true);
    const result = await action();
    setPending(false);

    if (!result.success) {
      toast.error(result.error ?? "No se pudo completar la operación");
      return;
    }

    toast.success(result.message ?? "Listo");
    router.refresh();
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Button asChild variant="outline" className="touch-target">
        <a href={`/print/purchase-request/${id}`} target="_blank" rel="noopener">
          <Printer className="size-4" aria-hidden />
          Imprimir
        </a>
      </Button>

      {status === "DRAFT" && (
        <Button
          type="button"
          disabled={pending}
          className="touch-target"
          onClick={() => run(() => submitPurchaseRequestAction({ id }))}
        >
          <Send className="size-4" aria-hidden />
          Enviar a autorización
        </Button>
      )}

      {/* Sólo Compras o un administrador ven estos botones. */}
      {status === "SUBMITTED" && canApprove && (
        <>
          <Button
            type="button"
            disabled={pending}
            className="touch-target"
            onClick={() => run(() => approvePurchaseRequestAction({ id }))}
          >
            <Check className="size-4" aria-hidden />
            Autorizar
          </Button>

          <ResponsiveFormDialog
            open={rejectOpen}
            onOpenChange={setRejectOpen}
            title={`Rechazar ${code}`}
            description="El motivo se le muestra a quien la levantó."
            trigger={
              <Button variant="outline" className="touch-target">
                <Ban className="size-4" aria-hidden />
                Rechazar
              </Button>
            }
          >
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="reject-reason">Motivo del rechazo</Label>
                <Textarea
                  id="reject-reason"
                  rows={3}
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  placeholder="Ya hay material suficiente en bodega"
                />
              </div>

              <Button
                type="button"
                disabled={pending || !reason.trim()}
                className="h-12 w-full bg-destructive text-white hover:bg-destructive/90"
                onClick={async () => {
                  await run(() =>
                    rejectPurchaseRequestAction({ id, reason: reason.trim() }),
                  );
                  setRejectOpen(false);
                  setReason("");
                }}
              >
                Confirmar rechazo
              </Button>
            </div>
          </ResponsiveFormDialog>
        </>
      )}

      {status === "APPROVED" && canApprove && (
        <Button
          type="button"
          disabled={pending}
          className="touch-target"
          onClick={() => run(() => markOrderedAction({ id }))}
        >
          <Truck className="size-4" aria-hidden />
          Marcar como pedida
        </Button>
      )}

      {(status === "ORDERED" || status === "PARTIALLY_RECEIVED") && canApprove && (
        <Button
          type="button"
          disabled={pending}
          className="touch-target"
          onClick={() => run(() => markReceivedAction({ id }))}
        >
          <Check className="size-4" aria-hidden />
          Marcar como recibida
        </Button>
      )}
    </div>
  );
}
