"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { z } from "zod";
import {
  createProcessStageAction,
  updateProcessStageAction,
} from "@/app/actions/garment-shipment.actions";
import { runAction } from "@/lib/offline/run-action";
import { FormField } from "@/components/shared/form-field";
import { ResponsiveFormDialog } from "@/components/shared/responsive-form-dialog";
import { SubmitButton } from "@/components/shared/submit-button";

const formSchema = z.object({
  code: z.string().min(1, "Escribe una clave corta"),
  name: z.string().min(1, "Escribe el nombre de la etapa"),
  position: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

export interface EditableProcessStage {
  id: string;
  code: string;
  name: string;
  position: number;
}

/**
 * Alta y edición de una etapa del proceso.
 *
 * El orden es una SUGERENCIA para leer el tablero, no una ruta: cada envío
 * elige su etapa libremente, porque una talla puede saltarse el bordado y
 * otra necesitar dos pasadas por el mismo taller.
 */
export function ProcessStageFormDialog({
  stage,
  trigger,
}: {
  stage?: EditableProcessStage;
  trigger: ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: toFormValues(stage),
  });

  async function onSubmit(values: FormValues) {
    const payload = {
      code: values.code,
      name: values.name,
      position: values.position || 0,
    };

    const result = stage
      ? await runAction(() =>
          updateProcessStageAction({ id: stage.id, data: payload }),
        )
      : await runAction(() => createProcessStageAction(payload));

    if (!result.success) {
      toast.error(result.error);
      return;
    }

    toast.success(stage ? "Etapa actualizada" : "Etapa agregada");
    setOpen(false);
    if (!stage) form.reset(toFormValues());
    router.refresh();
  }

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) form.reset(toFormValues(stage));
  }

  const errors = form.formState.errors;

  return (
    <ResponsiveFormDialog
      open={open}
      onOpenChange={handleOpenChange}
      title={stage ? `Editar ${stage.name}` : "Nueva etapa"}
      description="Un proceso por el que pasan las prendas ya cortadas."
      trigger={trigger}
    >
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="flex flex-col gap-4"
      >
        <FormField
          id="name"
          label="Nombre"
          placeholder="Bordado"
          error={errors.name?.message}
          {...form.register("name")}
        />

        <FormField
          id="code"
          label="Clave"
          placeholder="BORD"
          error={errors.code?.message}
          {...form.register("code")}
        />

        <FormField
          id="position"
          label="Orden"
          inputMode="numeric"
          hint="Sólo para acomodar el tablero. No obliga a seguir esa secuencia."
          {...form.register("position")}
        />

        <SubmitButton
          isSubmitting={form.formState.isSubmitting}
          className="h-12 w-full"
        >
          {stage ? "Guardar cambios" : "Agregar etapa"}
        </SubmitButton>
      </form>
    </ResponsiveFormDialog>
  );
}

function toFormValues(stage?: EditableProcessStage): FormValues {
  return {
    code: stage?.code ?? "",
    name: stage?.name ?? "",
    position: stage ? String(stage.position) : "",
  };
}
