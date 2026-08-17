"use client";

import { useState, type ReactNode } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import type { ProductionRun, ProductionRunStatus } from "@prisma/client";
import {
  createProductionRunAction,
  updateProductionRunAction,
} from "@/app/actions/production-run.actions";
import { PRODUCTION_RUN_STATUS_LABELS } from "@/lib/constants/labels";
import {
  productionRunFormSchema,
  type ProductionRunFormValues,
} from "@/lib/validations/production-run.schema";
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

interface Props {
  run?: ProductionRun;
  clients: { id: string; name: string }[];
  trigger: ReactNode;
}

const FORM_FIELDS = Object.keys(
  productionRunFormSchema.shape,
) as (keyof ProductionRunFormValues)[];

export function ProductionRunFormDialog({ run, clients, trigger }: Props) {
  const [open, setOpen] = useState(false);
  const isEditing = Boolean(run);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    setError,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ProductionRunFormValues>({
    resolver: zodResolver(productionRunFormSchema),
    defaultValues: toDefaults(run),
  });

  async function onSubmit(values: ProductionRunFormValues) {
    const payload = {
      ...values,
      season: values.season || undefined,
      startDate: values.startDate || undefined,
      endDate: values.endDate || undefined,
      notes: values.notes || undefined,
    };

    const result = isEditing
      ? await updateProductionRunAction({ id: run!.id, data: payload })
      : await createProductionRunAction(payload);

    if (!result.success) {
      if (result.field && FORM_FIELDS.includes(result.field as keyof ProductionRunFormValues)) {
        setError(result.field as keyof ProductionRunFormValues, { message: result.error });
      }
      toast.error(result.error);
      return;
    }

    toast.success(result.message ?? "Guardado");
    setOpen(false);
    if (!isEditing) reset(toDefaults());
  }

  return (
    <ResponsiveFormDialog
      open={open}
      onOpenChange={setOpen}
      trigger={trigger}
      title={isEditing ? "Editar producción" : "Nueva producción"}
      description={
        isEditing
          ? `Modifica los datos de ${run!.code}.`
          : "Código, nombre y cliente dueño del material."
      }
    >
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
        <FormField
          id="code"
          label="Código"
          placeholder="PO-OVEROL-01"
          autoComplete="off"
          className="tabular uppercase"
          error={errors.code?.message}
          {...register("code")}
        />

        <FormField
          id="name"
          label="Nombre"
          placeholder="Overol gasera 2026"
          autoComplete="off"
          error={errors.name?.message}
          {...register("name")}
        />

        {/* El cliente SÍ es obligatorio: sin dueño no se puede segregar el
            material y se correría el riesgo de surtir tela de otro cliente. */}
        <FormSelectField
          id="clientId"
          label="Cliente"
          hint="Dueño del material que se va a consumir."
          error={errors.clientId?.message}
        >
          <Select
            value={watch("clientId")}
            onValueChange={(value) => setValue("clientId", value, { shouldDirty: true })}
          >
            <SelectTrigger id="clientId" className="touch-target w-full">
              <SelectValue placeholder="Elige el cliente" />
            </SelectTrigger>
            <SelectContent>
              {clients.map((client) => (
                <SelectItem key={client.id} value={client.id}>
                  {client.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormSelectField>

        <FormSection title="Detalles">
          <FormField id="season" label="Temporada" placeholder="2026" {...register("season")} />

          <div className="grid grid-cols-2 gap-3">
            <FormField id="startDate" label="Inicio" type="date" className="tabular" {...register("startDate")} />
            <FormField id="endDate" label="Fin" type="date" className="tabular" {...register("endDate")} />
          </div>

          <FormSelectField id="status" label="Estado">
            <Select
              value={watch("status")}
              onValueChange={(value) =>
                setValue("status", value as ProductionRunStatus, { shouldDirty: true })
              }
            >
              <SelectTrigger id="status" className="touch-target w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(PRODUCTION_RUN_STATUS_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormSelectField>

          <div className="flex flex-col gap-2">
            <Label htmlFor="notes">Notas</Label>
            <Textarea id="notes" rows={2} {...register("notes")} />
          </div>
        </FormSection>

        <SubmitButton isSubmitting={isSubmitting} pendingLabel="Guardando…" className="w-full">
          {isEditing ? "Guardar cambios" : "Crear producción"}
        </SubmitButton>
      </form>
    </ResponsiveFormDialog>
  );
}

function toDefaults(run?: ProductionRun): ProductionRunFormValues {
  return {
    code: run?.code ?? "",
    name: run?.name ?? "",
    clientId: run?.clientId ?? "",
    season: run?.season ?? "",
    startDate: run?.startDate ? run.startDate.toISOString().slice(0, 10) : "",
    endDate: run?.endDate ? run.endDate.toISOString().slice(0, 10) : "",
    status: run?.status ?? "ACTIVE",
    notes: run?.notes ?? "",
  };
}
