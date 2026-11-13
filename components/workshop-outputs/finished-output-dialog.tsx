"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PackageCheck } from "lucide-react";
import { toast } from "sonner";
import { createFinishedOutputAction } from "@/app/actions/workshop-output.actions";
import { runAction } from "@/lib/offline/run-action";
import type { WorkshopBalanceOrder } from "@/lib/services/workshop-output.service";
import { todayInputValue } from "@/lib/utils";
import { finishedOutputSchema } from "@/lib/validations/workshop-output.schema";
import { FormSelectField } from "@/components/shared/form-field";
import { ResponsiveFormDialog } from "@/components/shared/responsive-form-dialog";
import { SearchSelect } from "@/components/shared/search-select";
import { SubmitButton } from "@/components/shared/submit-button";
import { ProductPicker, type ProductOption } from "@/components/products/product-picker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { FinishedOutputRows, toFinishedRows, type FinishedDraftRow } from "./finished-output-rows";

/** Lo que el formulario de confección necesita además del saldo. */
export interface FinishedOutputOptions {
  products: ProductOption[];
  categories: { id: string; name: string }[];
  clients: { id: string; name: string }[];
  canCreateProduct: boolean;
}

/**
 * La salida de un taller de confección: prenda terminada a Embarques.
 * Elige la orden y el producto; las tallas llegan repartidas por PO como se
 * capturaron en la orden, y se ajustan si el corte no venía completo.
 */
export function FinishedOutputDialog({
  balance,
  options,
}: {
  balance: WorkshopBalanceOrder[];
  options: FinishedOutputOptions;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [products, setProducts] = useState(options.products);
  const [orderId, setOrderId] = useState("");
  const [productId, setProductId] = useState("");
  const [clientId, setClientId] = useState("");
  const [date, setDate] = useState(todayInputValue());
  const [notes, setNotes] = useState("");
  const [rows, setRows] = useState<FinishedDraftRow[]>([]);
  const [saving, setSaving] = useState(false);

  const order = balance.find((entry) => entry.orderId === orderId);

  function chooseOrder(id: string) {
    const next = balance.find((entry) => entry.orderId === id);
    setOrderId(id);
    setClientId(next?.clientId ?? "");
    setRows(toFinishedRows(next));
  }

  function reset() {
    setOrderId("");
    setProductId("");
    setClientId("");
    setDate(todayInputValue());
    setNotes("");
    setRows([]);
  }

  async function handleSave() {
    const parsed = finishedOutputSchema.safeParse({
      orderId, productId, clientId, date, notes,
      lines: rows
        .map((entry) => ({
          sizeId: entry.sizeId,
          clientPo: entry.clientPo,
          quantity: Number(entry.quantity) || 0,
          scrapQuantity: Number(entry.scrap) || 0,
          scrapReason: entry.scrapReason,
        }))
        .filter((line) => line.quantity + line.scrapQuantity > 0),
    });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Revisa los datos.");
      return;
    }

    setSaving(true);
    const result = await runAction(() => createFinishedOutputAction(parsed.data));
    setSaving(false);
    if (!result.success) {
      toast.error(result.error);
      return;
    }
    toast.success(`Salida ${result.data.code} enviada a Embarques`);
    setOpen(false);
    reset();
    router.refresh();
  }

  return (
    <ResponsiveFormDialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
      title="Salida a Embarques"
      description="Prenda terminada. Entra al inventario de Embarques al guardar."
      trigger={
        <Button className="touch-target" disabled={balance.length === 0}>
          <PackageCheck className="size-4" aria-hidden />
          Salida a Embarques
        </Button>
      }
    >
      <div className="flex flex-col gap-4">
        <FormSelectField id="finished-order" label="Orden">
          <SearchSelect
            id="finished-order"
            options={balance.map((entry) => ({
              value: entry.orderId,
              label: entry.reference ?? entry.code,
              hint: [entry.clientName, entry.description].filter(Boolean).join(" · "),
              keywords: [entry.code, entry.clientName, entry.description].filter(Boolean).join(" "),
            }))}
            value={orderId}
            onChange={chooseOrder}
            placeholder="Elige la orden"
            searchPlaceholder="Folio, cliente o prenda…"
          />
        </FormSelectField>

        <ProductPicker
          products={products}
          categories={options.categories}
          clientId={clientId}
          value={productId}
          onChange={setProductId}
          onCreated={(product) => setProducts((list) => [...list.filter((p) => p.id !== product.id), product])}
          canCreate={options.canCreateProduct}
        />

        <div className="grid grid-cols-2 gap-3">
          <FormSelectField id="finished-client" label="Cliente">
            <SearchSelect id="finished-client" value={clientId} onChange={setClientId}
              options={options.clients.map((c) => ({ value: c.id, label: c.name }))}
              clearLabel="Sin cliente" placeholder="Sin cliente" searchPlaceholder="Buscar cliente…" />
          </FormSelectField>
          <div className="flex flex-col gap-2">
            <Label htmlFor="finished-date">Fecha</Label>
            <Input id="finished-date" type="date" value={date}
              onChange={(event) => setDate(event.target.value)} className="touch-target" />
          </div>
        </div>

        {order && (
          <>
            <p className="text-xs text-muted-foreground">PO · salen · merma</p>
            <FinishedOutputRows sizes={order.sizes} rows={rows} onChange={setRows} />
          </>
        )}

        <div className="flex flex-col gap-2">
          <Label htmlFor="finished-notes">Nota</Label>
          <Textarea id="finished-notes" rows={2} value={notes} onChange={(event) => setNotes(event.target.value)} />
        </div>

        <SubmitButton isSubmitting={saving} onClick={handleSave} disabled={!order || !productId} className="h-12 w-full">
          Mandar a Embarques
        </SubmitButton>
      </div>
    </ResponsiveFormDialog>
  );
}
