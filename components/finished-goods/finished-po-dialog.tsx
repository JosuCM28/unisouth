"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Tag } from "lucide-react";
import { toast } from "sonner";
import { assignFinishedPoAction, changeFinishedPoAction } from "@/app/actions/finished-goods.actions";
import { runAction } from "@/lib/offline/run-action";
import type { FinishedStockRow } from "@/lib/repositories/finished-goods.repository";
import { formatQuantity } from "@/lib/utils";
import { assignFinishedPoSchema, changeFinishedPoSchema } from "@/lib/validations/finished-goods.schema";
import { ResponsiveFormDialog } from "@/components/shared/responsive-form-dialog";
import { SubmitButton } from "@/components/shared/submit-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

/** Lo que cambia entre asignar la primera PO y cambiar una que ya venía. */
const MODES = {
  assign: {
    title: "Asignar PO",
    description: "Estas piezas llegaron sin PO. Pásalas a la PO que les toca.",
    reasonLabel: "Motivo (opcional)",
    success: "PO asignada",
    schema: assignFinishedPoSchema,
    action: assignFinishedPoAction,
  },
  change: {
    title: "Cambiar PO",
    description: "Estas piezas ya traen PO de la orden. El cambio queda en la auditoría.",
    reasonLabel: "Motivo",
    success: "PO cambiada",
    schema: changeFinishedPoSchema,
    action: changeFinishedPoAction,
  },
} as const;

/**
 * Pasa piezas de un renglón a otra PO. Arranca con todas: lo normal es que
 * la PO sea de todo el renglón; se baja la cantidad para repartir.
 */
export function FinishedPoDialog({ row }: { row: FinishedStockRow }) {
  const mode = MODES[row.clientPo === null ? "assign" : "change"];
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [clientPo, setClientPo] = useState("");
  const [quantity, setQuantity] = useState(String(row.quantity));
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  function reset() {
    setClientPo("");
    setQuantity(String(row.quantity));
    setReason("");
  }

  async function handleSave() {
    const parsed = mode.schema.safeParse({ stockId: row.id, clientPo, quantity, reason });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Revisa los datos.");
      return;
    }
    setSaving(true);
    const result = await runAction(() => mode.action(parsed.data));
    setSaving(false);
    if (!result.success) {
      toast.error(result.error);
      return;
    }
    toast.success(mode.success);
    setOpen(false);
    reset();
    router.refresh();
  }

  const label = `${row.product.name} · ${row.size.code}`;

  return (
    <ResponsiveFormDialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
      title={mode.title}
      description={mode.description}
      trigger={
        <Button variant="ghost" size="icon" className="touch-target" aria-label={`${mode.title} de ${label}`} title={mode.title}>
          <Tag className="size-4" aria-hidden />
        </Button>
      }
    >
      <div className="flex flex-col gap-4">
        <p className="tabular text-sm">
          {label} · PO actual: <span className="font-medium">{row.clientPo ?? "Sin PO"}</span> ·{" "}
          {formatQuantity(row.quantity)} pzas
        </p>
        <div className="grid grid-cols-[1fr_6rem] gap-3">
          <div className="flex flex-col gap-2">
            <Label htmlFor="po-new">PO nueva</Label>
            <Input id="po-new" value={clientPo} onChange={(event) => setClientPo(event.target.value)}
              className="tabular touch-target uppercase" />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="po-qty">Piezas</Label>
            <Input id="po-qty" inputMode="numeric" value={quantity}
              onChange={(event) => setQuantity(event.target.value)} className="tabular touch-target" />
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="po-reason">{mode.reasonLabel}</Label>
          <Textarea id="po-reason" rows={2} value={reason} onChange={(event) => setReason(event.target.value)} />
        </div>
        <SubmitButton isSubmitting={saving} onClick={handleSave} className="h-12 w-full">
          {mode.title}
        </SubmitButton>
      </div>
    </ResponsiveFormDialog>
  );
}
