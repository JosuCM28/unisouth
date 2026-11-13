"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import {
  createGarmentCategoryAction,
  updateGarmentCategoryAction,
} from "@/app/actions/garment-category.actions";
import { runAction } from "@/lib/offline/run-action";
import {
  garmentCategoryFormSchema,
  type GarmentCategoryFormValues,
} from "@/lib/validations/garment-category.schema";
import { FormField } from "@/components/shared/form-field";
import { ResponsiveFormDialog } from "@/components/shared/responsive-form-dialog";
import { SubmitButton } from "@/components/shared/submit-button";

export interface EditableGarmentCategory {
  id: string;
  name: string;
  position: number;
}

/**
 * Alta y edición de un tipo de prenda. No se encola sin señal: es un
 * catálogo que se toca una vez al mes, y un nombre repetido que rebotara al
 * subir sólo dejaría un pendiente que nadie entiende.
 */
export function GarmentCategoryFormDialog({
  category,
  trigger,
}: {
  category?: EditableGarmentCategory;
  trigger: ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const form = useForm<GarmentCategoryFormValues>({
    resolver: zodResolver(garmentCategoryFormSchema),
    defaultValues: toFormValues(category),
  });

  async function onSubmit(values: GarmentCategoryFormValues) {
    const payload = { name: values.name, position: values.position || 0 };
    const result = category
      ? await runAction(() => updateGarmentCategoryAction({ id: category.id, data: payload }))
      : await runAction(() => createGarmentCategoryAction(payload));

    if (!result.success) {
      if (result.field === "name") form.setError("name", { message: result.error });
      toast.error(result.error);
      return;
    }

    toast.success(result.message ?? "Guardado");
    setOpen(false);
    if (!category) form.reset(toFormValues());
    router.refresh();
  }

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) form.reset(toFormValues(category));
  }

  const errors = form.formState.errors;

  return (
    <ResponsiveFormDialog
      open={open}
      onOpenChange={handleOpenChange}
      title={category ? `Editar ${category.name}` : "Nuevo tipo de prenda"}
      description="Lo que filtra el inventario de Embarques y sale en el packing list."
      trigger={trigger}
    >
      <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">
        <FormField id="category-name" label="Nombre" placeholder="Camisa"
          className="uppercase" error={errors.name?.message} {...form.register("name")} />
        <FormField id="category-position" label="Orden" inputMode="numeric"
          hint="Sólo acomoda filtros y el packing list." {...form.register("position")} />
        <SubmitButton isSubmitting={form.formState.isSubmitting} className="h-12 w-full">
          {category ? "Guardar cambios" : "Agregar"}
        </SubmitButton>
      </form>
    </ResponsiveFormDialog>
  );
}

function toFormValues(category?: EditableGarmentCategory): GarmentCategoryFormValues {
  return {
    name: category?.name ?? "",
    position: category ? String(category.position) : "",
  };
}
