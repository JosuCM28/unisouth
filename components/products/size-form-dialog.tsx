"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import type { Size } from "@prisma/client";
import type { PlainObject } from "@/lib/utils";

/**
 * El tipo que de verdad cruza la frontera.
 *
 * `Size` de Prisma trae `consumptionFactor` como Decimal, que es una
 * instancia de clase y React no puede serializar. Este alias obliga a que la
 * página convierta con toPlainObject antes de pasarlo: si se olvida, falla el
 * compilador y no el navegador del auxiliar.
 */
type PlainSize = PlainObject<Size>;
import { createSizeAction, updateSizeAction } from "@/app/actions/product.actions";
import { sizeFormSchema, type SizeFormValues } from "@/lib/validations/product.schema";
import { FormField } from "@/components/shared/form-field";
import { ResponsiveFormDialog } from "@/components/shared/responsive-form-dialog";
import { SubmitButton } from "@/components/shared/submit-button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

const FIELDS = Object.keys(sizeFormSchema.shape) as (keyof SizeFormValues)[];

export function SizeFormDialog({ size, trigger }: { size?: PlainSize; trigger: ReactNode }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const isEditing = Boolean(size);

  const { register, handleSubmit, setValue, watch, setError, reset, formState: { errors, isSubmitting } } =
    useForm<SizeFormValues>({
      resolver: zodResolver(sizeFormSchema),
      defaultValues: toDefaults(size),
    });

  async function onSubmit(values: SizeFormValues) {
    const payload = {
      ...values,
      order: values.order || 0,
      group: values.group || undefined,
    };

    const result = isEditing
      ? await updateSizeAction({ id: size!.id, data: payload })
      : await createSizeAction(payload);

    if (!result.success) {
      if (result.field && FIELDS.includes(result.field as keyof SizeFormValues)) {
        setError(result.field as keyof SizeFormValues, { message: result.error });
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
      title={isEditing ? "Editar talla" : "Nueva talla"}
      description="El factor escala el consumo: la G gasta 1.08 veces lo de la M."
    >
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3">
          <FormField id="code" label="Código" placeholder="G"
            className="tabular uppercase" error={errors.code?.message} {...register("code")} />
          <FormField id="order" label="Orden" inputMode="numeric" placeholder="3"
            className="tabular" {...register("order")} />
        </div>

        <FormField id="name" label="Nombre" placeholder="Grande"
          error={errors.name?.message} {...register("name")} />

        <FormField id="consumptionFactor" label="Factor de consumo" inputMode="decimal"
          placeholder="1.08"
          hint="1.00 = talla base. Editarlo NO recalcula los cálculos ya guardados."
          className="tabular text-lg" error={errors.consumptionFactor?.message}
          {...register("consumptionFactor")} />

        <FormField id="group" label="Grupo" placeholder="letra" {...register("group")} />

        <div className="flex items-center justify-between">
          <Label htmlFor="active" className="cursor-pointer">Activa</Label>
          <Switch id="active" checked={watch("active")} onCheckedChange={(c) => setValue("active", c)} />
        </div>

        <SubmitButton isSubmitting={isSubmitting} pendingLabel="Guardando…" className="w-full">
          {isEditing ? "Guardar cambios" : "Crear talla"}
        </SubmitButton>
      </form>
    </ResponsiveFormDialog>
  );
}

function toDefaults(size?: PlainSize): SizeFormValues {
  return {
    code: size?.code ?? "", name: size?.name ?? "",
    order: size?.order ? String(size.order) : "",
    consumptionFactor: size?.consumptionFactor ? String(size.consumptionFactor) : "1.00",
    group: size?.group ?? "", active: size?.active ?? true,
  };
}
