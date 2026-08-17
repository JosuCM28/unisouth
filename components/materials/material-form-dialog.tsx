"use client";

import { useState, type ReactNode } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import type { Material, MaterialType, Unit } from "@prisma/client";
import type { PlainObject } from "@/lib/utils";

/** Material con sus 9 Decimal ya convertidos a number. Ver PlainSize. */
type PlainMaterial = PlainObject<Material>;
import {
  createMaterialAction,
  updateMaterialAction,
} from "@/app/actions/material.actions";
import {
  MATERIAL_TYPE_LABELS,
  UNIT_LABELS,
  toSelectOptions,
} from "@/lib/constants/labels";
import {
  materialFormSchema,
  type MaterialFormValues,
} from "@/lib/validations/material.schema";
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
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

interface MaterialFormDialogProps {
  material?: PlainMaterial;
  trigger: ReactNode;
  /**
   * Se avisa del material recién creado.
   *
   * Lo usa el wizard de recepción para seleccionarlo de inmediato: el
   * auxiliar lo da de alta porque lo tiene enfrente, así que hacerlo volver
   * a buscarlo en la lista sería un paso de más.
   */
  onCreated?: (material: { id: string; name: string; baseUnit: Unit }) => void;
}

const TYPE_OPTIONS = toSelectOptions(MATERIAL_TYPE_LABELS);
const UNIT_OPTIONS = toSelectOptions(UNIT_LABELS);

const FORM_FIELDS = Object.keys(
  materialFormSchema.shape,
) as (keyof MaterialFormValues)[];

export function MaterialFormDialog({
  material,
  trigger,
  onCreated,
}: MaterialFormDialogProps) {
  const [open, setOpen] = useState(false);
  const isEditing = Boolean(material);

  const form = useForm<MaterialFormValues>({
    resolver: zodResolver(materialFormSchema),
    defaultValues: toDefaults(material),
  });

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    setError,
    reset,
    formState: { errors, isSubmitting },
  } = form;

  const type = watch("type");
  // Las características de tela sólo tienen sentido para tela: pedirle
  // composición y encogimiento a un cierre es ruido.
  const isFabric = type === "FABRIC";

  async function onSubmit(values: MaterialFormValues) {
    const payload = toPayload(values);

    const result = isEditing
      ? await updateMaterialAction({ id: material!.id, data: payload })
      : await createMaterialAction(payload);

    if (!result.success) {
      if (result.field && FORM_FIELDS.includes(result.field as keyof MaterialFormValues)) {
        setError(result.field as keyof MaterialFormValues, {
          message: result.error,
        });
      }
      toast.error(result.error);
      return;
    }

    toast.success(result.message ?? "Guardado");
    setOpen(false);

    if (!isEditing) {
      reset(toDefaults());

      const created = result.data as
        | { id: string; name: string; baseUnit: Unit }
        | undefined;
      if (created?.id) onCreated?.(created);
    }
  }

  return (
    <ResponsiveFormDialog
      open={open}
      onOpenChange={setOpen}
      trigger={trigger}
      title={isEditing ? "Editar material" : "Nuevo material"}
      description={
        isEditing
          ? `Modifica la ficha de ${material!.code}.`
          : "Código, nombre, tipo y unidad. Lo demás es opcional."
      }
    >
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-2">
        <FormSection title="Identificación" defaultOpen>
          <FormField
            id="code"
            label="Código"
            placeholder="TELA-MEZ-12"
            autoComplete="off"
            className="tabular uppercase"
            error={errors.code?.message}
            {...register("code")}
          />

          <FormField
            id="name"
            label="Nombre"
            placeholder="Mezclilla 12 oz"
            autoComplete="off"
            error={errors.name?.message}
            {...register("name")}
          />

          <FormSelectField id="type" label="Tipo" error={errors.type?.message}>
            <Select
              value={type}
              onValueChange={(value) =>
                setValue("type", value as MaterialType, { shouldDirty: true })
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

          <FormSelectField
            id="baseUnit"
            label="Unidad base"
            hint="La unidad en que se guarda y se surte."
            error={errors.baseUnit?.message}
          >
            <Select
              value={watch("baseUnit")}
              onValueChange={(value) =>
                setValue("baseUnit", value as Unit, { shouldDirty: true })
              }
            >
              <SelectTrigger id="baseUnit" className="touch-target w-full">
                <SelectValue placeholder="Elige la unidad" />
              </SelectTrigger>
              <SelectContent>
                {UNIT_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormSelectField>
        </FormSection>

        {isFabric && (
          <FormSection title="Características de tela">
            <FormField
              id="composition"
              label="Composición"
              placeholder="100% algodón"
              {...register("composition")}
            />

            <FormField
              id="colorName"
              label="Color"
              placeholder="Índigo"
              {...register("colorName")}
            />

            <div className="grid grid-cols-2 gap-3">
              <FormField
                id="widthMm"
                label="Ancho"
                inputMode="decimal"
                suffix="mm"
                className="tabular"
                {...register("widthMm")}
              />

              {/* Grosor y onzas conviven: la tela plana se pide en mm y la
                  mezclilla en oz/yd². Se captura el que aplique. */}
              <FormField
                id="thicknessMm"
                label="Grosor"
                inputMode="decimal"
                suffix="mm"
                className="tabular"
                {...register("thicknessMm")}
              />

              <FormField
                id="weightOz"
                label="Peso"
                inputMode="decimal"
                suffix="oz"
                hint="Mezclilla"
                className="tabular"
                {...register("weightOz")}
              />

              <FormField
                id="gsm"
                label="Gramaje"
                inputMode="decimal"
                suffix="g/m²"
                className="tabular"
                {...register("gsm")}
              />
            </div>

            <FormField
              id="shrinkagePct"
              label="Encogimiento"
              inputMode="decimal"
              suffix="%"
              className="tabular"
              {...register("shrinkagePct")}
            />
          </FormSection>
        )}

        <FormSection title="Control de inventario">
          <div className="grid grid-cols-2 gap-3">
            <FormField
              id="minStock"
              label="Mínimo"
              inputMode="decimal"
              className="tabular"
              {...register("minStock")}
            />

            <FormField
              id="reorderPoint"
              label="Punto de reorden"
              inputMode="decimal"
              className="tabular"
              {...register("reorderPoint")}
            />
          </div>

          <FormField
            id="remnantThreshold"
            label="Umbral de retazo"
            inputMode="decimal"
            hint="Debajo de esta cantidad el rollo pasa a retazo y se ofrece primero."
            className="tabular"
            {...register("remnantThreshold")}
          />

          <div className="flex items-center justify-between gap-4">
            <div>
              <Label htmlFor="requiresShade" className="cursor-pointer">
                Requiere tono
              </Label>
              <p className="mt-1 text-xs text-muted-foreground">
                Avisa si un cálculo mezcla partidas de tintura distintas.
              </p>
            </div>
            <Switch
              id="requiresShade"
              checked={watch("requiresShade")}
              onCheckedChange={(checked) =>
                setValue("requiresShade", checked, { shouldDirty: true })
              }
            />
          </div>
        </FormSection>

        <FormSection title="Compra">
          <FormSelectField
            id="purchaseUnit"
            label="Unidad de compra"
            hint="Sólo si se compra en una unidad distinta a la base."
          >
            <Select
              value={watch("purchaseUnit") || "none"}
              onValueChange={(value) =>
                setValue("purchaseUnit", value === "none" ? "" : value, {
                  shouldDirty: true,
                })
              }
            >
              <SelectTrigger id="purchaseUnit" className="touch-target w-full">
                <SelectValue placeholder="Igual a la base" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Igual a la base</SelectItem>
                {UNIT_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormSelectField>

          <FormField
            id="purchaseFactor"
            label="Unidades base por unidad de compra"
            inputMode="decimal"
            placeholder="50"
            hint="Ej.: un rollo trae 50 metros."
            className="tabular"
            error={errors.purchaseFactor?.message}
            {...register("purchaseFactor")}
          />
        </FormSection>

        <div className="flex items-center justify-between border-t border-border pt-4">
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

        <SubmitButton
          isSubmitting={isSubmitting}
          pendingLabel="Guardando…"
          className="mt-2 w-full"
        >
          {isEditing ? "Guardar cambios" : "Crear material"}
        </SubmitButton>
      </form>
    </ResponsiveFormDialog>
  );
}

/** Los campos vacíos se omiten para que Zod los reciba como undefined. */
function toPayload(values: MaterialFormValues) {
  return {
    ...values,
    composition: values.composition || undefined,
    colorName: values.colorName || undefined,
    widthMm: values.widthMm || undefined,
    thicknessMm: values.thicknessMm || undefined,
    weightOz: values.weightOz || undefined,
    gsm: values.gsm || undefined,
    shrinkagePct: values.shrinkagePct || undefined,
    minStock: values.minStock || 0,
    reorderPoint: values.reorderPoint || 0,
    remnantThreshold: values.remnantThreshold || undefined,
    purchaseUnit: values.purchaseUnit || undefined,
    purchaseFactor: values.purchaseFactor || undefined,
  };
}

function toDefaults(material?: PlainMaterial): MaterialFormValues {
  return {
    code: material?.code ?? "",
    name: material?.name ?? "",
    type: material?.type ?? "FABRIC",
    baseUnit: material?.baseUnit ?? "METER",
    composition: material?.composition ?? "",
    colorName: material?.colorName ?? "",
    widthMm: material?.widthMm ? String(material.widthMm) : "",
    thicknessMm: material?.thicknessMm ? String(material.thicknessMm) : "",
    weightOz: material?.weightOz ? String(material.weightOz) : "",
    gsm: material?.gsm ? String(material.gsm) : "",
    shrinkagePct: material?.shrinkagePct ? String(material.shrinkagePct) : "",
    minStock: material?.minStock ? String(material.minStock) : "",
    reorderPoint: material?.reorderPoint ? String(material.reorderPoint) : "",
    remnantThreshold: material?.remnantThreshold
      ? String(material.remnantThreshold)
      : "",
    requiresShade: material?.requiresShade ?? false,
    purchaseUnit: material?.purchaseUnit ?? "",
    purchaseFactor: material?.purchaseFactor
      ? String(material.purchaseFactor)
      : "",
    active: material?.active ?? true,
  };
}
