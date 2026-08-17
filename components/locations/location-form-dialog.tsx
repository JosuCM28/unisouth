"use client";

import { useState, type ReactNode } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import type { Location, LocationType } from "@prisma/client";
import {
  createLocationAction,
  updateLocationAction,
} from "@/app/actions/location.actions";
import { LOCATION_TYPE_LABELS, toSelectOptions } from "@/lib/constants/labels";
import {
  locationFormSchema,
  type LocationFormValues,
} from "@/lib/validations/location.schema";
import { FormField, FormSelectField } from "@/components/shared/form-field";
import { FormSection } from "@/components/shared/form-section";
import { ResponsiveFormDialog } from "@/components/shared/responsive-form-dialog";
import { SubmitButton } from "@/components/shared/submit-button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

interface LocationFormDialogProps {
  /** Si viene, el formulario edita; si no, crea. */
  location?: Location;
  parents?: Pick<Location, "id" | "code" | "name">[];
  warehouses: { id: string; code: string; name: string }[];
  trigger: ReactNode;
}

const TYPE_OPTIONS = toSelectOptions(LOCATION_TYPE_LABELS);

const FORM_FIELDS = Object.keys(
  locationFormSchema.shape,
) as (keyof LocationFormValues)[];

export function LocationFormDialog({
  location,
  parents = [],
  warehouses,
  trigger,
}: LocationFormDialogProps) {
  const [open, setOpen] = useState(false);
  const isEditing = Boolean(location);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    setError,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<LocationFormValues>({
    resolver: zodResolver(locationFormSchema),
    defaultValues: toDefaults(location, warehouses),
  });

  async function onSubmit(values: LocationFormValues) {
    const payload = {
      ...values,
      order: values.order || undefined,
      lotCapacity: values.lotCapacity || undefined,
      parentId: values.parentId || undefined,
      notes: values.notes || undefined,
    };

    const result = isEditing
      ? await updateLocationAction({ ...payload, id: location!.id })
      : await createLocationAction(payload);

    if (!result.success) {
      // Se valida contra las claves del esquema, no contra `values`: un campo
      // opcional vacío no aparece en el objeto y quedaría sin marcar.
      if (
        result.field &&
        FORM_FIELDS.includes(result.field as keyof LocationFormValues)
      ) {
        setError(result.field as keyof LocationFormValues, {
          message: result.error,
        });
      }
      toast.error(result.error);
      return;
    }

    toast.success(result.message ?? "Guardado");
    setOpen(false);
    // Sólo al crear: al editar, conservar los valores permite corregir algo
    // y volver a abrir sin recapturar todo.
    if (!isEditing) reset(toDefaults(undefined, warehouses));
  }

  return (
    <ResponsiveFormDialog
      open={open}
      onOpenChange={setOpen}
      trigger={trigger}
      title={isEditing ? "Editar ubicación" : "Nueva ubicación"}
      description={
        isEditing
          ? `Modifica los datos de ${location!.code}.`
          : "Sólo el código y el nombre son obligatorios."
      }
    >
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
        {/* El almacén va primero: es el que da contexto al código de abajo.
            "F1" sólo significa algo una vez que se sabe de qué nave se habla. */}
        <FormSelectField id="warehouseId" label="Almacén" error={errors.warehouseId?.message}>
          <Select
            value={watch("warehouseId")}
            onValueChange={(value) =>
              setValue("warehouseId", value, { shouldDirty: true })
            }
          >
            <SelectTrigger id="warehouseId" className="touch-target w-full">
              <SelectValue placeholder="Elige el almacén" />
            </SelectTrigger>
            <SelectContent>
              {warehouses.map((warehouse) => (
                <SelectItem key={warehouse.id} value={warehouse.id}>
                  {warehouse.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormSelectField>

        {/* Los dos obligatorios, arriba y a la vista. */}
        <FormField
          id="code"
          label="Código"
          placeholder="F1"
          autoCapitalize="characters"
          autoComplete="off"
          className="tabular uppercase"
          error={errors.code?.message}
          {...register("code")}
        />

        <FormField
          id="name"
          label="Nombre"
          placeholder="Fila 1"
          autoComplete="off"
          error={errors.name?.message}
          {...register("name")}
        />

        {/* El resto va plegado: mostrarlo todo de golpe hace que el auxiliar
            crea que son ocho campos obligatorios y abandone la captura. */}
        <FormSection title="Opcional">
          <FormSelectField id="type" label="Tipo">
            <Select
              value={watch("type")}
              onValueChange={(value) =>
                setValue("type", value as LocationType, { shouldDirty: true })
              }
            >
              <SelectTrigger id="type" className="touch-target w-full">
                <SelectValue placeholder="Elige el tipo" />
              </SelectTrigger>
              <SelectContent>
                {TYPE_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormSelectField>

          <div className="grid grid-cols-2 gap-3">
            <FormField
              id="order"
              label="Orden"
              inputMode="numeric"
              placeholder="1"
              className="tabular"
              {...register("order")}
            />

            <FormField
              id="lotCapacity"
              label="Capacidad"
              inputMode="numeric"
              placeholder="Rollos"
              className="tabular"
              {...register("lotCapacity")}
            />
          </div>

          {parents.length > 0 && (
            <FormSelectField id="parentId" label="Pertenece a">
              <Select
                value={watch("parentId") || "none"}
                onValueChange={(value) =>
                  setValue("parentId", value === "none" ? "" : value, {
                    shouldDirty: true,
                  })
                }
              >
                <SelectTrigger id="parentId" className="touch-target w-full">
                  <SelectValue placeholder="Ninguna" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Ninguna</SelectItem>
                  {parents.map((parent) => (
                    <SelectItem key={parent.id} value={parent.id}>
                      {parent.code} · {parent.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormSelectField>
          )}

          <div className="flex flex-col gap-2">
            <Label htmlFor="notes">Notas</Label>
            <Textarea id="notes" rows={2} {...register("notes")} />
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="active" className="cursor-pointer">
              Activa
            </Label>
            <Switch
              id="active"
              checked={watch("active")}
              onCheckedChange={(checked) =>
                setValue("active", checked, { shouldDirty: true })
              }
            />
          </div>
        </FormSection>

        <SubmitButton
          isSubmitting={isSubmitting}
          pendingLabel="Guardando…"
          className="w-full"
        >
          {isEditing ? "Guardar cambios" : "Crear ubicación"}
        </SubmitButton>
      </form>
    </ResponsiveFormDialog>
  );
}

function toDefaults(
  location: Location | undefined,
  warehouses: { id: string }[],
): LocationFormValues {
  return {
    /* Al crear se preselecciona el primer almacén: con una sola nave —que es
       el caso de casi todos— obligar a elegirlo cada vez es un toque de más
       en el celular. */
    warehouseId: location?.warehouseId ?? warehouses[0]?.id ?? "",
    code: location?.code ?? "",
    name: location?.name ?? "",
    type: location?.type ?? "ROW",
    order: location?.order ? String(location.order) : "",
    lotCapacity: location?.lotCapacity ? String(location.lotCapacity) : "",
    parentId: location?.parentId ?? "",
    notes: location?.notes ?? "",
    active: location?.active ?? true,
  };
}
