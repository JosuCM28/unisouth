"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import type { z } from "zod";
import {
  createEmailContactAction,
  updateEmailContactAction,
} from "@/app/actions/email.actions";
import { runAction } from "@/lib/offline/run-action";
import { emailContactSchema } from "@/lib/validations/email.schema";
import { FormField } from "@/components/shared/form-field";
import { ResponsiveFormDialog } from "@/components/shared/responsive-form-dialog";
import { SubmitButton } from "@/components/shared/submit-button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

type FormInput = z.input<typeof emailContactSchema>;
type FormOutput = z.output<typeof emailContactSchema>;

export interface EditableEmailContact {
  id: string;
  name: string;
  email: string;
  active: boolean;
}

/** Alta y edición de un correo al que le llega el vale. */
export function EmailContactFormDialog({
  contact,
  trigger,
}: {
  contact?: EditableEmailContact;
  trigger: ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const form = useForm<FormInput, unknown, FormOutput>({
    resolver: zodResolver(emailContactSchema),
    defaultValues: toFormValues(contact),
  });

  const active = useWatch({ control: form.control, name: "active" }) ?? true;

  async function onSubmit(values: FormOutput) {
    const result = contact
      ? await runAction(() =>
          updateEmailContactAction({ id: contact.id, data: values }),
        )
      : await runAction(() => createEmailContactAction(values));

    if (!result.success) {
      // El correo repetido se marca en su campo, no sólo en el aviso.
      if (result.field === "email") {
        form.setError("email", { message: result.error });
      }
      toast.error(result.error);
      return;
    }

    toast.success(contact ? "Correo actualizado" : "Correo agregado");
    setOpen(false);
    if (!contact) form.reset(toFormValues());
    router.refresh();
  }

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) form.reset(toFormValues(contact));
  }

  const errors = form.formState.errors;

  return (
    <ResponsiveFormDialog
      open={open}
      onOpenChange={handleOpenChange}
      title={contact ? `Editar ${contact.name}` : "Nuevo correo"}
      description="A este correo le llegará el PDF de las salidas que se apliquen."
      trigger={trigger}
    >
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="flex flex-col gap-4"
      >
        <FormField
          id="email-name"
          label="Nombre"
          placeholder="Taller Sitex"
          error={errors.name?.message}
          {...form.register("name")}
        />

        <FormField
          id="email"
          label="Correo"
          type="email"
          inputMode="email"
          autoCapitalize="none"
          placeholder="taller@empresa.com"
          error={errors.email?.message}
          {...form.register("email")}
        />

        <div className="flat-surface flex items-center justify-between gap-3 p-3">
          <div className="flex flex-col gap-0.5">
            <Label htmlFor="email-active">Marcado al enviar</Label>
            <p className="text-xs text-muted-foreground">
              Apagado, sigue en la lista pero hay que marcarlo a mano.
            </p>
          </div>
          <Switch
            id="email-active"
            checked={active}
            onCheckedChange={(checked) =>
              form.setValue("active", checked, { shouldDirty: true })
            }
          />
        </div>

        <SubmitButton isSubmitting={form.formState.isSubmitting}>
          {contact ? "Guardar cambios" : "Agregar correo"}
        </SubmitButton>
      </form>
    </ResponsiveFormDialog>
  );
}

function toFormValues(contact?: EditableEmailContact): FormInput {
  return {
    name: contact?.name ?? "",
    email: contact?.email ?? "",
    active: contact?.active ?? true,
  };
}
