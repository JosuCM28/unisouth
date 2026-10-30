"use client";

import { useState } from "react";
import { Send } from "lucide-react";
import { ResponsiveFormDialog } from "@/components/shared/responsive-form-dialog";
import { Button } from "@/components/ui/button";
import {
  deliverVoucher,
  DeliveryRecipients,
  useDeliverySelection,
  type VoucherDeliveryOptions,
} from "./voucher-delivery";

interface Props {
  /** El vale ya cancelado. Null = no hay nada que avisar y no se abre. */
  voucher: { id: string; code: string } | null;
  delivery: VoucherDeliveryOptions;
  /** Al terminar —enviado o no—: quien lo abrió refresca la pantalla. */
  onClose: () => void;
}

/**
 * Pregunta, YA cancelado el vale, si se avisa a los contactos.
 *
 * Opcional y después, igual que al aplicar: cancelar mueve inventario y no
 * puede quedar esperando a un celular sin señal. Lo que sale es el mismo
 * vale, marcado como cancelado, para que el taller que tiene el original en
 * el chat sepa que ya no vale.
 *
 * Lo gobierna quien canceló: se abre cuando le pasa el vale, sin botón propio.
 */
export function CancellationDeliveryDialog({ voucher, delivery, onClose }: Props) {
  const [isSending, setIsSending] = useState(false);
  const { selected, toggle, total } = useDeliverySelection(delivery);

  function handleOpenChange(next: boolean) {
    // No se cierra a medio envío: cerrarlo haría creer que no salió.
    if (next || isSending) return;
    onClose();
  }

  async function handleSend() {
    if (!voucher) return;
    setIsSending(true);
    await deliverVoucher(voucher.id, selected);
    setIsSending(false);
    onClose();
  }

  return (
    <ResponsiveFormDialog
      open={voucher !== null}
      onOpenChange={handleOpenChange}
      title={`Avisar la cancelación de ${voucher?.code ?? ""}`}
      description="Se manda el vale marcado como CANCELADO, con el motivo."
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
          disabled={isSending || total === 0}
          className="h-12 w-full"
        >
          <Send className="size-4" aria-hidden />
          {isSending ? "Enviando…" : "Enviar aviso"}
        </Button>

        <Button
          type="button"
          variant="outline"
          onClick={onClose}
          disabled={isSending}
          className="h-12 w-full"
        >
          No enviar
        </Button>
      </div>
    </ResponsiveFormDialog>
  );
}
