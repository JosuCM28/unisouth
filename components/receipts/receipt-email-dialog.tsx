"use client";

import { useState, type ReactNode } from "react";
import { ArrowRight, Mail } from "lucide-react";
import { sendReceiptEmailAction } from "@/app/actions/email.actions";
import type { EmailRecipient } from "@/lib/repositories/email-contact.repository";
import { ResponsiveFormDialog } from "@/components/shared/responsive-form-dialog";
import { Button } from "@/components/ui/button";
import {
  ChannelBody,
  reportDelivery,
  type DeliveryChannel,
} from "@/components/documents/voucher-delivery";

export type ReceiptEmailOptions = DeliveryChannel<EmailRecipient>;

interface Props {
  receiptId: string;
  receiptCode: string;
  email: ReceiptEmailOptions;
  /**
   * `after-save`: lo abre la captura al guardar, con "Sólo continuar".
   * `resend`: lo abre el botón de la ficha, sólo para enviar.
   */
  mode: "after-save" | "resend";
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trigger?: ReactNode;
  /** Al terminar —enviado o no—: la captura sigue a su siguiente pantalla. */
  onDone?: () => void;
}

/**
 * Mandar por correo lo que llegó en una recepción.
 *
 * La recepción YA está guardada cuando esto se abre: enviar o no enviar no
 * cambia nada de los rollos, y un correo caído no deshace la captura. Por
 * eso cerrar el diálogo equivale a "Sólo continuar".
 */
export function ReceiptEmailDialog({
  receiptId,
  receiptCode,
  email,
  mode,
  open,
  onOpenChange,
  trigger,
  onDone,
}: Props) {
  const [selected, setSelected] = useState<Set<string>>(() => initialIds(email));
  const [isSending, setIsSending] = useState(false);

  const usable = email.configured && email.contacts.length > 0;

  function handleOpenChange(next: boolean) {
    // No se cierra a medio envío: cerrarlo haría creer que se canceló.
    if (isSending) return;
    if (next) setSelected(initialIds(email));
    onOpenChange(next);
    if (!next) onDone?.();
  }

  function toggle(id: string, checked: boolean) {
    setSelected((current) => {
      const next = new Set(current);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  async function handleSend() {
    setIsSending(true);
    await reportDelivery("correo", () =>
      sendReceiptEmailAction({ receiptId, contactIds: [...selected] }),
    );
    setIsSending(false);
    onOpenChange(false);
    onDone?.();
  }

  return (
    <ResponsiveFormDialog
      open={open}
      onOpenChange={handleOpenChange}
      title={TITLES[mode](receiptCode)}
      description="Se manda el Excel con tela, tono, rollos y cantidades, con la guía, la paquetería y el cliente dueño."
      trigger={trigger}
    >
      <div className="flex flex-col gap-4">
        <ChannelBody
          channel="email"
          options={email}
          items={email.contacts.map((c) => ({
            id: c.id,
            name: c.name,
            detail: c.email,
            active: c.active,
          }))}
          selected={selected}
          onToggle={toggle}
        />

        <Button
          type="button"
          onClick={handleSend}
          disabled={!usable || isSending || selected.size === 0}
          className="h-12 w-full"
        >
          <Mail className="size-4" aria-hidden />
          {isSending ? "Enviando…" : "Enviar por correo"}
        </Button>

        {mode === "after-save" && (
          <Button
            type="button"
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={isSending}
            className="h-12 w-full"
          >
            <ArrowRight className="size-4" aria-hidden />
            Sólo continuar
          </Button>
        )}
      </div>
    </ResponsiveFormDialog>
  );
}

const TITLES: Record<Props["mode"], (code: string) => string> = {
  "after-save": (code) => `Recepción ${code} guardada`,
  resend: (code) => `Enviar ${code} por correo`,
};

/** Los activos van marcados: son "los de siempre". */
function initialIds(email: ReceiptEmailOptions): Set<string> {
  return new Set(email.contacts.filter((c) => c.active).map((c) => c.id));
}
