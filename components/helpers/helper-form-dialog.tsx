"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import type { Helper } from "@prisma/client";
import { createHelperAction, updateHelperAction } from "@/app/actions/helper.actions";
import { helperFormSchema, type HelperFormValues } from "@/lib/validations/helper.schema";
import { runAction } from "@/lib/offline/run-action";
import { FormField } from "@/components/shared/form-field";
import { FormSection } from "@/components/shared/form-section";
import { ResponsiveFormDialog } from "@/components/shared/responsive-form-dialog";
import { SubmitButton } from "@/components/shared/submit-button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

const FIELDS = Object.keys(helperFormSchema.shape) as (keyof HelperFormValues)[];

interface Props {
  helper?: Helper;
  trigger: ReactNode;
  /** Avisa del ayudante recién creado, para seleccionarlo en la recepción. */
  onCreated?: (helper: { id: string; name: string }) => void;
}

export function HelperFormDialog({ helper, trigger, onCreated }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const isEditing = Boolean(helper);

  const { register, handleSubmit, setValue, watch, setError, reset, formState: { errors, isSubmitting } } =
    useForm<HelperFormValues>({
      resolver: zodResolver(helperFormSchema),
      defaultValues: toDefaults(helper),
    });

  async function onSubmit(values: HelperFormValues) {
    const payload = {
      ...values,
      code: values.code || undefined,
      phone: values.phone || undefined,
      notes: values.notes || undefined,
    };

    const result = isEditing
      ? await runAction(() => updateHelperAction({ id: helper!.id, data: payload }))
      : await runAction(() => createHelperAction(payload));

    if (!result.success) {
      if (result.field && FIELDS.includes(result.field as keyof HelperFormValues)) {
        setError(result.field as keyof HelperFormValues, { message: result.error });
      }
      toast.error(result.error);
      return;
    }

    toast.success(result.message ?? "Guardado");
    setOpen(false);

    if (!isEditing) {
      reset(toDefaults());
      const created = result.data as { id: string; name: string } | undefined;
      if (created?.id) onCreated?.(created);
    }

    router.refresh();
  }

  return (
    <ResponsiveFormDialog
      open={open} onOpenChange={setOpen} trigger={trigger}
      title={isEditing ? "Editar ayudante" : "Nuevo ayudante"}
      description="Quien baja el material del camión. Sólo el nombre es obligatorio."
    >
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
        <FormField id="helper-name" label="Nombre" placeholder="Miguel Ángel Ruiz"
          autoComplete="off" error={errors.name?.message} {...register("name")} />

        <FormSection title="Datos adicionales">
          <FormField id="helper-code" label="Código o número de empleado"
            className="tabular uppercase" {...register("code")} />
          <FormField id="helper-phone" label="Teléfono" inputMode="tel"
            className="tabular" {...register("phone")} />

          <div className="flex flex-col gap-2">
            <Label htmlFor="helper-notes">Notas</Label>
            <Textarea id="helper-notes" rows={2} {...register("notes")} />
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="helper-active" className="cursor-pointer">Activo</Label>
            <Switch id="helper-active" checked={watch("active")}
              onCheckedChange={(c) => setValue("active", c)} />
          </div>
        </FormSection>

        <SubmitButton isSubmitting={isSubmitting} pendingLabel="Guardando…" className="w-full">
          {isEditing ? "Guardar cambios" : "Registrar ayudante"}
        </SubmitButton>
      </form>
    </ResponsiveFormDialog>
  );
}

function toDefaults(helper?: Helper): HelperFormValues {
  return {
    name: helper?.name ?? "", code: helper?.code ?? "",
    phone: helper?.phone ?? "", notes: helper?.notes ?? "",
    active: helper?.active ?? true,
  };
}
