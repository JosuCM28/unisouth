"use client";

import { Send } from "lucide-react";
import {
  DeliveryRecipients,
  type DeliverySelection,
  type VoucherDeliveryOptions,
} from "@/components/documents/voucher-delivery";
import type { NotificationChannel } from "@/lib/validations/notification-settings.schema";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const DESTRUCTIVE = "h-12 w-full bg-destructive text-white hover:bg-destructive/90";

/**
 * Segundo paso: el vale ya aplicado, ¿se cancela también?
 *
 * Se pregunta aquí y no se hace solo porque cancelar un vale aplicado
 * regresa inventario: es decisión de quien borra, con su motivo, y no un
 * efecto secundario de corregir una captura.
 */
export function CancelVoucherStep({
  voucherCode,
  reason,
  onReasonChange,
  onCancelVoucher,
  onKeepVoucher,
  busy,
}: {
  voucherCode: string;
  reason: string;
  onReasonChange: (reason: string) => void;
  onCancelVoucher: () => void;
  onKeepVoucher: () => void;
  busy: boolean;
}) {
  return (
    <div className="flex flex-col gap-4">
      <p className="flat-surface p-3 text-sm text-muted-foreground">
        El vale {voucherCode} ya se aplicó. Si también estuvo mal, cancélalo
        aquí: se regresa lo que sacó y queda en la bitácora con este motivo.
      </p>

      <div className="flex flex-col gap-2">
        <Label htmlFor="voucher-cancel-reason">Motivo</Label>
        <Textarea
          id="voucher-cancel-reason"
          rows={3}
          value={reason}
          onChange={(event) => onReasonChange(event.target.value)}
        />
      </div>

      <Button
        type="button"
        onClick={onCancelVoucher}
        disabled={busy || !reason.trim()}
        className={DESTRUCTIVE}
      >
        Sí, cancelar también el vale
      </Button>

      <Button
        type="button"
        variant="outline"
        onClick={onKeepVoucher}
        disabled={busy}
        className="h-12 w-full"
      >
        {busy ? "Borrando…" : "No, sólo borrar el envío"}
      </Button>
    </div>
  );
}

/**
 * Último paso: a quién se le avisa que el vale quedó cancelado.
 *
 * Opcional: "Borrar sin avisar" hace lo mismo menos el envío.
 */
export function NotifyStep({
  voucherCode,
  delivery,
  selected,
  onToggle,
  total,
  onFinish,
  busyLabel,
}: {
  voucherCode: string;
  delivery: VoucherDeliveryOptions;
  selected: DeliverySelection;
  onToggle: (channel: NotificationChannel, id: string, checked: boolean) => void;
  total: number;
  onFinish: (send: boolean) => void;
  /** Lo que se está haciendo, o null si nada. */
  busyLabel: string | null;
}) {
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        ¿Avisas que {voucherCode} quedó cancelado? Se manda el vale marcado
        como CANCELADO, con el motivo.
      </p>

      <DeliveryRecipients
        options={delivery}
        selected={selected}
        onToggle={onToggle}
      />

      <Button
        type="button"
        onClick={() => onFinish(true)}
        disabled={busyLabel !== null || total === 0}
        className="h-12 w-full"
      >
        <Send className="size-4" aria-hidden />
        {busyLabel ?? "Borrar y enviar aviso"}
      </Button>

      <Button
        type="button"
        variant="outline"
        onClick={() => onFinish(false)}
        disabled={busyLabel !== null}
        className="h-12 w-full"
      >
        Borrar sin avisar
      </Button>
    </div>
  );
}
