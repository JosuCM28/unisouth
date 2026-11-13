"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { adjustFinishedGoodsAction } from "@/app/actions/finished-goods.actions";
import { runAction } from "@/lib/offline/run-action";
import { adjustFinishedGoodsSchema } from "@/lib/validations/finished-goods.schema";
import { FormSelectField } from "@/components/shared/form-field";
import { ResponsiveFormDialog } from "@/components/shared/responsive-form-dialog";
import { SearchSelect } from "@/components/shared/search-select";
import { SubmitButton } from "@/components/shared/submit-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

type Direction = "IN" | "OUT";

/**
 * Entrada o salida manual de prenda terminada, con motivo.
 *
 * Desde el encabezado se elige todo (la carga inicial de lo que ya estaba en
 * la bodega); desde un renglón llega fijo y sólo se captura cantidad y
 * motivo. El mismo esquema Zod valida aquí y en el servidor.
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
  const [productId, setProductId] = useState(preset?.productId ?? "");
  const [sizeId, setSizeId] = useState(preset?.sizeId ?? "");
  const [clientId, setClientId] = useState(preset?.clientId ?? "");
  const [clientPo, setClientPo] = useState(preset?.clientPo ?? "");
  const [direction, setDirection] = useState<Direction>(preset ? "OUT" : "IN");
  const [quantity, setQuantity] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [products, setProducts] = useState(options.products);

  function chooseProduct(id: string) {
    setProductId(id);
    // El cliente del producto es el punto de partida; se puede cambiar.
    const product = products.find((entry) => entry.id === id);
    if (product?.clientId && !clientId) setClientId(product.clientId);
  }

  async function handleSave() {
    const parsed = adjustFinishedGoodsSchema.safeParse({
      productId, sizeId, clientId, clientPo, direction, quantity, reason,
    });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Revisa los datos.");
      return;
    }

    setSaving(true);
    const result = await runAction(() => adjustFinishedGoodsAction(parsed.data));
    setSaving(false);
    if (!result.success) {
      toast.error(result.error);
      return;
    }
    toast.success(`Quedan ${result.data.quantity} pzas`);
    setOpen(false);
    setQuantity("");
    setReason("");
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
      <div className="flex flex-col gap-4">
        {!preset && (
          <KeyFields options={{ ...options, products }} productId={productId}
            onProductCreated={(product) => setProducts((list) => [...list.filter((p) => p.id !== product.id), product])} sizeId={sizeId} clientId={clientId}
            clientPo={clientPo} onProduct={chooseProduct} onSize={setSizeId} onClient={setClientId}
            onPo={setClientPo} />
        )}

        {preset && (
          <div className="grid grid-cols-2 gap-2">
            {(["IN", "OUT"] as const).map((value) => (
              <Button key={value} type="button" variant={direction === value ? "default" : "outline"}
                className="touch-target" aria-pressed={direction === value} onClick={() => setDirection(value)}>
                {value === "IN" ? "Entra" : "Sale"}
              </Button>
            ))}
          </div>
        )}

        <div className="flex flex-col gap-2">
          <Label htmlFor="adjust-quantity">Piezas</Label>
          <Input id="adjust-quantity" inputMode="numeric" value={quantity}
            onChange={(event) => setQuantity(event.target.value)} className="tabular touch-target" />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="adjust-reason">Motivo</Label>
          <Textarea id="adjust-reason" rows={2} value={reason} onChange={(event) => setReason(event.target.value)}
            placeholder={direction === "IN" ? "Carga inicial de la bodega" : "Faltante en el reconteo"} />
        </div>

        <SubmitButton isSubmitting={saving} onClick={handleSave} className="h-12 w-full">
          Guardar
        </SubmitButton>
      </div>
    </ResponsiveFormDialog>
  );
}

function KeyFields(props: {
  options: AdjustOptions;
  productId: string;
  sizeId: string;
  clientId: string;
  clientPo: string;
  onProduct: (id: string) => void;
  onSize: (id: string) => void;
  onClient: (id: string) => void;
  onPo: (po: string) => void;
  onProductCreated: (product: ProductOption) => void;
}) {
  const { options } = props;
  return (
    <>
      <ProductPicker products={options.products} categories={options.categories} clientId={props.clientId}
        value={props.productId} onChange={props.onProduct} onCreated={props.onProductCreated}
        canCreate={options.canCreateProduct} />
      <div className="grid grid-cols-2 gap-3">
        <FormSelectField id="adjust-size" label="Talla">
          <SearchSelect id="adjust-size" value={props.sizeId} onChange={props.onSize}
            options={options.sizes.map((s) => ({ value: s.id, label: s.code }))}
            placeholder="Talla" searchPlaceholder="Buscar talla…" />
        </FormSelectField>
        <div className="flex flex-col gap-2">
          <Label htmlFor="adjust-po">PO</Label>
          <Input id="adjust-po" placeholder="Sin PO" value={props.clientPo}
            onChange={(event) => props.onPo(event.target.value)} className="tabular touch-target uppercase" />
        </div>
      </div>
      <FormSelectField id="adjust-client" label="Cliente">
        <SearchSelect id="adjust-client" value={props.clientId} onChange={props.onClient}
          options={options.clients.map((c) => ({ value: c.id, label: c.name }))}
          clearLabel="Sin cliente" placeholder="Sin cliente" searchPlaceholder="Buscar cliente…" />
      </FormSelectField>
    </>
  );
}
