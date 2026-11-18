"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Tag } from "lucide-react";
import { toast } from "sonner";
import type { z } from "zod";
import { assignFinishedPoAction, changeFinishedPoAction } from "@/app/actions/finished-goods.actions";
import { runAction } from "@/lib/offline/run-action";
import type { FinishedStockRow } from "@/lib/repositories/finished-goods.repository";
import { formatQuantity } from "@/lib/utils";
import { assignFinishedPoSchema, changeFinishedPoSchema } from "@/lib/validations/finished-goods.schema";
import { FormField } from "@/components/shared/form-field";
import { ResponsiveFormDialog } from "@/components/shared/responsive-form-dialog";
import { SubmitButton } from "@/components/shared/submit-button";
import { Button } from "@/components/ui/button";
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

/* Los dos esquemas tienen los mismos campos; sólo cambia que el motivo sea
   obligatorio. El formulario se tipa con el más laxo y valida con el del modo,
   que es el mismo que vuelve a revisar el servidor. */
type FormInput = z.input<typeof assignFinishedPoSchema>;
type FormOutput = z.output<typeof assignFinishedPoSchema>;

/**
 * Pasa piezas de un renglón a otra PO. Arranca con todas: lo normal es que
 * la PO sea de todo el renglón; se baja la cantidad para repartir.
 */
export function FinishedPoDialog({ row }: { row: FinishedStockRow }) {
  const mode = MODES[row.clientPo === null ? "assign" : "change"];
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const form = useForm<FormInput, unknown, FormOutput>({
    resolver: zodResolver(mode.schema),
    defaultValues: toDefaults(row),
  });
  const { errors, isSubmitting } = form.formState;

  async function onSubmit(values: FormOutput) {
    const result = await runAction(() => mode.action(values));
    if (!result.success) {
      toast.error(result.error);
      return;
    }
    toast.success(mode.success);
    setOpen(false);
    form.reset(toDefaults(row));
    router.refresh();
  }

  const label = `${row.product.name} · ${row.size.code}`;

  return (
    <ResponsiveFormDialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) form.reset(toDefaults(row));
      }}
      title={mode.title}
      description={mode.description}
      trigger={
        <Button variant="ghost" size="icon" className="touch-target" aria-label={`${mode.title} de ${label}`} title={mode.title}>
          <Tag className="size-4" aria-hidden />
        </Button>
      }
    >
      <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">
        <p className="tabular text-sm">
          {label} · PO actual: <span className="font-medium">{row.clientPo ?? "Sin PO"}</span> ·{" "}
          {formatQuantity(row.quantity)} pzas
        </p>
        <div className="grid grid-cols-[1fr_6rem] gap-3">
          <FormField id="po-new" label="PO nueva" className="tabular touch-target uppercase"
            error={errors.clientPo?.message} {...form.register("clientPo")} />
          <FormField id="po-qty" label="Piezas" inputMode="numeric" className="tabular touch-target"
            error={errors.quantity?.message} {...form.register("quantity")} />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="po-reason">{mode.reasonLabel}</Label>
          <Textarea id="po-reason" rows={2} aria-invalid={Boolean(errors.reason)} {...form.register("reason")} />
          {errors.reason && <p className="text-sm text-destructive">{errors.reason.message}</p>}
        </div>
        <SubmitButton isSubmitting={isSubmitting} className="h-12 w-full">
          {mode.title}
        </SubmitButton>
      </form>
    </ResponsiveFormDialog>
  );
}

/** Arranca con todo el renglón: lo normal es pasar todas sus piezas. */
function toDefaults(row: FinishedStockRow): FormInput {
  return { stockId: row.id, clientPo: "", quantity: String(row.quantity), reason: "" };
}
