"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PackageOpen } from "lucide-react";
import { toast } from "sonner";
import { createWorkshopOutputAction } from "@/app/actions/workshop-output.actions";
import { runAction } from "@/lib/offline/run-action";
import type { WorkshopBalanceOrder } from "@/lib/services/workshop-output.service";
import { todayInputValue } from "@/lib/utils";
import { FormSelectField } from "@/components/shared/form-field";
import { ResponsiveFormDialog } from "@/components/shared/responsive-form-dialog";
import { SearchSelect } from "@/components/shared/search-select";
import { SubmitButton } from "@/components/shared/submit-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PLANT_DESTINATION_LABEL } from "./output-card";
import { OutputSizeRows, toDraftRows, type DraftRow } from "./output-size-rows";

interface Props {
  balance: WorkshopBalanceOrder[];
  destinations: { id: string; name: string }[];
}

/**
 * La salida de un taller de proceso: elige la orden y le aparecen sus tallas
 * con lo que tiene. Sube o baja; lo que se echó a perder va como merma.
 */
export function OutputFormDialog({ balance, destinations }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [orderId, setOrderId] = useState("");
  const [destinationId, setDestinationId] = useState("");
  const [date, setDate] = useState(todayInputValue());
  const [parts, setParts] = useState("");
  const [notes, setNotes] = useState("");
  const [rows, setRows] = useState<DraftRow[]>([]);
  const [saving, setSaving] = useState(false);

  const order = balance.find((entry) => entry.orderId === orderId);

  function chooseOrder(id: string) {
    setOrderId(id);
    setRows(toDraftRows(balance.find((entry) => entry.orderId === id)));
  }

  function reset() {
    setOrderId("");
    setDestinationId("");
    setDate(todayInputValue());
    setParts("");
    setNotes("");
    setRows([]);
  }

  async function handleSave() {
    const lines = rows
      .map((row) => ({
        sizeId: row.sizeId,
        quantity: Number(row.quantity) || 0,
        scrapQuantity: Number(row.scrap) || 0,
        scrapReason: row.scrapReason.trim() || undefined,
      }))
      .filter((line) => line.quantity + line.scrapQuantity > 0);

    if (!orderId || lines.length === 0) {
      toast.error("Elige la orden y captura al menos una talla.");
      return;
    }

    setSaving(true);
    const result = await runAction(() =>
      createWorkshopOutputAction({
        orderId,
        destinationWorkshopId: destinationId || undefined,
        date,
        parts: parts.trim() || undefined,
        notes: notes.trim() || undefined,
        lines,
      }),
    );
    setSaving(false);

    if (!result.success) {
      toast.error(result.error);
      return;
    }
    toast.success(`Salida ${result.data.code} registrada`);
    setOpen(false);
    reset();
    router.refresh();
  }

  return (
    <ResponsiveFormDialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
      title="Nueva salida"
      description="Lo que ya procesaste y sale de tu taller. Nadie más tiene que recibirlo."
      trigger={
        <Button className="touch-target" disabled={balance.length === 0}>
          <PackageOpen className="size-4" aria-hidden />
          Nueva salida
        </Button>
      }
    >
      <div className="flex flex-col gap-4">
        <FormSelectField id="output-order" label="Orden">
          <SearchSelect
            id="output-order"
            options={balance.map((entry) => ({
              value: entry.orderId,
              label: entry.reference ?? entry.code,
              hint: [entry.clientName, entry.description].filter(Boolean).join(" · "),
              keywords: [entry.code, entry.clientName, entry.description].filter(Boolean).join(" "),
            }))}
            value={orderId}
            onChange={chooseOrder}
            placeholder="Elige la orden"
            searchPlaceholder="Folio, cliente o prenda…"
          />
        </FormSelectField>

        <FormSelectField id="output-destination" label="A dónde va" hint="Sólo queda de registro: nadie lo recibe.">
          <SearchSelect
            id="output-destination"
            options={destinations.map((workshop) => ({ value: workshop.id, label: workshop.name }))}
            value={destinationId}
            onChange={setDestinationId}
            clearLabel={PLANT_DESTINATION_LABEL}
            placeholder={PLANT_DESTINATION_LABEL}
            searchPlaceholder="Buscar taller…"
          />
        </FormSelectField>

        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-2">
            <Label htmlFor="output-date">Fecha</Label>
            <Input id="output-date" type="date" value={date}
              onChange={(event) => setDate(event.target.value)} className="touch-target" />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="output-parts">Qué partes van</Label>
            <Input id="output-parts" placeholder="Frente izquierdo bordado" value={parts}
              onChange={(event) => setParts(event.target.value)} className="touch-target" />
          </div>
        </div>

        {order && <OutputSizeRows rows={rows} onChange={setRows} />}

        <div className="flex flex-col gap-2">
          <Label htmlFor="output-notes">Nota</Label>
          <Textarea id="output-notes" rows={2} value={notes} onChange={(event) => setNotes(event.target.value)} />
        </div>

        <SubmitButton isSubmitting={saving} onClick={handleSave} disabled={!order} className="h-12 w-full">
          Registrar salida
        </SubmitButton>
      </div>
    </ResponsiveFormDialog>
  );
}
