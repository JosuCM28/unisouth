"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import type { Supplier } from "@prisma/client";
import { createSupplierAction, updateSupplierAction } from "@/app/actions/partner.actions";
import { supplierFormSchema, type SupplierFormValues } from "@/lib/validations/partner.schema";
import { FormField } from "@/components/shared/form-field";
import { FormSection } from "@/components/shared/form-section";
import { ResponsiveFormDialog } from "@/components/shared/responsive-form-dialog";
import { SubmitButton } from "@/components/shared/submit-button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

const FIELDS = Object.keys(supplierFormSchema.shape) as (keyof SupplierFormValues)[];

export function SupplierFormDialog({ supplier, trigger }: { supplier?: Supplier; trigger: ReactNode }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const isEditing = Boolean(supplier);

  const { register, handleSubmit, setValue, watch, setError, reset, formState: { errors, isSubmitting } } =
    useForm<SupplierFormValues>({
      resolver: zodResolver(supplierFormSchema),
      defaultValues: toDefaults(supplier),
    });

  async function onSubmit(values: SupplierFormValues) {
    const payload = Object.fromEntries(
      Object.entries(values).map(([k, v]) => (v === "" ? [k, undefined] : [k, v])),
    );

    const result = isEditing
      ? await updateSupplierAction({ id: supplier!.id, data: payload })
      : await createSupplierAction(payload);

    if (!result.success) {
      if (result.field && FIELDS.includes(result.field as keyof SupplierFormValues)) {
        setError(result.field as keyof SupplierFormValues, { message: result.error });
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
      title={isEditing ? "Editar proveedor" : "Nuevo proveedor"}
      description="A quién se le compra. Sólo el nombre es obligatorio."
    >
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
        <FormField id="sup-name" label="Nombre" placeholder="Textiles del Golfo"
          autoComplete="off" error={errors.name?.message} {...register("name")} />

        <FormSection title="Contacto y datos fiscales">
          <FormField id="sup-code" label="Código" className="tabular uppercase" {...register("code")} />
          <FormField id="sup-taxId" label="RFC" className="tabular uppercase" {...register("taxId")} />
          <FormField id="sup-contact" label="Contacto" {...register("contact")} />
          <FormField id="sup-phone" label="Teléfono" inputMode="tel" className="tabular" {...register("phone")} />
          <FormField id="sup-email" label="Correo" inputMode="email" autoCapitalize="none" {...register("email")} />
          <FormField id="sup-address" label="Dirección" {...register("address")} />
          <FormField id="sup-lead" label="Días de entrega" inputMode="numeric"
            hint="Cuánto tarda en surtir. Lo usa compras para planear."
            className="tabular" {...register("leadTimeDays")} />

          <div className="flex flex-col gap-2">
            <Label htmlFor="sup-notes">Notas</Label>
            <Textarea id="sup-notes" rows={2} {...register("notes")} />
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="sup-active" className="cursor-pointer">Activo</Label>
            <Switch id="sup-active" checked={watch("active")}
              onCheckedChange={(c) => setValue("active", c)} />
          </div>
        </FormSection>

        <SubmitButton isSubmitting={isSubmitting} pendingLabel="Guardando…" className="w-full">
          {isEditing ? "Guardar cambios" : "Crear proveedor"}
        </SubmitButton>
      </form>
    </ResponsiveFormDialog>
  );
}

function toDefaults(supplier?: Supplier): SupplierFormValues {
  return {
    name: supplier?.name ?? "", code: supplier?.code ?? "", taxId: supplier?.taxId ?? "",
    contact: supplier?.contact ?? "", phone: supplier?.phone ?? "", email: supplier?.email ?? "",
    address: supplier?.address ?? "",
    leadTimeDays: supplier?.leadTimeDays ? String(supplier.leadTimeDays) : "",
    notes: supplier?.notes ?? "", active: supplier?.active ?? true,
  };
}
