"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Info } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { updateReceiptAction } from "@/app/actions/receipt.actions";
import { FormField, FormSelectField } from "@/components/shared/form-field";
import { FormSection } from "@/components/shared/form-section";
import { ResponsiveFormDialog } from "@/components/shared/responsive-form-dialog";
import { SubmitButton } from "@/components/shared/submit-button";
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
  date: z.string().min(1, "La fecha es obligatoria"),
  guideNumber: z.string().optional(),
  carrierId: z.string().optional(),
  origin: z.string().optional(),
  supplierId: z.string().optional(),
  clientId: z.string().optional(),
  invoiceRef: z.string().optional(),
  orderRef: z.string().optional(),
  packageCount: z.string().optional(),
  notes: z.string().optional(),
  reason: z.string().optional(),
});

type EditFormValues = z.infer<typeof editFormSchema>;

export interface EditableReceipt {
  id: string;
  code: string;
  date: string;
  guideNumber: string | null;
  carrierId: string | null;
  origin: string | null;
  supplierId: string | null;
  clientId: string | null;
  invoiceRef: string | null;
  orderRef: string | null;
  packageCount: number | null;
  notes: string | null;
}

interface ReceiptEditSheetProps {
  receipt: EditableReceipt;
  clients: { id: string; name: string }[];
  suppliers: { id: string; name: string }[];
  carriers: { id: string; name: string }[];
  trigger: ReactNode;
}

/** Valor de los <Select> cuando no hay nada elegido. */
const NONE = "__none__";

/**
 * Corrección del encabezado de una recepción ya guardada.
 *
 * El encabezado se captura con el camión enfrente y media carga en el andén:
 * la factura, la orden de compra o el número de bultos casi siempre llegan
 * después. Sin esta pantalla la única salida era recapturar la recepción
 * entera, con sus rollos y sus folios.
 *
 * Lo que NO se edita aquí no es un olvido:
 *
 * · Los rollos que trajo la carga. Se corrigen uno por uno desde su ficha,
 *   donde cada cambio queda atado a su propio folio.
 * · El folio de la recepción, que ya se imprimió y se pegó.
 * · Quién la registró: es el rastro de auditoría, no un dato editable.
 *
 * Cambiar el "cliente dueño" hereda el nuevo dueño a los rollos de la guía
 * que sigan intactos; los que ya se cortaron o están apartados conservan el
 * suyo y se avisa cuáles fueron.
 */
export function ReceiptEditSheet({
  receipt,
  clients,
  suppliers,
  carriers,
  trigger,
}: ReceiptEditSheetProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const form = useForm<EditFormValues>({
    resolver: zodResolver(editFormSchema),
    defaultValues: toFormValues(receipt),
  });

  const ownerChanged =
    (form.watch("clientId") || "") !== (receipt.clientId ?? "");

  async function onSubmit(values: EditFormValues) {
    const result = await updateReceiptAction({
      id: receipt.id,
      date: values.date,
      guideNumber: values.guideNumber || undefined,
      carrierId: values.carrierId || undefined,
      origin: values.origin || undefined,
      supplierId: values.supplierId || undefined,
      clientId: values.clientId || undefined,
      invoiceRef: values.invoiceRef || undefined,
      orderRef: values.orderRef || undefined,
      packageCount: values.packageCount || undefined,
      notes: values.notes || undefined,
      reason: values.reason || undefined,
    });

    if (!result.success) {
      toast.error(result.error);
      return;
    }

    notifyOwnerChange(result.data);
    setOpen(false);
    router.refresh();
  }

  /**
   * Al cerrar se descarta lo tecleado.
   *
   * Sin esto, abrir de nuevo mostraría los valores a medio editar de la vez
   * pasada como si fueran los guardados.
   */
  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) form.reset(toFormValues(receipt));
  }

  const errors = form.formState.errors;

  return (
    <ResponsiveFormDialog
      open={open}
      onOpenChange={handleOpenChange}
      title={`Editar recepción ${receipt.code}`}
      description="Corrige los datos de la carga. Los rollos no se tocan."
      trigger={trigger}
    >
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="flex flex-col gap-4"
      >
        <FormSection title="Llegada" defaultOpen>
          <FormField
            id="date"
            label="Fecha"
            type="date"
            error={errors.date?.message}
            {...form.register("date")}
          />

          <FormField
            id="guideNumber"
            label="Guía"
            inputMode="search"
            placeholder="Número de la guía"
            error={errors.guideNumber?.message}
            {...form.register("guideNumber")}
          />

          <OptionSelect
            id="carrierId"
            label="Paquetería"
            options={carriers}
            value={form.watch("carrierId")}
            onChange={(value) =>
              form.setValue("carrierId", value, { shouldDirty: true })
            }
          />

          <FormField
            id="origin"
            label="Origen"
            placeholder="Ciudad o planta de donde salió"
            error={errors.origin?.message}
            {...form.register("origin")}
          />
        </FormSection>

        <FormSection title="Procedencia">
          <OptionSelect
            id="supplierId"
            label="Proveedor"
            options={suppliers}
            value={form.watch("supplierId")}
            onChange={(value) =>
              form.setValue("supplierId", value, { shouldDirty: true })
            }
          />

          <OptionSelect
            id="clientId"
            label="Cliente dueño"
            options={clients}
            emptyLabel="De la fábrica"
            value={form.watch("clientId")}
            onChange={(value) =>
              form.setValue("clientId", value, { shouldDirty: true })
            }
          />

          {ownerChanged && (
            <p className="flex items-start gap-2 border border-border bg-muted p-2 text-xs text-muted-foreground">
              <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
              <span>
                Los rollos de esta guía que sigan completos y sin apartar
                pasarán al nuevo dueño. Los que ya se cortaron o están
                reservados conservan el actual.
              </span>
            </p>
          )}
        </FormSection>

        <FormSection title="Documentos">
          <FormField
            id="invoiceRef"
            label="Factura"
            inputMode="search"
            error={errors.invoiceRef?.message}
            {...form.register("invoiceRef")}
          />

          <FormField
            id="orderRef"
            label="Orden de compra"
            inputMode="search"
            error={errors.orderRef?.message}
            {...form.register("orderRef")}
          />

          <FormField
            id="packageCount"
            label="Bultos"
            inputMode="numeric"
            error={errors.packageCount?.message}
            {...form.register("packageCount")}
          />
        </FormSection>

        <FormSection title="Notas y motivo">
          <div className="flex flex-col gap-2">
            <label htmlFor="notes" className="text-sm font-medium">
              Notas
            </label>
            <Textarea
              id="notes"
              rows={3}
              placeholder="Lo que valga la pena recordar de esta carga"
              {...form.register("notes")}
            />
          </div>

          <div className="flex flex-col gap-2">
            <label htmlFor="reason" className="text-sm font-medium">
              Motivo de la corrección
            </label>
            <Textarea
              id="reason"
              rows={2}
              placeholder="Por qué se corrige. Queda en la bitácora."
              {...form.register("reason")}
            />
          </div>
        </FormSection>

        <SubmitButton isSubmitting={form.formState.isSubmitting}>
          Guardar cambios
        </SubmitButton>
      </form>
    </ResponsiveFormDialog>
  );
}

/**
 * Select de catálogo con opción vacía.
 *
 * Radix no admite `value=""` en un item, así que el "sin elegir" viaja con un
 * centinela y se traduce a cadena vacía al salir.
 */
function OptionSelect({
  id,
  label,
  options,
  value,
  onChange,
  emptyLabel = "Sin especificar",
}: {
  id: string;
  label: string;
  options: { id: string; name: string }[];
  value: string | undefined;
  onChange: (value: string) => void;
  emptyLabel?: string;
}) {
  return (
    <FormSelectField id={id} label={label}>
      <Select
        value={value || NONE}
        onValueChange={(next) => onChange(next === NONE ? "" : next)}
      >
        <SelectTrigger id={id} className="touch-target">
          <SelectValue placeholder={emptyLabel} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={NONE}>{emptyLabel}</SelectItem>
          {options.map((option) => (
            <SelectItem key={option.id} value={option.id}>
              {option.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </FormSelectField>
  );
}

/** Del registro guardado a lo que esperan los inputs: todo texto. */
function toFormValues(receipt: EditableReceipt): EditFormValues {
  return {
    // El <input type="date"> sólo entiende YYYY-MM-DD.
    date: receipt.date.slice(0, 10),
    guideNumber: receipt.guideNumber ?? "",
    carrierId: receipt.carrierId ?? "",
    origin: receipt.origin ?? "",
    supplierId: receipt.supplierId ?? "",
    clientId: receipt.clientId ?? "",
    invoiceRef: receipt.invoiceRef ?? "",
    orderRef: receipt.orderRef ?? "",
    packageCount: receipt.packageCount?.toString() ?? "",
    notes: receipt.notes ?? "",
    reason: "",
  };
}

/**
 * Avisa qué pasó con los rollos al cambiar de dueño.
 *
 * Se dice explícitamente cuántos quedaron fuera: si el usuario cree que
 * reasignó la guía completa y en realidad la mitad seguía con el cliente
 * anterior, se entera al surtir, que es el peor momento.
 */
function notifyOwnerChange(data: unknown) {
  const result = data as
    | { reassignedLotCodes?: string[]; keptLotCodes?: string[] }
    | undefined;

  const kept = result?.keptLotCodes?.length ?? 0;
  const reassigned = result?.reassignedLotCodes?.length ?? 0;

  if (kept > 0) {
    toast.warning(
      `Recepción actualizada. ${reassigned} rollo(s) pasaron al nuevo dueño; ${kept} conservaron el anterior por estar en uso.`,
    );
    return;
  }

  if (reassigned > 0) {
    toast.success(
      `Recepción actualizada. ${reassigned} rollo(s) pasaron al nuevo dueño.`,
    );
    return;
  }

  toast.success("Recepción actualizada");
}
