"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { z } from "zod";
import {
  createWorkshopAction,
  updateWorkshopAction,
} from "@/app/actions/garment-shipment.actions";
import { ROLE_LABELS } from "@/lib/constants/roles";
import { WORKSHOP_ROLES } from "@/lib/constants/workshop-access";
import { runAction } from "@/lib/offline/run-action";
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

/** Sólo el nombre es obligatorio: dar de alta un taller son 10 segundos. */
const formSchema = z.object({
  name: z.string().min(1, "Escribe el nombre del taller"),
  code: z.string().optional(),
  contact: z.string().optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
  notes: z.string().optional(),
  accessRole: z.string(),
});

/* Radix no admite un valor vacío en sus opciones, así que "sin cuenta" necesita
   un valor propio que se traduce a `null` al guardar. */
const NO_ACCESS = "none";

type FormValues = z.infer<typeof formSchema>;

export interface EditableWorkshop {
  id: string;
  name: string;
  code: string | null;
  contact: string | null;
  phone: string | null;
  address: string | null;
  notes: string | null;
  accessRole: string | null;
}

export function WorkshopFormDialog({
  workshop,
  trigger,
}: {
  workshop?: EditableWorkshop;
  trigger: ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: toFormValues(workshop),
  });

  async function onSubmit(values: FormValues) {
    const data = {
      ...values,
      accessRole: values.accessRole === NO_ACCESS ? null : values.accessRole,
    };

    const result = workshop
      ? await runAction(() =>
          updateWorkshopAction({ id: workshop.id, data }),
        )
      : await runAction(() => createWorkshopAction(data));

    if (!result.success) {
      toast.error(result.error);
      return;
    }

    toast.success(workshop ? "Taller actualizado" : "Taller agregado");
    setOpen(false);
    if (!workshop) form.reset(toFormValues());
    router.refresh();
  }

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) form.reset(toFormValues(workshop));
  }

  const errors = form.formState.errors;

  return (
    <ResponsiveFormDialog
      open={open}
      onOpenChange={handleOpenChange}
      title={workshop ? `Editar ${workshop.name}` : "Nuevo taller"}
      description="Quien borda, arma o lava las prendas ya cortadas."
      trigger={trigger}
    >
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="flex flex-col gap-4"
      >
        <FormField
          id="name"
          label="Nombre"
          placeholder="Bordados del Golfo"
          error={errors.name?.message}
          {...form.register("name")}
        />

        <FormSelectField
          id="accessRole"
          label="Cuenta de acceso"
          hint="Quien entre con este rol verá lo que le mandes a este taller."
          error={errors.accessRole?.message}
        >
          <Controller
            control={form.control}
            name="accessRole"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger id="accessRole" className="touch-target w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_ACCESS}>Sin cuenta</SelectItem>
                  {WORKSHOP_ROLES.map((role) => (
                    <SelectItem key={role} value={role}>
                      {ROLE_LABELS[role]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </FormSelectField>

        {/* Lo demás plegado: se llena cuando hace falta, no al dar de alta. */}
        <FormSection title="Contacto">
          <div className="flex flex-col gap-4">
            <FormField
              id="code"
              label="Clave"
              placeholder="BG"
              {...form.register("code")}
            />
            <FormField
              id="contact"
              label="Quién atiende"
              {...form.register("contact")}
            />
            <FormField
              id="phone"
              label="Teléfono"
              inputMode="tel"
              {...form.register("phone")}
            />
            <FormField
              id="address"
              label="Dirección"
              {...form.register("address")}
            />
            <FormField id="notes" label="Notas" {...form.register("notes")} />
          </div>
        </FormSection>

        <SubmitButton
          isSubmitting={form.formState.isSubmitting}
          className="h-12 w-full"
        >
          {workshop ? "Guardar cambios" : "Agregar taller"}
        </SubmitButton>
      </form>
    </ResponsiveFormDialog>
  );
}

function toFormValues(workshop?: EditableWorkshop): FormValues {
  return {
    name: workshop?.name ?? "",
    code: workshop?.code ?? "",
    contact: workshop?.contact ?? "",
    phone: workshop?.phone ?? "",
    address: workshop?.address ?? "",
    notes: workshop?.notes ?? "",
    accessRole: workshop?.accessRole ?? NO_ACCESS,
  };
}
