"use client";

import { useState } from "react";
import { Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  ReceiptEmailDialog,
  type ReceiptEmailOptions,
} from "./receipt-email-dialog";

/**
 * "Enviar recepción" desde la ficha: para cuando al guardar se eligió sólo
 * continuar, o alguien más necesita el resumen después.
 */
export function SendReceiptButton({
  receiptId,
  receiptCode,
  email,
}: {
  receiptId: string;
  receiptCode: string;
  email: ReceiptEmailOptions;
}) {
  const [open, setOpen] = useState(false);

  return (
    <ReceiptEmailDialog
      receiptId={receiptId}
      receiptCode={receiptCode}
      email={email}
      mode="resend"
      open={open}
      onOpenChange={setOpen}
      trigger={
        <Button variant="outline" className="touch-target">
          <Mail className="size-4" aria-hidden />
          Enviar recepción
        </Button>
      }
    />
  );
}
