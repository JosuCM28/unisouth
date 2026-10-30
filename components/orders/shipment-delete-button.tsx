"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { toast } from "sonner";
import { cancelDocumentAction } from "@/app/actions/document.actions";
import { removeGarmentShipmentAction } from "@/app/actions/garment-shipment.actions";
import { runAction } from "@/lib/offline/run-action";
import {
  canDeliver,
  deliverVoucher,
  useDeliverySelection,
  type VoucherDeliveryOptions,
} from "@/components/documents/voucher-delivery";
import { ResponsiveFormDialog } from "@/components/shared/responsive-form-dialog";
import { Button } from "@/components/ui/button";
import { CancelVoucherStep, NotifyStep } from "./shipment-delete-steps";

interface Props {
  shipmentId: string;
  shipmentCode: string;
  /** Piezas que salieron, sumando todas las tallas. */
  sentQuantity: number;
  /** Ya se capturó algún retorno: borrarlo también tira ese historial. */
  hasReturns: boolean;
  /** El vale que generó, para decir qué va a pasar con él. */
  voucher: {
    id: string;
    code: string;
    isDraft: boolean;
    isCancelled: boolean;
  } | null;
  /** Canales para avisar la cancelación del vale. Null = no se ofrece. */
  delivery: VoucherDeliveryOptions | null;
  /** Si puede cancelar un vale aplicado (`inventory:adjust`). */
  canCancelVoucher: boolean;
}

type Step = "confirm" | "voucher" | "notify";

const NO_DELIVERY: VoucherDeliveryOptions = {
  whatsapp: { enabled: false, configured: false, contacts: [] },
  email: { enabled: false, configured: false, contacts: [] },
};

/**
 * Borra un envío capturado por error.
 *
 * El caso es el dedazo: el taller equivocado, la etapa equivocada, la cantidad
 * de otra talla. Eso no es historia del taller —es basura— y dejarlo cancelado
 * para siempre ensucia la ficha de la orden.
 *
 * El diálogo dice ANTES de apretar qué pasa con el vale, porque es la parte
 * que no se adivina: si sigue en borrador se cancela junto con el envío, y si
 * ya se aplicó se pregunta si también se cancela.
 *
 * Todo se pregunta primero y se ejecuta al final, de un jalón. No es manía:
 * al borrar, el servidor repinta la orden y este renglón desaparece, así que
 * un diálogo que se abriera DESPUÉS de borrar se iría con él.
 */
export function ShipmentDeleteButton({
  shipmentId,
  shipmentCode,
  sentQuantity,
  hasReturns,
  voucher,
  delivery,
  canCancelVoucher,
}: Props) {
  const router = useRouter();
  const options = delivery ?? NO_DELIVERY;
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>("confirm");
  const [reason, setReason] = useState(`Se eliminó el envío ${shipmentCode}`);
  const [cancelApplied, setCancelApplied] = useState(false);
  const [busyLabel, setBusyLabel] = useState<string | null>(null);
  const { selected, toggle, total, reset } = useDeliverySelection(options);

  const offerNotice = canDeliver(options);
  const appliedVoucher =
    voucher && !voucher.isDraft && !voucher.isCancelled ? voucher : null;

  function handleOpenChange(next: boolean) {
    if (busyLabel) return;
    setOpen(next);
    if (!next) return;
    setStep("confirm");
    setCancelApplied(false);
    reset();
  }

  /** Después de confirmar: el siguiente paso que aplique, o borrar ya. */
  function handleConfirm() {
    if (appliedVoucher && canCancelVoucher) {
      setStep("voucher");
      return;
    }
    if (voucher?.isDraft && offerNotice) {
      setStep("notify");
      return;
    }
    void finish({ cancel: false, send: false });
  }

  function handleCancelVoucher() {
    setCancelApplied(true);
    if (offerNotice) {
      setStep("notify");
      return;
    }
    void finish({ cancel: true, send: false });
  }

  async function finish({ cancel, send }: { cancel: boolean; send: boolean }) {
    setBusyLabel("Borrando…");
    const deleted = await removeShipment();
    if (!deleted) {
      setBusyLabel(null);
      return;
    }

    const voucherCancelled =
      deleted.voucherCancelled || (cancel && (await cancelVoucher()));

    if (send && voucher && voucherCancelled) {
      setBusyLabel("Enviando…");
      await deliverVoucher(voucher.id, selected);
    }

    setBusyLabel(null);
    setOpen(false);
    router.refresh();
  }

  async function removeShipment() {
    const result = await runAction(() =>
      removeGarmentShipmentAction({ id: shipmentId }),
    );

    if (!result.success) {
      toast.error(result.error);
      return null;
    }

    toast.success(
      result.data.voucherCancelled
        ? `Envío eliminado y vale ${result.data.voucherCode} cancelado`
        : "Envío eliminado",
    );
    return result.data;
  }

  /** El envío ya se borró: si esto falla, se avisa a dónde ir a cancelarlo. */
  async function cancelVoucher(): Promise<boolean> {
    if (!appliedVoucher) return false;
    setBusyLabel("Cancelando el vale…");

    const result = await runAction(() =>
      cancelDocumentAction({ id: appliedVoucher.id, reason: reason.trim() }),
    );

    if (!result.success) {
      toast.error(
        `El envío se borró, pero el vale ${appliedVoucher.code} no se canceló: ${result.error} Cancélalo desde Salidas.`,
      );
      return false;
    }

    toast.success(`Vale ${appliedVoucher.code} cancelado`);
    return true;
  }

  return (
    <ResponsiveFormDialog
      open={open}
      onOpenChange={handleOpenChange}
      title={`Borrar ${shipmentCode}`}
      description={`Se borra el registro de las ${sentQuantity} piezas que salieron. No se puede deshacer.`}
      trigger={
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="touch-target shrink-0 text-muted-foreground"
          aria-label={`Borrar el envío ${shipmentCode}`}
        >
          <X className="size-4" aria-hidden />
        </Button>
      }
    >
      {step === "confirm" && (
        <ConfirmStep
          hasReturns={hasReturns}
          voucherNote={voucherNoteOf(voucher, canCancelVoucher)}
          onConfirm={handleConfirm}
          busyLabel={busyLabel}
        />
      )}

      {step === "voucher" && appliedVoucher && (
        <CancelVoucherStep
          voucherCode={appliedVoucher.code}
          reason={reason}
          onReasonChange={setReason}
          onCancelVoucher={handleCancelVoucher}
          onKeepVoucher={() => void finish({ cancel: false, send: false })}
          busy={busyLabel !== null}
        />
      )}

      {step === "notify" && voucher && (
        <NotifyStep
          voucherCode={voucher.code}
          delivery={options}
          selected={selected}
          onToggle={toggle}
          total={total}
          onFinish={(send) => void finish({ cancel: cancelApplied, send })}
          busyLabel={busyLabel}
        />
      )}
    </ResponsiveFormDialog>
  );
}

function ConfirmStep({
  hasReturns,
  voucherNote,
  onConfirm,
  busyLabel,
}: {
  hasReturns: boolean;
  voucherNote: string | null;
  onConfirm: () => void;
  busyLabel: string | null;
}) {
  return (
    <div className="flex flex-col gap-4">
      {hasReturns && (
        <p className="flat-surface p-3 text-sm text-muted-foreground">
          Este envío ya tiene retornos capturados. Se van con él: si el taller
          de verdad te devolvió esas piezas, esa cuenta se pierde.
        </p>
      )}

      {voucherNote && (
        <p className="flat-surface p-3 text-sm text-muted-foreground">
          {voucherNote}
        </p>
      )}

      <Button
        type="button"
        onClick={onConfirm}
        disabled={busyLabel !== null}
        className="h-12 w-full bg-destructive text-white hover:bg-destructive/90"
      >
        {busyLabel ?? "Sí, borrar el envío"}
      </Button>
    </div>
  );
}

/** Qué le pasa al vale, dicho antes de apretar. */
function voucherNoteOf(
  voucher: Props["voucher"],
  canCancelVoucher: boolean,
): string | null {
  if (!voucher) return null;
  if (voucher.isCancelled) return `Su vale ${voucher.code} ya está cancelado.`;
  if (voucher.isDraft) {
    return `Su vale ${voucher.code} está en borrador y se cancela junto con el envío.`;
  }
  if (canCancelVoucher) {
    return `Su vale ${voucher.code} ya se aplicó. En el siguiente paso eliges si también se cancela.`;
  }
  return `Su vale ${voucher.code} ya se aplicó y NO se toca. Si también estuvo mal, pide que lo cancelen desde Salidas.`;
}
