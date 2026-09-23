"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import type { z } from "zod";
import {
  createWhatsappContactAction,
  updateWhatsappContactAction,
} from "@/app/actions/whatsapp.actions";
import { runAction } from "@/lib/offline/run-action";
import { localPhone } from "@/lib/phone";
import { whatsappContactSchema } from "@/lib/validations/whatsapp.schema";
import { FormField } from "@/components/shared/form-field";
import { ResponsiveFormDialog } from "@/components/shared/responsive-form-dialog";
import { SubmitButton } from "@/components/shared/submit-button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

/* El formulario trabaja con lo que TECLEA la gente (entrada del esquema) y
   manda lo que el esquema deja (salida): el número ya con lada. */
type FormInput = z.input<typeof whatsappContactSchema>;
type FormOutput = z.output<typeof whatsappContactSchema>;

export interface EditableContact {
  id: string;
  name: string;
  phone: string;
  active: boolean;
}

/**
 * Alta y edición de un contacto de WhatsApp.
 *
 * El número se teclea como se dicta —10 dígitos— y la lada se agrega sola.
 */
export function ContactFormDialog({
  contact,
  trigger,
}: {
  contact?: EditableContact;
  trigger: ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const form = useForm<FormInput, unknown, FormOutput>({
    resolver: zodResolver(whatsappContactSchema),
    defaultValues: toFormValues(contact),
  });

  const active = useWatch({ control: form.control, name: "active" }) ?? true;

  async function onSubmit(values: FormOutput) {
    const result = contact
      ? await runAction(() =>
          updateWhatsappContactAction({ id: contact.id, data: values }),
        )
      : await runAction(() => createWhatsappContactAction(values));

    if (!result.success) {
      // El número repetido se marca en su campo, no sólo en el aviso.
      if (result.field === "phone") {
        form.setError("phone", { message: result.error });
      }
      toast.error(result.error);
      return;
    }

    toast.success(contact ? "Contacto actualizado" : "Contacto agregado");
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
      title={contact ? `Editar ${contact.name}` : "Nuevo contacto"}
      description="A este número le llegará el PDF de las salidas que se apliquen."
      trigger={trigger}
    >
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="flex flex-col gap-4"
      >
        <FormField
          id="name"
          label="Nombre"
          placeholder="Taller Sitex"
          error={errors.name?.message}
          {...form.register("name")}
        />

        <FormField
          id="phone"
          label="Número de WhatsApp"
          type="tel"
          inputMode="tel"
          placeholder="229 123 4567"
          hint="Los 10 dígitos. Si es de fuera de México, con su lada."
          error={errors.phone?.message}
          {...form.register("phone")}
        />

        <div className="flat-surface flex items-center justify-between gap-3 p-3">
          <div className="flex flex-col gap-0.5">
            <Label htmlFor="active">Marcado al enviar</Label>
            <p className="text-xs text-muted-foreground">
              Apagado, sigue en la lista pero hay que marcarlo a mano.
            </p>
          </div>
          <Switch
            id="active"
            checked={active}
            onCheckedChange={(checked) =>
              form.setValue("active", checked, { shouldDirty: true })
            }
          />
        </div>

        <SubmitButton isSubmitting={form.formState.isSubmitting}>
          {contact ? "Guardar cambios" : "Agregar contacto"}
        </SubmitButton>
      </form>
    </ResponsiveFormDialog>
  );
}

function toFormValues(contact?: EditableContact): FormInput {
  return {
    name: contact?.name ?? "",
    phone: contact ? localPhone(contact.phone) : "",
    active: contact?.active ?? true,
  };
}
