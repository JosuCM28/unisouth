"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm, useWatch, type Control } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import type { z } from "zod";
import { adjustFinishedGoodsAction } from "@/app/actions/finished-goods.actions";
import { runAction } from "@/lib/offline/run-action";
import { adjustFinishedGoodsSchema } from "@/lib/validations/finished-goods.schema";
import { FormField, FormSelectField } from "@/components/shared/form-field";
import { ResponsiveFormDialog } from "@/components/shared/responsive-form-dialog";
import { SearchSelect } from "@/components/shared/search-select";
import { SubmitButton } from "@/components/shared/submit-button";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ProductPicker, type ProductOption } from "@/components/products/product-picker";

export interface AdjustOptions {
  products: ProductOption[];
  categories: { id: string; name: string }[];
  sizes: { id: string; code: string }[];
  clients: { id: string; name: string }[];
  /** `products:create`: dar de alta el producto ahí mismo. */
  canCreateProduct: boolean;
}

/** El renglón ya elegido cuando se ajusta desde la lista. */
export interface AdjustPreset {
  productId: string;
  sizeId: string;
  clientId: string | null;
  clientPo: string | null;
  label: string;
}

/* El formulario trabaja con lo que se TECLEA (entrada del esquema) y manda lo
   que el esquema deja (salida): piezas ya como número, PO en mayúsculas. Es el
   mismo esquema que vuelve a validar `executeAction` en el servidor. */
type FormInput = z.input<typeof adjustFinishedGoodsSchema>;
type FormOutput = z.output<typeof adjustFinishedGoodsSchema>;

/**
 * Entrada o salida manual de prenda terminada, con motivo.
 *
 * Desde el encabezado se elige todo (la carga inicial de lo que ya estaba en
 * la bodega); desde un renglón llega fijo y sólo se captura cantidad y
 * motivo.
 */
export function FinishedAdjustDialog({
  options,
  preset,
  trigger,
}: {
  options: AdjustOptions;
  preset?: AdjustPreset;
  trigger: ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  // Lista viva: un producto dado de alta ahí mismo se agrega sin recargar.
  const [products, setProducts] = useState(options.products);

  const form = useForm<FormInput, unknown, FormOutput>({
    resolver: zodResolver(adjustFinishedGoodsSchema),
    defaultValues: toDefaults(preset),
  });
  const { errors, isSubmitting } = form.formState;
  const direction = useWatch({ control: form.control, name: "direction" });

  /* Al guardar se conserva el renglón elegido: lo normal es capturar varias
     tallas del mismo producto seguidas. Sólo se limpian piezas y motivo. */
  async function onSubmit(values: FormOutput) {
    const result = await runAction(() => adjustFinishedGoodsAction(values));
    if (!result.success) {
      if (result.field && result.field in values) {
        form.setError(result.field as keyof FormInput, { message: result.error });
      }
      toast.error(result.error);
      return;
    }
    toast.success(`Quedan ${result.data.quantity} pzas`);
    setOpen(false);
    form.reset({ ...form.getValues(), quantity: "", reason: "" });
    router.refresh();
  }

  return (
    <ResponsiveFormDialog
      open={open}
      onOpenChange={setOpen}
      title={preset ? "Ajustar" : "Entrada manual"}
      description={preset?.label ?? "Prenda que ya está en la bodega o un reconteo a favor."}
      trigger={trigger}
    >
      <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">
        {!preset && (
          <KeyFields
            control={form.control}
            options={{ ...options, products }}
            errors={{
              productId: errors.productId?.message,
              sizeId: errors.sizeId?.message,
              clientId: errors.clientId?.message,
              clientPo: errors.clientPo?.message,
            }}
            onProductCreated={(product) =>
              setProducts((list) => [...list.filter((p) => p.id !== product.id), product])
            }
            onProductChosen={(id) => {
              // El cliente del producto es el punto de partida; se puede cambiar.
              const product = products.find((entry) => entry.id === id);
              if (product?.clientId && !form.getValues("clientId")) {
                form.setValue("clientId", product.clientId);
              }
            }}
          />
        )}

        {preset && <DirectionToggle control={form.control} />}

        <FormField id="adjust-quantity" label="Piezas" inputMode="numeric" className="tabular touch-target"
          error={errors.quantity?.message} {...form.register("quantity")} />

        <div className="flex flex-col gap-2">
          <Label htmlFor="adjust-reason">Motivo</Label>
          <Textarea id="adjust-reason" rows={2} aria-invalid={Boolean(errors.reason)} {...form.register("reason")}
            placeholder={direction === "IN" ? "Carga inicial de la bodega" : "Faltante en el reconteo"} />
          {errors.reason && <p className="text-sm text-destructive">{errors.reason.message}</p>}
        </div>

        <SubmitButton isSubmitting={isSubmitting} className="h-12 w-full">
          Guardar
        </SubmitButton>
      </form>
    </ResponsiveFormDialog>
  );
}

function toDefaults(preset?: AdjustPreset): FormInput {
  return {
    productId: preset?.productId ?? "",
    sizeId: preset?.sizeId ?? "",
    clientId: preset?.clientId ?? "",
    clientPo: preset?.clientPo ?? "",
    // Desde un renglón lo común es descontar; desde el encabezado, cargar.
    direction: preset ? "OUT" : "IN",
    quantity: "",
    reason: "",
  };
}

const DIRECTION_LABELS = { IN: "Entra", OUT: "Sale" } as const;

function DirectionToggle({ control }: { control: Control<FormInput, unknown, FormOutput> }) {
  return (
    <Controller
      control={control}
      name="direction"
      render={({ field }) => (
        <div className="grid grid-cols-2 gap-2">
          {(["IN", "OUT"] as const).map((value) => (
            <Button key={value} type="button" variant={field.value === value ? "default" : "outline"}
              className="touch-target" aria-pressed={field.value === value} onClick={() => field.onChange(value)}>
              {DIRECTION_LABELS[value]}
            </Button>
          ))}
        </div>
      )}
    />
  );
}

function KeyFields({
  control,
  options,
  errors,
  onProductCreated,
  onProductChosen,
}: {
  control: Control<FormInput, unknown, FormOutput>;
  options: AdjustOptions;
  errors: Partial<Record<"productId" | "sizeId" | "clientId" | "clientPo", string>>;
  onProductCreated: (product: ProductOption) => void;
  onProductChosen: (productId: string) => void;
}) {
  const clientId = useWatch({ control, name: "clientId" }) ?? "";

  return (
    <>
      <Controller
        control={control}
        name="productId"
        render={({ field }) => (
          <div className="flex flex-col gap-2">
            <ProductPicker products={options.products} categories={options.categories} clientId={clientId}
              value={field.value} onCreated={onProductCreated} canCreate={options.canCreateProduct}
              onChange={(id) => {
                field.onChange(id);
                onProductChosen(id);
              }} />
            {errors.productId && <p className="text-sm text-destructive">{errors.productId}</p>}
          </div>
        )}
      />
      <div className="grid grid-cols-2 gap-3">
        <Controller
          control={control}
          name="sizeId"
          render={({ field }) => (
            <FormSelectField id="adjust-size" label="Talla" error={errors.sizeId}>
              <SearchSelect id="adjust-size" value={field.value} onChange={field.onChange}
                options={options.sizes.map((s) => ({ value: s.id, label: s.code }))}
                placeholder="Talla" searchPlaceholder="Buscar talla…" />
            </FormSelectField>
          )}
        />
        <Controller
          control={control}
          name="clientPo"
          render={({ field }) => (
            <FormField id="adjust-po" label="PO" placeholder="Sin PO" className="tabular touch-target uppercase"
              error={errors.clientPo} name={field.name} ref={field.ref} onBlur={field.onBlur}
              value={field.value ?? ""} onChange={field.onChange} />
          )}
        />
      </div>
      <Controller
        control={control}
        name="clientId"
        render={({ field }) => (
          <FormSelectField id="adjust-client" label="Cliente" error={errors.clientId}>
            <SearchSelect id="adjust-client" value={field.value ?? ""} onChange={field.onChange}
              options={options.clients.map((c) => ({ value: c.id, label: c.name }))}
              clearLabel="Sin cliente" placeholder="Sin cliente" searchPlaceholder="Buscar cliente…" />
          </FormSelectField>
        )}
      />
    </>
  );
}
