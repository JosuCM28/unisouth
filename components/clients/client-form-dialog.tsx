"use client";

import { useState, type ReactNode } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import type { Client } from "@prisma/client";
import { updateClientAction } from "@/app/actions/client.actions";
import { submitOrQueue } from "@/lib/offline/submit";
import { runAction } from "@/lib/offline/run-action";
import { notifyQueueChanged } from "@/hooks/use-offline-queue";
import {
  clientFormSchema,
  type ClientFormValues,
} from "@/lib/validations/client.schema";
import { FormField } from "@/components/shared/form-field";
import { FormSection } from "@/components/shared/form-section";
import { ResponsiveFormDialog } from "@/components/shared/responsive-form-dialog";
import { SubmitButton } from "@/components/shared/submit-button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

interface ClientFormDialogProps {
  client?: Client;
  trigger: ReactNode;
}

const FORM_FIELDS = Object.keys(
  clientFormSchema.shape,
) as (keyof ClientFormValues)[];

export function ClientFormDialog({ client, trigger }: ClientFormDialogProps) {
  const [open, setOpen] = useState(false);
  const isEditing = Boolean(client);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    setError,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ClientFormValues>({
    resolver: zodResolver(clientFormSchema),
    defaultValues: toDefaults(client),
  });

  function applyFieldError(field: string | undefined, message: string) {
    if (!field) return;
    if (!FORM_FIELDS.includes(field as keyof ClientFormValues)) return;

    setError(field as keyof ClientFormValues, { message });
  }

  async function onSubmit(values: ClientFormValues) {
    // Los vacíos se omiten para que Zod los reciba como undefined y no como "".
    const payload = Object.fromEntries(
      Object.entries(values).map(([key, value]) =>
        value === "" ? [key, undefined] : [key, value],
      ),
    );

    if (isEditing) {
      const result = await runAction(() => updateClientAction({ id: client!.id, data: payload }));

      if (!result.success) {
        applyFieldError(result.field, result.error);
        toast.error(result.error);
        return;
      }

      toast.success(result.message ?? "Guardado");
      setOpen(false);
      return;
    }

    const outcome = await submitOrQueue("client.create", payload, values.name);

    if (outcome.status === "failed") {
      applyFieldError(outcome.field, outcome.error);
      toast.error(outcome.error);
      return;
    }

    if (outcome.status === "queued") {
      toast.warning("Cliente guardado sin conexión", {
        description: "Se dará de alta solo al volver el internet.",
      });
      notifyQueueChanged();
      reset(toDefaults());
      setOpen(false);
      return;
    }

    toast.success(outcome.message ?? "Guardado");
    setOpen(false);
    reset(toDefaults());
  }

  return (
    <ResponsiveFormDialog
      open={open}
      onOpenChange={setOpen}
      trigger={trigger}
      title={isEditing ? "Editar cliente" : "Nuevo cliente"}
      description={
        isEditing
          ? `Modifica los datos de ${client!.name}.`
          : "Sólo el nombre es obligatorio."
      }
    >
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
        <FormField
          id="name"
          label="Nombre"
          placeholder="Ternium"
          autoComplete="off"
          error={errors.name?.message}
          {...register("name")}
        />

        <FormSection title="Datos fiscales y contacto">
          <FormField
            id="code"
            label="Código"
            placeholder="TERNIUM"
            className="tabular uppercase"
            {...register("code")}
          />
          <FormField
            id="legalName"
            label="Razón social"
            placeholder="Ternium México, S.A. de C.V."
            {...register("legalName")}
          />
          <FormField id="taxId" label="RFC" className="tabular uppercase" {...register("taxId")} />
          <FormField id="contact" label="Contacto" {...register("contact")} />
          <FormField id="phone" label="Teléfono" inputMode="tel" className="tabular" {...register("phone")} />
          <FormField id="email" label="Correo" inputMode="email" autoCapitalize="none" {...register("email")} />

          <div className="flex flex-col gap-2">
            <Label htmlFor="notes">Notas</Label>
            <Textarea id="notes" rows={2} {...register("notes")} />
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="active" className="cursor-pointer">Activo</Label>
            <Switch
              id="active"
              checked={watch("active")}
              onCheckedChange={(checked) => setValue("active", checked, { shouldDirty: true })}
            />
          </div>
        </FormSection>

        <SubmitButton isSubmitting={isSubmitting} pendingLabel="Guardando…" className="w-full">
          {isEditing ? "Guardar cambios" : "Crear cliente"}
        </SubmitButton>
      </form>
    </ResponsiveFormDialog>
  );
}

function toDefaults(client?: Client): ClientFormValues {
  return {
    name: client?.name ?? "",
    code: client?.code ?? "",
    legalName: client?.legalName ?? "",
    taxId: client?.taxId ?? "",
    contact: client?.contact ?? "",
    phone: client?.phone ?? "",
    email: client?.email ?? "",
    notes: client?.notes ?? "",
    active: client?.active ?? true,
  };
}
