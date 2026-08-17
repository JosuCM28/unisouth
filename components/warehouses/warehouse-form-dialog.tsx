"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import type { Warehouse } from "@prisma/client";
import {
  createWarehouseAction,
  updateWarehouseAction,
} from "@/app/actions/warehouse.actions";
import {
  warehouseFormSchema,
  type WarehouseFormValues,
} from "@/lib/validations/warehouse.schema";
import { FormField } from "@/components/shared/form-field";
import { ResponsiveFormDialog } from "@/components/shared/responsive-form-dialog";
import { SubmitButton } from "@/components/shared/submit-button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface WarehouseFormDialogProps {
  /** Si viene, el formulario edita; si no, crea. */
  warehouse?: Warehouse;
  trigger: ReactNode;
}

/**
 * Alta y edición de almacén.
 *
 * Pocos campos: código y nombre bastan. Dirección y notas son para cuando hay
 * varias naves y hace falta distinguirlas ("la de la carretera").
 */
export function WarehouseFormDialog({
  warehouse,
  trigger,
}: WarehouseFormDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const isEditing = Boolean(warehouse);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<WarehouseFormValues>({
    resolver: zodResolver(warehouseFormSchema),
    defaultValues: toDefaults(warehouse),
  });

  async function onSubmit(values: WarehouseFormValues) {
    const payload = {
      ...values,
      address: values.address || undefined,
      notes: values.notes || undefined,
    };

    const result = isEditing
      ? await updateWarehouseAction({ ...payload, id: warehouse!.id })
      : await createWarehouseAction(payload);

    if (!result.success) {
      if (result.field && result.field in values) {
        setError(result.field as keyof WarehouseFormValues, {
          message: result.error,
        });
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
      open={open}
      onOpenChange={setOpen}
      trigger={trigger}
      title={isEditing ? `Editar ${warehouse!.name}` : "Nuevo almacén"}
      description="Un edificio o patio con sus propias ubicaciones."
    >
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
        <FormField
          id="code"
          label="Código"
          placeholder="BODEGA"
          autoCapitalize="characters"
          error={errors.code?.message}
          {...register("code")}
        />

        <FormField
          id="name"
          label="Nombre"
          placeholder="Bodega principal"
          error={errors.name?.message}
          {...register("name")}
        />

        <FormField
          id="address"
          label="Dirección"
          placeholder="Carretera Veracruz km 4"
          error={errors.address?.message}
          {...register("address")}
        />

        <div className="flex flex-col gap-2">
          <Label htmlFor="notes">Notas</Label>
          <Textarea
            id="notes"
            rows={2}
            placeholder="Sólo tela de Ternium"
            {...register("notes")}
          />
        </div>

        <div className="flex items-start justify-between gap-3 border border-border p-3">
          <Label htmlFor="isDefault" className="cursor-pointer">
            Almacén principal
            <span className="mt-1 block text-xs font-normal text-muted-foreground">
              Los rollos que se den de alta sin elegir almacén caen aquí. Sólo
              uno puede serlo: al marcar éste, el anterior deja de serlo.
            </span>
          </Label>
          <Switch
            id="isDefault"
            checked={watch("isDefault")}
            onCheckedChange={(checked) =>
              setValue("isDefault", checked, { shouldDirty: true })
            }
          />
        </div>

        <div className="flex items-center justify-between gap-3">
          <Label htmlFor="active" className="cursor-pointer">
            Activo
          </Label>
          <Switch
            id="active"
            checked={watch("active")}
            onCheckedChange={(checked) =>
              setValue("active", checked, { shouldDirty: true })
            }
          />
        </div>

        <SubmitButton isSubmitting={isSubmitting}>
          {isEditing ? "Guardar cambios" : "Crear almacén"}
        </SubmitButton>
      </form>
    </ResponsiveFormDialog>
  );
}

function toDefaults(warehouse?: Warehouse): WarehouseFormValues {
  return {
    code: warehouse?.code ?? "",
    name: warehouse?.name ?? "",
    address: warehouse?.address ?? "",
    notes: warehouse?.notes ?? "",
    isDefault: warehouse?.isDefault ?? false,
    active: warehouse?.active ?? true,
  };
}
