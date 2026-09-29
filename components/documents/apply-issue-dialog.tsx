"use client";

import { useState } from "react";
import { Check, Send } from "lucide-react";
import { ResponsiveFormDialog } from "@/components/shared/responsive-form-dialog";
import { Button } from "@/components/ui/button";
import {
  anyChannelEnabled,
  canDeliver,
  deliverVoucher,
  DeliveryRecipients,
  useDeliverySelection,
  type VoucherDeliveryOptions,
} from "./voucher-delivery";

interface Props {
  documentId: string;
  documentCode: string;
  disabled: boolean;
  delivery: VoucherDeliveryOptions;
  /** Aplica el vale. Devuelve si se aplicó, para saber si ya se puede enviar. */
  onApply: () => Promise<boolean>;
  /** Al terminar todo —aplicar y, si tocaba, enviar—: refresca la pantalla. */
  onFinished: () => void;
}

/**
 * Aplicar una salida, con la pregunta de a quién se le manda.
 *
 * El orden es fijo: PRIMERO se aplica y, ya aplicada, se manda por los
 * canales que ADMIN tenga prendidos. Así nunca sale un vale que después no
 * se pudo aplicar, y un celular sin señal o un correo caído no detienen la
 * entrega: si el envío falla, la salida queda aplicada y se reenvía desde su
 * ficha.
 */
export function ApplyIssueDialog({
  documentId,
  documentCode,
  disabled,
  delivery,
  onApply,
  onFinished,
}: Props) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"idle" | "applying" | "sending">("idle");
  const { selected, toggle, total, reset } = useDeliverySelection(delivery);

  const offerDelivery = canDeliver(delivery);
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
      await deliverVoucher(documentId, selected);
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
        offerDelivery ? "¿A quién se le manda el vale?" : "La salida quedará aplicada."
      }
      trigger={
        <Button type="button" disabled={disabled} className="touch-target">
          <Check className="size-4" aria-hidden />
          Aplicar
        </Button>
      }
    >
      <div className="flex flex-col gap-4">
        {anyChannelEnabled(delivery) && (
          <DeliveryRecipients
            options={delivery}
            selected={selected}
            onToggle={toggle}
          />
        )}

        {offerDelivery && (
          <Button
            type="button"
            onClick={() => run(true)}
            disabled={busy || total === 0}
            className="h-12 w-full"
          >
            <Send className="size-4" aria-hidden />
            {BUTTON_LABELS[step]}
          </Button>
        )}

        <Button
          type="button"
          variant={offerDelivery ? "outline" : "default"}
          onClick={() => run(false)}
          disabled={busy}
          className="h-12 w-full"
        >
          <Check className="size-4" aria-hidden />
          {offerDelivery ? "Sólo aplicar" : "Aplicar"}
        </Button>
      </div>
    </ResponsiveFormDialog>
  );
}

/** El botón principal dice en qué va: aplicar tarda poco, enviar no. */
const BUTTON_LABELS = {
  idle: "Aplicar y enviar",
  applying: "Aplicando…",
  sending: "Enviando…",
} as const;
