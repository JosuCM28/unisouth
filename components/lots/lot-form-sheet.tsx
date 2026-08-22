"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { z } from "zod";
import type { Unit } from "@prisma/client";
import { submitOrQueue } from "@/lib/offline/submit";
import { notifyQueueChanged } from "@/hooks/use-offline-queue";
import { UNIT_LABELS, toSelectOptions } from "@/lib/constants/labels";
import type { MaterialOption } from "@/lib/repositories/material.repository";
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
const lotFormSchema = z.object({
  materialId: z.string().min(1, "Elige el material"),
  quantity: z.string().min(1, "Escribe la cantidad"),
  unit: z.string().min(1, "Elige la unidad"),

  locationId: z.string().optional(),
  clientId: z.string().optional(),
  productionRunId: z.string().optional(),
  shade: z.string().optional(),
  supplierLotNumber: z.string().optional(),
  colorText: z.string().optional(),
  productionNote: z.string().optional(),
  actualWidthMm: z.string().optional(),
  actualWeightOz: z.string().optional(),
  comment: z.string().optional(),
});

type LotFormValues = z.infer<typeof lotFormSchema>;

const UNIT_OPTIONS = toSelectOptions(UNIT_LABELS);

interface LotFormSheetProps {
  materials: MaterialOption[];
  locations: { id: string; code: string; name: string }[];
  clients: { id: string; name: string }[];
  productionRuns: { id: string; code: string; name: string }[];
  trigger: ReactNode;
}

/**
 * Alta de rollo.
 *
 * Sólo tres campos a la vista. El auxiliar da de alta el rollo con la carga
 * todavía en el andén: si el formulario le exige tono, proveedor y ubicación
 * antes de guardar, vuelve a la libreta.
 */
export function LotFormSheet({
  materials,
  locations,
  clients,
  productionRuns,
  trigger,
}: LotFormSheetProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    setError,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<LotFormValues>({
    resolver: zodResolver(lotFormSchema),
    defaultValues: emptyValues(),
  });

  const materialId = watch("materialId");
  const selected = materials.find((material) => material.id === materialId);

  /**
   * Al elegir material se pone su unidad base automáticamente.
   *
   * Es un toque menos y, sobre todo, evita el error de dar de alta metros de
   * tela como si fueran piezas.
   */
  function handleMaterialChange(value: string) {
    setValue("materialId", value, { shouldDirty: true });

    const material = materials.find((item) => item.id === value);
    if (material) {
      setValue("unit", material.baseUnit, { shouldDirty: true });
    }
  }

  async function onSubmit(values: LotFormValues) {
    const payload = {
      ...values,
      locationId: values.locationId || undefined,
      clientId: values.clientId || undefined,
      productionRunId: values.productionRunId || undefined,
      shade: values.shade || undefined,
      supplierLotNumber: values.supplierLotNumber || undefined,
      colorText: values.colorText || undefined,
      productionNote: values.productionNote || undefined,
      actualWidthMm: values.actualWidthMm || undefined,
      actualWeightOz: values.actualWeightOz || undefined,
      comment: values.comment || undefined,
    };

    // Si no hay señal en el andén, la captura NO se pierde: se guarda y se
    // manda sola al volver la red.
    const outcome = await submitOrQueue("lot.create", payload, describe(values, selected));

    if (outcome.status === "failed") {
      if (outcome.field && outcome.field in values) {
        setError(outcome.field as keyof LotFormValues, { message: outcome.error });
      }
      toast.error(outcome.error);
      return;
    }

    if (outcome.status === "queued") {
      // Sin folio todavía: el R-2026-… lo asigna el servidor al sincronizar,
      // porque el correlativo es atómico y no se puede inventar aquí.
      toast.warning("Guardado sin conexión", {
        description: "Se enviará solo en cuanto vuelva el internet.",
      });
      notifyQueueChanged();
      reset(emptyValues());
      setOpen(false);
      return;
    }

    toast.success("Rollo dado de alta");
    reset(emptyValues());
    setOpen(false);
    router.refresh();
  }

  return (
    <ResponsiveFormDialog
      open={open}
      onOpenChange={setOpen}
      trigger={trigger}
      title="Nuevo rollo"
      description="Material, cantidad y unidad. Lo demás se puede llenar después."
    >
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
        <FormSelectField
          id="materialId"
          label="Material"
          error={errors.materialId?.message}
        >
          <Select value={materialId} onValueChange={handleMaterialChange}>
            <SelectTrigger id="materialId" className="touch-target w-full">
              <SelectValue placeholder="Elige el material" />
            </SelectTrigger>
            <SelectContent>
              {materials.map((material) => (
                <SelectItem key={material.id} value={material.id}>
                  {material.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormSelectField>

        <div className="grid grid-cols-[1fr_auto] gap-3">
          <FormField
            id="quantity"
            label="Cantidad"
            inputMode="decimal"
            placeholder="0"
            className="tabular text-lg"
            error={errors.quantity?.message}
            {...register("quantity")}
          />

          <FormSelectField id="unit" label="Unidad">
            <Select
              value={watch("unit")}
              onValueChange={(value) =>
                setValue("unit", value as Unit, { shouldDirty: true })
              }
            >
              <SelectTrigger id="unit" className="touch-target w-28">
                <SelectValue placeholder="—" />
              </SelectTrigger>
              <SelectContent>
                {UNIT_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormSelectField>
        </div>

        <FormSection title="Ubicación y dueño">
          <FormSelectField id="locationId" label="Ubicación">
            <Select
              value={watch("locationId") || "none"}
              onValueChange={(value) =>
                setValue("locationId", value === "none" ? "" : value)
              }
            >
              <SelectTrigger id="locationId" className="touch-target w-full">
                <SelectValue placeholder="Sin asignar" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sin asignar</SelectItem>
                {locations.map((location) => (
                  <SelectItem key={location.id} value={location.id}>
                    <span className="tabular">{location.code}</span> ·{" "}
                    {location.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormSelectField>

          {/* El dueño importa: jamás se surte material de un cliente a la
              producción de otro. */}
          <FormSelectField id="clientId" label="Cliente dueño">
            <Select
              value={watch("clientId") || "none"}
              onValueChange={(value) =>
                setValue("clientId", value === "none" ? "" : value)
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

          {productionRuns.length > 0 && (
            <FormSelectField id="productionRunId" label="Producción">
              <Select
                value={watch("productionRunId") || "none"}
                onValueChange={(value) =>
                  setValue("productionRunId", value === "none" ? "" : value)
                }
              >
                <SelectTrigger
                  id="productionRunId"
                  className="touch-target w-full"
                >
                  <SelectValue placeholder="Sin asignar" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sin asignar</SelectItem>
                  {productionRuns.map((run) => (
                    <SelectItem key={run.id} value={run.id}>
                      <span className="tabular">{run.code}</span> · {run.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormSelectField>
          )}
        </FormSection>

        <FormSection title="Identificación del rollo">
          {/* El tono no es el lote del proveedor: dos tonos en un mismo
              tendido salen con franjas y la prenda se rechaza. */}
          <FormField
            id="shade"
            label="Tono / partida de tintura"
            placeholder="A-42"
            hint={
              selected?.type === "FABRIC"
                ? "Dos tonos en un tendido = prenda rechazada."
                : undefined
            }
            className="tabular"
            {...register("shade")}
          />

          <FormField
            id="supplierLotNumber"
            label="Lote del proveedor"
            className="tabular"
            {...register("supplierLotNumber")}
          />

          <FormField id="colorText" label="Color" {...register("colorText")} />

          {/* Para qué se usa la tela. Texto libre y no el catálogo de
              producciones: se teclea en el andén sin dar nada de alta antes. */}
          <FormField
            id="productionNote"
            label="Producción"
            placeholder="TERNIUM PANTALON/CHAMARRA"
            autoCapitalize="characters"
            {...register("productionNote")}
          />
        </FormSection>

        <FormSection title="Medidas">
          <div className="grid grid-cols-2 gap-3">
            <FormField
              id="actualWidthMm"
              label="Ancho real"
              inputMode="decimal"
              suffix="mm"
              className="tabular"
              {...register("actualWidthMm")}
            />
            <FormField
              id="actualWeightOz"
              label="Peso real"
              inputMode="decimal"
              suffix="oz"
              className="tabular"
              {...register("actualWeightOz")}
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="comment">Comentario</Label>
            <Textarea id="comment" rows={2} {...register("comment")} />
          </div>
        </FormSection>

        <SubmitButton
          isSubmitting={isSubmitting}
          pendingLabel="Dando de alta…"
          className="h-14 w-full text-base"
        >
          Dar de alta
        </SubmitButton>
      </form>
    </ResponsiveFormDialog>
  );
}

/** Cómo se lee la captura en la lista de pendientes, sin folio todavía. */
function describe(
  values: LotFormValues,
  material?: { name: string },
): string {
  const name = material?.name ?? "Material";
  return `${name} · ${values.quantity} ${values.unit}`.trim();
}

function emptyValues(): LotFormValues {
  return {
    materialId: "",
    quantity: "",
    unit: "",
    locationId: "",
    clientId: "",
    productionRunId: "",
    shade: "",
    supplierLotNumber: "",
    colorText: "",
    productionNote: "",
    actualWidthMm: "",
    actualWeightOz: "",
    comment: "",
  };
}
