"use client";

import { useState } from "react";
import { Send } from "lucide-react";
import { ResponsiveFormDialog } from "@/components/shared/responsive-form-dialog";
import { Button } from "@/components/ui/button";
import {
  canDeliver,
  deliverVoucher,
  DeliveryRecipients,
  useDeliverySelection,
  type VoucherDeliveryOptions,
} from "./voucher-delivery";

interface Props {
  documentId: string;
  documentCode: string;
  delivery: VoucherDeliveryOptions;
}

/**
 * Manda otra vez una salida YA aplicada, por los canales prendidos.
 *
 * Para los dos casos que pasan de verdad: el envío falló —celular sin señal,
 * correo caído— o alguien más necesita el vale después de aplicado. No
 * vuelve a aplicar nada: sólo reparte el mismo papel.
 */
export function ResendVoucherDialog({
  documentId,
  documentCode,
  delivery,
}: Props) {
  const [open, setOpen] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const { selected, toggle, total, reset } = useDeliverySelection(delivery);

  function handleOpenChange(next: boolean) {
    if (isSending) return;
    setOpen(next);
    if (next) reset();
  }

  async function handleSend() {
    setIsSending(true);
    await deliverVoucher(documentId, selected);
    setIsSending(false);
    setOpen(false);
  }

  return (
    <ResponsiveFormDialog
      open={open}
      onOpenChange={handleOpenChange}
      title={`Enviar ${documentCode}`}
      description="Elige a quién le llega el vale."
      trigger={
        <Button type="button" variant="outline" className="touch-target">
          <Send className="size-4" aria-hidden />
          Enviar vale
        </Button>
      }
    >
      <div className="flex flex-col gap-4">
        <DeliveryRecipients
          options={delivery}
          selected={selected}
          onToggle={toggle}
        />

        <Button
          type="button"
          onClick={handleSend}
          disabled={!canDeliver(delivery) || isSending || total === 0}
          className="h-12 w-full"
        >
          <Send className="size-4" aria-hidden />
          {isSending ? "Enviando…" : "Enviar"}
        </Button>
      </div>
    </ResponsiveFormDialog>
  );
}
