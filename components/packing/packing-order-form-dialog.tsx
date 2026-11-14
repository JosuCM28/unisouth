"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  createPackingOrderAction,
  updatePackingOrderAction,
} from "@/app/actions/packing.actions";
import { runAction } from "@/lib/offline/run-action";
import { todayInputValue, toDateInputValue } from "@/lib/utils";
import { packingOrderSchema } from "@/lib/validations/packing.schema";
import { FormSelectField } from "@/components/shared/form-field";
import { ResponsiveFormDialog } from "@/components/shared/responsive-form-dialog";
import { SearchSelect } from "@/components/shared/search-select";
import { SubmitButton } from "@/components/shared/submit-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export interface EditablePackingOrder {
  id: string;
  name: string;
  clientId: string | null;
  date: Date;
  notes: string | null;
}

/**
 * Alta y edición del pedido. Sólo el nombre es obligatorio: "TAMSA
 * 13/11/2026" basta para empezar a llenar cajas.
 */
export function PackingOrderFormDialog({
  order,
  clients,
  trigger,
}: {
  order?: EditablePackingOrder;
  clients: { id: string; name: string }[];
  trigger: ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(order?.name ?? "");
  const [clientId, setClientId] = useState(order?.clientId ?? "");
  const [date, setDate] = useState(order ? toDateInputValue(order.date) : todayInputValue());
  const [notes, setNotes] = useState(order?.notes ?? "");
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    const parsed = packingOrderSchema.safeParse({ name, clientId, date, notes });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Revisa los datos.");
      return;
    }

    setSaving(true);
    const result = order
      ? await runAction(() => updatePackingOrderAction({ id: order.id, data: parsed.data }))
      : await runAction(() => createPackingOrderAction(parsed.data));
    setSaving(false);
    if (!result.success) {
      toast.error(result.error);
      return;
    }

    toast.success(result.message ?? "Guardado");
    setOpen(false);
    if (order) {
      router.refresh();
      return;
    }
    router.push(`/packing/${(result.data as { id: string }).id}`);
  }

  return (
    <ResponsiveFormDialog
      open={open}
      onOpenChange={setOpen}
      title={order ? "Editar pedido" : "Nuevo pedido"}
      description="Un pedido de empaque con sus cajas."
      trigger={trigger}
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="packing-name">Nombre</Label>
          <Input id="packing-name" placeholder="TAMSA 13/11/2026" value={name}
            onChange={(event) => setName(event.target.value)} className="touch-target uppercase" />
        </div>
        <FormSelectField id="packing-client" label="Cliente" hint="Con cliente, sus cajas sólo aceptan prenda de ese dueño.">
          <SearchSelect id="packing-client" value={clientId} onChange={setClientId}
            options={clients.map((c) => ({ value: c.id, label: c.name }))}
            clearLabel="Sin cliente" placeholder="Sin cliente" searchPlaceholder="Buscar cliente…" />
        </FormSelectField>
        <div className="flex flex-col gap-2">
          <Label htmlFor="packing-date">Fecha</Label>
          <Input id="packing-date" type="date" value={date}
            onChange={(event) => setDate(event.target.value)} className="touch-target" />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="packing-notes">Nota</Label>
          <Textarea id="packing-notes" rows={2} value={notes} onChange={(event) => setNotes(event.target.value)} />
        </div>
        <SubmitButton isSubmitting={saving} onClick={handleSave} className="h-12 w-full">
          {order ? "Guardar cambios" : "Crear pedido"}
        </SubmitButton>
      </div>
    </ResponsiveFormDialog>
  );
}
