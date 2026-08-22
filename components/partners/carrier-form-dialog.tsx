"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import type { Carrier } from "@prisma/client";
import { createCarrierAction, updateCarrierAction } from "@/app/actions/partner.actions";
import { carrierFormSchema, type CarrierFormValues } from "@/lib/validations/partner.schema";
import { runAction } from "@/lib/offline/run-action";
import { FormField } from "@/components/shared/form-field";
import { ResponsiveFormDialog } from "@/components/shared/responsive-form-dialog";
import { SubmitButton } from "@/components/shared/submit-button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

const FIELDS = Object.keys(carrierFormSchema.shape) as (keyof CarrierFormValues)[];

export function CarrierFormDialog({ carrier, trigger }: { carrier?: Carrier; trigger: ReactNode }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const isEditing = Boolean(carrier);

  const { register, handleSubmit, setValue, watch, setError, reset, formState: { errors, isSubmitting } } =
    useForm<CarrierFormValues>({
      resolver: zodResolver(carrierFormSchema),
      defaultValues: toDefaults(carrier),
    });

  async function onSubmit(values: CarrierFormValues) {
    const payload = {
      ...values,
      phone: values.phone || undefined,
      trackingUrl: values.trackingUrl || undefined,
    };

    const result = isEditing
      ? await runAction(() => updateCarrierAction({ id: carrier!.id, data: payload }))
      : await runAction(() => createCarrierAction(payload));

    if (!result.success) {
      if (result.field && FIELDS.includes(result.field as keyof CarrierFormValues)) {
        setError(result.field as keyof CarrierFormValues, { message: result.error });
      }
      toast.error(result.error);
      return;
    }

    toast.success(result.message ?? "Guardado");
    setOpen(false);
    if (!isEditing) reset(toDefaults());
    router.refresh();
  }

  return (
    <ResponsiveFormDialog
      open={open} onOpenChange={setOpen} trigger={trigger}
      title={isEditing ? "Editar paquetería" : "Nueva paquetería"}
      description="Quién trae la carga. Sólo el nombre es obligatorio."
    >
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
        <FormField id="carrier-name" label="Nombre" placeholder="Estafeta"
          autoComplete="off" error={errors.name?.message} {...register("name")} />

        <FormField id="carrier-phone" label="Teléfono" inputMode="tel"
          className="tabular" {...register("phone")} />

        <FormField id="carrier-tracking" label="Liga de rastreo"
          placeholder="https://www.estafeta.com/rastreo"
          hint="Para abrir el rastreo con el número de guía."
          autoCapitalize="none" {...register("trackingUrl")} />

        <div className="flex items-center justify-between">
          <Label htmlFor="carrier-active" className="cursor-pointer">Activa</Label>
          <Switch id="carrier-active" checked={watch("active")}
            onCheckedChange={(c) => setValue("active", c)} />
        </div>

        <SubmitButton isSubmitting={isSubmitting} pendingLabel="Guardando…" className="w-full">
          {isEditing ? "Guardar cambios" : "Crear paquetería"}
        </SubmitButton>
      </form>
    </ResponsiveFormDialog>
  );
}

function toDefaults(carrier?: Carrier): CarrierFormValues {
  return {
    name: carrier?.name ?? "",
    phone: carrier?.phone ?? "",
    trackingUrl: carrier?.trackingUrl ?? "",
    active: carrier?.active ?? true,
  };
}
