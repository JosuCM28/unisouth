"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Info } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { updateLotAction } from "@/app/actions/lot.actions";
import { FormField, FormSelectField } from "@/components/shared/form-field";
import { FormSection } from "@/components/shared/form-section";
import { ResponsiveFormDialog } from "@/components/shared/responsive-form-dialog";
import { SubmitButton } from "@/components/shared/submit-button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

/** Esquema del formulario: todo texto, como lo entrega un `<input>`. */
const editFormSchema = z.object({
  locationId: z.string().optional(),
  clientId: z.string().optional(),
  supplierLotNumber: z.string().optional(),
  shade: z.string().optional(),
  colorText: z.string().optional(),
  productionNote: z.string().optional(),
  actualWidthMm: z.string().optional(),
  actualThicknessMm: z.string().optional(),
  actualWeightOz: z.string().optional(),
  weightKg: z.string().optional(),
  unitCost: z.string().optional(),
  comment: z.string().optional(),
  reason: z.string().optional(),
});

type EditFormValues = z.infer<typeof editFormSchema>;

export interface EditableLot {
  id: string;
  code: string;
  locationId: string | null;
  clientId: string | null;
  supplierLotNumber: string | null;
  shade: string | null;
  colorText: string | null;
  productionNote: string | null;
  actualWidthMm: number | null;
  actualThicknessMm: number | null;
  actualWeightOz: number | null;
  weightKg: number | null;
  unitCost: number | null;
  comment: string | null;
}

interface LotEditSheetProps {
  lot: EditableLot;
  locations: { id: string; code: string; name: string }[];
  clients: { id: string; name: string }[];
  trigger: ReactNode;
}

/**
 * Corrección de la ficha del rollo: el error de dedo.
 *
 * Aquí SÓLO están los datos descriptivos, los que alguien pudo teclear mal al
 * dar de alta el rollo con la carga todavía en el andén. Lo que no aparece no
 * es un olvido:
 *
 * · La cantidad se corrige con un reconteo, que genera el movimiento que la
 *   explica. Editarla aquí rompería el kárdex.
 * · La fecha de llegada es un hecho: el material entró por la puerta ese día.
 * · El estado lo gobiernan los movimientos y la cancelación.
 *
 * Cada cambio queda en la bitácora con el nombre de quien lo hizo, la fecha,
 * el valor viejo y el nuevo.
 */
export function LotEditSheet({
  lot,
  locations,
  clients,
  trigger,
}: LotEditSheetProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const form = useForm<EditFormValues>({
    resolver: zodResolver(editFormSchema),
    defaultValues: toFormValues(lot),
  });

  async function onSubmit(values: EditFormValues) {
    const result = await updateLotAction({
      id: lot.id,
      locationId: values.locationId || undefined,
      clientId: values.clientId || undefined,
      supplierLotNumber: values.supplierLotNumber || undefined,
      shade: values.shade || undefined,
      colorText: values.colorText || undefined,
      productionNote: values.productionNote || undefined,
      actualWidthMm: values.actualWidthMm || undefined,
      actualThicknessMm: values.actualThicknessMm || undefined,
      actualWeightOz: values.actualWeightOz || undefined,
      weightKg: values.weightKg || undefined,
      unitCost: values.unitCost || undefined,
      comment: values.comment || undefined,
      reason: values.reason || undefined,
    });

    if (!result.success) {
      toast.error(result.error);
      return;
    }

    toast.success("Ficha corregida");
    setOpen(false);
    router.refresh();
  }

  /**
   * Al cerrar se descarta lo tecleado.
   *
   * Sin esto, abrir de nuevo mostraría los valores a medio editar de la vez
   * pasada como si fueran los guardados, y alguien acabaría guardando un dato
   * que creía haber descartado.
   */
  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) form.reset(toFormValues(lot));
  }

  return (
    <ResponsiveFormDialog
      open={open}
      onOpenChange={handleOpenChange}
      trigger={trigger}
      title={`Corregir ${lot.code}`}
      description="Sólo los datos de captura. La cantidad se corrige con un reconteo."
    >
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="flex flex-col gap-4"
      >
        <FormSection title="Ubicación y dueño" defaultOpen>
          <FormSelectField id="locationId" label="Ubicación">
            <Select
              value={form.watch("locationId") || "none"}
              onValueChange={(value) =>
                form.setValue("locationId", value === "none" ? "" : value)
              }
            >
              <SelectTrigger id="locationId" className="touch-target w-full">
                <SelectValue placeholder="Sin ubicación" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sin ubicación</SelectItem>
                {locations.map((location) => (
                  <SelectItem key={location.id} value={location.id}>
                    {location.code} · {location.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormSelectField>

          <FormSelectField id="clientId" label="Cliente dueño">
            <Select
              value={form.watch("clientId") || "none"}
              onValueChange={(value) =>
                form.setValue("clientId", value === "none" ? "" : value)
              }
            >
              <SelectTrigger id="clientId" className="touch-target w-full">
                <SelectValue placeholder="De la fábrica" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">De la fábrica</SelectItem>
                {clients.map((client) => (
                  <SelectItem key={client.id} value={client.id}>
                    {client.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormSelectField>
        </FormSection>

        <FormSection title="Identificación del rollo" defaultOpen>
          <FormField
            id="colorText"
            label="Color"
            placeholder="Azul índigo"
            {...form.register("colorText")}
          />
          <FormField
            id="shade"
            label="Tono / partida de tintura"
            placeholder="A-42"
            className="tabular"
            {...form.register("shade")}
          />
          <FormField
            id="supplierLotNumber"
            label="Lote del proveedor"
            placeholder="LOTE-99881"
            className="tabular"
            {...form.register("supplierLotNumber")}
          />
          <FormField
            id="productionNote"
            label="Producción"
            placeholder="TERNIUM PANTALON/CHAMARRA"
            autoCapitalize="characters"
            {...form.register("productionNote")}
          />
        </FormSection>

        <FormSection title="Medidas">
          <FormField
            id="actualWidthMm"
            label="Ancho (mm)"
            inputMode="decimal"
            placeholder="1600"
            className="tabular"
            {...form.register("actualWidthMm")}
          />
          <FormField
            id="actualThicknessMm"
            label="Grosor (mm)"
            inputMode="decimal"
            placeholder="0.45"
            className="tabular"
            {...form.register("actualThicknessMm")}
          />
          <FormField
            id="actualWeightOz"
            label="Peso (oz/yd²)"
            inputMode="decimal"
            placeholder="12"
            className="tabular"
            {...form.register("actualWeightOz")}
          />
          <FormField
            id="weightKg"
            label="Peso total (kg)"
            inputMode="decimal"
            placeholder="48.5"
            className="tabular"
            {...form.register("weightKg")}
          />
          <FormField
            id="unitCost"
            label="Costo unitario"
            inputMode="decimal"
            placeholder="82.50"
            className="tabular"
            {...form.register("unitCost")}
          />
        </FormSection>

        <div className="flex flex-col gap-2">
          <Label htmlFor="comment">Comentarios</Label>
          <Textarea
            id="comment"
            rows={2}
            placeholder="Viene con una mancha en la orilla"
            {...form.register("comment")}
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="reason">Motivo de la corrección</Label>
          <Textarea
            id="reason"
            rows={2}
            placeholder="Se capturó el tono equivocado al recibir"
            {...form.register("reason")}
          />
          <p className="text-xs text-muted-foreground">
            Opcional, pero ayuda a quien revise la bitácora después.
          </p>
        </div>

        {/* Quien corrige debe saber que esto no es una edición silenciosa. */}
        <div className="flex items-start gap-2 border border-border p-3">
          <Info className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
          <p className="text-xs text-muted-foreground">
            El cambio queda en la bitácora con tu nombre, la fecha y el valor
            anterior. La cantidad, la fecha de llegada y el estado no se editan
            aquí: para la cantidad usa el reconteo.
          </p>
        </div>

        <SubmitButton isSubmitting={form.formState.isSubmitting}>
          Guardar corrección
        </SubmitButton>
      </form>
    </ResponsiveFormDialog>
  );
}

/**
 * Del rollo al formulario.
 *
 * Los números se pasan a texto porque un `<input>` entrega texto, y los nulos
 * a cadena vacía: un `null` en un input lo vuelve no controlado y React se
 * queja al primer tecleo.
 */
function toFormValues(lot: EditableLot): EditFormValues {
  return {
    locationId: lot.locationId ?? "",
    clientId: lot.clientId ?? "",
    supplierLotNumber: lot.supplierLotNumber ?? "",
    shade: lot.shade ?? "",
    colorText: lot.colorText ?? "",
    productionNote: lot.productionNote ?? "",
    actualWidthMm: numberToText(lot.actualWidthMm),
    actualThicknessMm: numberToText(lot.actualThicknessMm),
    actualWeightOz: numberToText(lot.actualWeightOz),
    weightKg: numberToText(lot.weightKg),
    unitCost: numberToText(lot.unitCost),
    comment: lot.comment ?? "",
    reason: "",
  };
}

function numberToText(value: number | null): string {
  if (value === null || value === undefined) return "";
  return String(value);
}
