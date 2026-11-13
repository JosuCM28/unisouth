"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { quickCreateProductAction } from "@/app/actions/product.actions";
import { runAction } from "@/lib/offline/run-action";
import { quickProductSchema } from "@/lib/validations/product.schema";
import type { QuickProduct } from "@/lib/services/product.service";
import { SearchSelect } from "@/components/shared/search-select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export type ProductOption = QuickProduct;

/**
 * Elegir un producto terminado o darlo de alta ahí mismo.
 *
 * La alta va en línea y no en otra ventana: esto vive dentro del formulario
 * de la salida, y una ventana encima de otra en el celular se pierde. Sólo
 * pide nombre y tipo; el cliente llega del formulario que la contiene.
 */
export function ProductPicker({
  products,
  categories,
  clientId,
  value,
  onChange,
  onCreated,
  canCreate,
}: {
  products: ProductOption[];
  categories: { id: string; name: string }[];
  /** El cliente con que nace un producto nuevo (el de la orden). */
  clientId: string;
  value: string;
  onChange: (productId: string) => void;
  onCreated: (product: ProductOption) => void;
  canCreate: boolean;
}) {
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleCreate() {
    const parsed = quickProductSchema.safeParse({ name, categoryId, clientId });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Revisa los datos.");
      return;
    }

    setSaving(true);
    const result = await runAction(() => quickCreateProductAction(parsed.data));
    setSaving(false);
    if (!result.success) {
      toast.error(result.error);
      return;
    }
    onCreated(result.data);
    onChange(result.data.id);
    setCreating(false);
    setName("");
    setCategoryId("");
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <Label htmlFor="product-picker">Producto</Label>
        {canCreate && !creating && (
          <Button type="button" variant="ghost" className="touch-target" onClick={() => setCreating(true)}>
            <Plus className="size-4" aria-hidden />
            Nuevo
          </Button>
        )}
      </div>
      <SearchSelect
        id="product-picker"
        value={value}
        onChange={onChange}
        options={products.map((p) => ({
          value: p.id, label: p.name, hint: [p.category, p.code].filter(Boolean).join(" · "), keywords: p.code,
        }))}
        placeholder="Elige el producto"
        searchPlaceholder="Buscar producto…"
      />

      {creating && (
        <div className="flex flex-col gap-2 border border-border bg-muted p-2">
          <Input aria-label="Nombre del producto nuevo" placeholder="Camisa manga larga" value={name}
            onChange={(event) => setName(event.target.value)} className="touch-target uppercase" />
          <SearchSelect
            value={categoryId}
            onChange={setCategoryId}
            options={categories.map((c) => ({ value: c.id, label: c.name }))}
            placeholder="Tipo de prenda"
            searchPlaceholder="Buscar tipo…"
          />
          <div className="grid grid-cols-2 gap-2">
            <Button type="button" variant="outline" className="touch-target" onClick={() => setCreating(false)}>
              Cancelar
            </Button>
            <Button type="button" className="touch-target" disabled={saving} onClick={handleCreate}>
              {saving ? "Guardando…" : "Dar de alta"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
