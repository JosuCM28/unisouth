"use client";

import { useState } from "react";
import { MessageCircle } from "lucide-react";
import { ResponsiveFormDialog } from "@/components/shared/responsive-form-dialog";
import { Button } from "@/components/ui/button";
import {
  canSendWhatsapp,
  sendVoucherByWhatsapp,
  useRecipientSelection,
  WhatsappRecipients,
  WhatsappUnavailable,
  type VoucherWhatsappOptions,
} from "./whatsapp-recipients";

interface Props {
  documentId: string;
  documentCode: string;
  whatsapp: VoucherWhatsappOptions;
}

/**
 * Manda otra vez por WhatsApp una salida YA aplicada.
 *
 * Para los dos casos que pasan de verdad: el envío falló porque el celular
 * estaba sin señal, o alguien más necesita el vale después de aplicado.
 * No vuelve a aplicar nada: sólo reparte el mismo papel.
 */
export function ResendWhatsappDialog({
  documentId,
  documentCode,
  whatsapp,
}: Props) {
  const [open, setOpen] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const { selected, toggle, reset } = useRecipientSelection(whatsapp.contacts);
  const canSend = canSendWhatsapp(whatsapp);

  function handleOpenChange(next: boolean) {
    if (isSending) return;
    setOpen(next);
    if (next) reset();
  }

  async function handleSend() {
    setIsSending(true);
    await sendVoucherByWhatsapp(documentId, [...selected]);
    setIsSending(false);
    setOpen(false);
  }

  return (
    <ResponsiveFormDialog
      open={open}
      onOpenChange={handleOpenChange}
      title={`Enviar ${documentCode} por WhatsApp`}
      description="Elige a quién le llega el vale."
      trigger={
        <Button type="button" variant="outline" className="touch-target">
          <MessageCircle className="size-4" aria-hidden />
          Enviar por WhatsApp
        </Button>
      }
    >
      <div className="flex flex-col gap-4">
        <WhatsappUnavailable whatsapp={whatsapp} />

        {canSend && (
          <WhatsappRecipients
            contacts={whatsapp.contacts}
            selected={selected}
            onToggle={toggle}
          />
        )}

        <Button
          type="button"
          onClick={handleSend}
          disabled={!canSend || isSending || selected.size === 0}
          className="h-12 w-full"
        >
          <MessageCircle className="size-4" aria-hidden />
          {isSending ? "Enviando…" : "Enviar"}
        </Button>
      </div>
    </ResponsiveFormDialog>
  );
}
