"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import type { FinishedProduct, Unit } from "@prisma/client";
import { createProductAction, updateProductAction } from "@/app/actions/product.actions";
import { UNIT_LABELS, toSelectOptions } from "@/lib/constants/labels";
import { productFormSchema, type ProductFormValues } from "@/lib/validations/product.schema";
import { FormField, FormSelectField } from "@/components/shared/form-field";
import { FormSection } from "@/components/shared/form-section";
import { ResponsiveFormDialog } from "@/components/shared/responsive-form-dialog";
import { SubmitButton } from "@/components/shared/submit-button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";

const UNIT_OPTIONS = toSelectOptions(UNIT_LABELS);
const FIELDS = Object.keys(productFormSchema.shape) as (keyof ProductFormValues)[];

interface Props {
  product?: FinishedProduct;
  clients: { id: string; name: string }[];
  trigger: ReactNode;
}

export function ProductFormDialog({ product, clients, trigger }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const isEditing = Boolean(product);

  const { register, handleSubmit, setValue, watch, setError, reset, formState: { errors, isSubmitting } } =
    useForm<ProductFormValues>({
      resolver: zodResolver(productFormSchema),
      defaultValues: toDefaults(product),
    });

  async function onSubmit(values: ProductFormValues) {
    const payload = {
      ...values,
      clientId: values.clientId || undefined,
      category: values.category || undefined,
      description: values.description || undefined,
    };

    const result = isEditing
      ? await updateProductAction({ id: product!.id, data: payload })
      : await createProductAction(payload);

    if (!result.success) {
      if (result.field && FIELDS.includes(result.field as keyof ProductFormValues)) {
        setError(result.field as keyof ProductFormValues, { message: result.error });
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
      open={open} onOpenChange={setOpen} trigger={trigger}
      title={isEditing ? "Editar producto" : "Nuevo producto"}
      description={isEditing ? `Modifica ${product!.code}.` : "Código y nombre. Lo demás es opcional."}
    >
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
        <FormField id="code" label="Código" placeholder="OVEROL-GAS"
          className="tabular uppercase" error={errors.code?.message} {...register("code")} />
        <FormField id="name" label="Nombre" placeholder="Overol gasera"
          error={errors.name?.message} {...register("name")} />

        <FormSection title="Detalles">
          <FormSelectField id="clientId" label="Cliente">
            <Select value={watch("clientId") || "none"}
              onValueChange={(v) => setValue("clientId", v === "none" ? "" : v)}>
              <SelectTrigger id="clientId" className="touch-target w-full">
                <SelectValue placeholder="Sin asignar" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sin asignar</SelectItem>
                {clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </FormSelectField>

          <FormField id="category" label="Categoría" placeholder="Uniformes" {...register("category")} />

          <FormSelectField id="unit" label="Unidad">
            <Select value={watch("unit")} onValueChange={(v) => setValue("unit", v as Unit)}>
              <SelectTrigger id="unit" className="touch-target w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                {UNIT_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </FormSelectField>

          <div className="flex items-center justify-between">
            <Label htmlFor="active" className="cursor-pointer">Activo</Label>
            <Switch id="active" checked={watch("active")}
              onCheckedChange={(c) => setValue("active", c)} />
          </div>
        </FormSection>

        <SubmitButton isSubmitting={isSubmitting} pendingLabel="Guardando…" className="w-full">
          {isEditing ? "Guardar cambios" : "Crear producto"}
        </SubmitButton>
      </form>
    </ResponsiveFormDialog>
  );
}

function toDefaults(product?: FinishedProduct): ProductFormValues {
  return {
    code: product?.code ?? "", name: product?.name ?? "",
    clientId: product?.clientId ?? "", category: product?.category ?? "",
    unit: product?.unit ?? "PIECE", description: product?.description ?? "",
    active: product?.active ?? true,
  };
}
