"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { z } from "zod";
import {
  createCutTagAction,
  updateCutTagAction,
} from "@/app/actions/cut-tag.actions";
import { runAction } from "@/lib/offline/run-action";
import { FormField } from "@/components/shared/form-field";
import { ResponsiveFormDialog } from "@/components/shared/responsive-form-dialog";
import { SubmitButton } from "@/components/shared/submit-button";
import { Label } from "@/components/ui/label";

/** Esquema del formulario: todo texto, como lo entrega un `<input>`. */
const formSchema = z.object({
  name: z.string().min(1, "Escribe el nombre del color"),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Elige un color"),
  order: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

export interface EditableCutTag {
  id: string;
  name: string;
  color: string;
  order: number;
}

/**
 * Sugerencias rápidas: los colores de papel que se consiguen en papelería.
 *
 * Es un atajo, no un límite: el selector de abajo permite cualquier color.
 */
const SUGGESTIONS = [
  "#1d4ed8",
  "#15803d",
  "#ea580c",
  "#facc15",
  "#b91c1c",
  "#7e22ce",
  "#ec4899",
  "#78350f",
  "#1c1917",
  "#ffffff",
  "#0891b2",
  "#84cc16",
  "#a8a29e",
  "#f5f5dc",
];

/**
 * Alta y edición de un foleo.
 *
 * El color se elige con el selector nativo del sistema: es el que la gente ya
 * sabe usar y en celular abre la rueda de color a pantalla completa.
 */
export function CutTagFormDialog({
  tag,
  trigger,
}: {
  tag?: EditableCutTag;
  trigger: ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: toFormValues(tag),
  });

  const color = form.watch("color");

  async function onSubmit(values: FormValues) {
    const payload = {
      name: values.name,
      color: values.color,
      order: values.order || 0,
    };

    const result = tag
      ? await runAction(() => updateCutTagAction({ id: tag.id, data: payload }))
      : await runAction(() => createCutTagAction(payload));

    if (!result.success) {
      toast.error(result.error);
      return;
    }

    toast.success(tag ? "Foleo actualizado" : "Foleo agregado");
    setOpen(false);
    if (!tag) form.reset(toFormValues());
    router.refresh();
  }

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) form.reset(toFormValues(tag));
  }

  const errors = form.formState.errors;

  return (
    <ResponsiveFormDialog
      open={open}
      onOpenChange={handleOpenChange}
      title={tag ? `Editar ${tag.name}` : "Nuevo foleo"}
      description="El color del papelito que se engrapa al bulto."
      trigger={trigger}
    >
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="flex flex-col gap-4"
      >
        <FormField
          id="name"
          label="Nombre"
          placeholder="Azul rey"
          error={errors.name?.message}
          {...form.register("name")}
        />

        <div className="flex flex-col gap-2">
          <Label htmlFor="color">Color</Label>

          <div className="flex items-center gap-3">
            <input
              id="color"
              type="color"
              className="touch-target h-11 w-16 shrink-0 cursor-pointer border border-border bg-card p-1"
              {...form.register("color")}
            />
            {/* El hex a la vista y editable: a veces el color viene dado por
                una referencia exacta y es más rápido pegarlo que buscarlo. */}
            <input
              type="text"
              inputMode="text"
              aria-label="Código de color"
              className="tabular touch-target w-32 border border-border bg-card px-3 text-sm"
              value={color}
              onChange={(event) =>
                form.setValue("color", event.target.value, {
                  shouldDirty: true,
                })
              }
            />
            <span
              className="size-8 shrink-0 border border-border"
              style={{ backgroundColor: isHex(color) ? color : undefined }}
              aria-hidden
            />
          </div>

          {errors.color && (
            <p className="text-sm text-destructive">{errors.color.message}</p>
          )}

          <div className="flex flex-wrap gap-1.5 pt-1">
            {SUGGESTIONS.map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                aria-label={`Usar ${suggestion}`}
                className="size-7 border border-border"
                style={{ backgroundColor: suggestion }}
                onClick={() =>
                  form.setValue("color", suggestion, { shouldDirty: true })
                }
              />
            ))}
          </div>
        </div>

        <FormField
          id="order"
          label="Orden"
          inputMode="numeric"
          hint="Los más usados con el número más bajo salen primero."
          error={errors.order?.message}
          {...form.register("order")}
        />

        <SubmitButton isSubmitting={form.formState.isSubmitting}>
          {tag ? "Guardar cambios" : "Agregar foleo"}
        </SubmitButton>
      </form>
    </ResponsiveFormDialog>
  );
}

function isHex(value: string): boolean {
  return /^#[0-9a-fA-F]{6}$/.test(value);
}

function toFormValues(tag?: EditableCutTag): FormValues {
  return {
    name: tag?.name ?? "",
    // Un azul por omisión: el selector nativo necesita un valor válido.
    color: tag?.color ?? "#1d4ed8",
    order: tag?.order?.toString() ?? "0",
  };
}
