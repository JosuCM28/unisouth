"use client";

import { useState } from "react";
import { Check, MessageCircle } from "lucide-react";
import { ResponsiveFormDialog } from "@/components/shared/responsive-form-dialog";
import { Button } from "@/components/ui/button";
import {
  canSendWhatsapp,
  sendVoucherByWhatsapp,
  useRecipientSelection,
  WhatsappRecipients,
  type VoucherWhatsappOptions,
} from "./whatsapp-recipients";

interface Props {
  documentId: string;
  documentCode: string;
  disabled: boolean;
  whatsapp: VoucherWhatsappOptions;
  /** Aplica el vale. Devuelve si se aplicó, para saber si ya se puede enviar. */
  onApply: () => Promise<boolean>;
  /** Al terminar todo —aplicar y, si tocaba, enviar—: refresca la pantalla. */
  onFinished: () => void;
}

/**
 * Aplicar una salida, con la pregunta de si se manda por WhatsApp.
 *
 * El orden es fijo: PRIMERO se aplica y, ya aplicada, se manda. Así nunca
 * sale por WhatsApp un vale que después no se pudo aplicar, y un celular sin
 * señal no detiene la entrega: si el envío falla, la salida queda aplicada y
 * se reenvía desde su ficha.
 */
export function ApplyIssueDialog({
  documentId,
  documentCode,
  disabled,
  whatsapp,
  onApply,
  onFinished,
}: Props) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"idle" | "applying" | "sending">("idle");
  const { selected, toggle, reset } = useRecipientSelection(whatsapp.contacts);

  const offerWhatsapp = canSendWhatsapp(whatsapp);
  const busy = step !== "idle";

  function handleOpenChange(next: boolean) {
    // No se cierra a medio envío: cerrarlo haría creer que se canceló.
    if (busy) return;
    setOpen(next);
    if (next) reset();
  }

  async function run(send: boolean) {
    setStep("applying");
    const applied = await onApply();

    if (applied && send) {
      setStep("sending");
      await sendVoucherByWhatsapp(documentId, [...selected]);
    }

    setStep("idle");
    if (!applied) return;

    setOpen(false);
    onFinished();
  }

  return (
    <ResponsiveFormDialog
      open={open}
      onOpenChange={handleOpenChange}
      title={`Aplicar ${documentCode}`}
      description={
        offerWhatsapp
          ? "¿Enviar el vale por WhatsApp?"
          : "La salida quedará aplicada."
      }
      trigger={
        <Button type="button" disabled={disabled} className="touch-target">
          <Check className="size-4" aria-hidden />
          Aplicar
        </Button>
      }
    >
      <div className="flex flex-col gap-4">
        {offerWhatsapp && (
          <WhatsappRecipients
            contacts={whatsapp.contacts}
            selected={selected}
            onToggle={toggle}
          />
        )}

        <UnavailableNote whatsapp={whatsapp} />

        {offerWhatsapp && (
          <Button
            type="button"
            onClick={() => run(true)}
            disabled={busy || selected.size === 0}
            className="h-12 w-full"
          >
            <MessageCircle className="size-4" aria-hidden />
            {BUTTON_LABELS[step]}
          </Button>
        )}

        <Button
          type="button"
          variant={offerWhatsapp ? "outline" : "default"}
          onClick={() => run(false)}
          disabled={busy}
          className="h-12 w-full"
        >
          <Check className="size-4" aria-hidden />
          {offerWhatsapp ? "Sólo aplicar" : "Aplicar"}
        </Button>
      </div>
    </ResponsiveFormDialog>
  );
}

/** El botón principal dice en qué va: aplicar tarda poco, enviar no. */
const BUTTON_LABELS = {
  idle: "Aplicar y enviar",
  applying: "Aplicando…",
  sending: "Enviando por WhatsApp…",
} as const;

/** Por qué no se ofrece el envío, cuando no se ofrece. */
function UnavailableNote({ whatsapp }: { whatsapp: VoucherWhatsappOptions }) {
  if (canSendWhatsapp(whatsapp)) return null;

  const reason = whatsapp.configured
    ? "No hay contactos de WhatsApp dados de alta."
    : "WhatsApp no está configurado en el servidor.";

  return (
    <p className="border border-border bg-muted p-2 text-xs text-muted-foreground">
      {reason} El vale se aplica sin enviarse.
    </p>
  );
}
