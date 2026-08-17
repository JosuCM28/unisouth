"use client";

import { useState } from "react";
import { AlertTriangle, Calculator } from "lucide-react";
import { toast } from "sonner";
import { explodeForIssueAction } from "@/app/actions/issue.actions";
import type { RequirementResult } from "@/lib/services/calculation.service";
import { ResponsiveFormDialog } from "@/components/shared/responsive-form-dialog";
import { FormSelectField } from "@/components/shared/form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export interface IssueProductOption {
  id: string;
  code: string;
  name: string;
  /** Sin ficha ACTIVE no hay nada que explotar. */
  activeBomId: string | null;
}

interface Props {
  products: IssueProductOption[];
  sizes: { id: string; code: string; name: string }[];
  clientId?: string;
  onExplode: (requirements: RequirementResult[]) => void;
}

/**
 * Convierte "3,000 pantalones" en los renglones de la salida.
 *
 * Llama al MISMO motor de cálculo que la pantalla de cálculo, y no una copia
 * de la fórmula: lo que se descuenta tiene que ser exactamente lo que dijo
 * el cálculo, o los dos números empezarían a discrepar sin que nadie sepa
 * cuál creer.
 */
export function IssueFromCalculation({
  products,
  sizes,
  clientId,
  onExplode,
}: Props) {
  const [open, setOpen] = useState(false);
  const [productId, setProductId] = useState("");
  const [sizeId, setSizeId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [isRunning, setIsRunning] = useState(false);

  const product = products.find((item) => item.id === productId);
  const missingBom = Boolean(product && !product.activeBomId);

  async function handleExplode() {
    if (!product?.activeBomId || !quantity) return;

    setIsRunning(true);
    const result = await explodeForIssueAction({
      productId: product.id,
      bomId: product.activeBomId,
      quantity: Number(quantity),
      sizeId: sizeId || undefined,
      clientId,
    });
    setIsRunning(false);

    if (!result.success) {
      toast.error(result.error);
      return;
    }

    if (result.data.length === 0) {
      toast.error("La ficha técnica no tiene materiales capturados.");
      return;
    }

    onExplode(result.data);
    setOpen(false);
    setQuantity("");
  }

  return (
    <ResponsiveFormDialog
      open={open}
      onOpenChange={setOpen}
      title="Traer de un cálculo"
      description="Explota la ficha técnica y llena los renglones."
      trigger={
        <Button type="button" variant="outline" className="touch-target">
          <Calculator className="size-4" aria-hidden />
          Traer de un cálculo
        </Button>
      }
    >
      <div className="flex flex-col gap-4">
        <FormSelectField id="issue-product" label="Producto">
          <Select value={productId} onValueChange={setProductId}>
            <SelectTrigger id="issue-product" className="touch-target">
              <SelectValue placeholder="Elige el producto" />
            </SelectTrigger>
            <SelectContent>
              {products.map((item) => (
                <SelectItem key={item.id} value={item.id}>
                  {item.code} · {item.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormSelectField>

        {missingBom && (
          <p className="flex items-start gap-2 border border-state-reserved bg-state-reserved-muted p-2 text-xs">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
            Este producto no tiene ficha técnica activa. Captúrala primero o
            agrega los renglones a mano.
          </p>
        )}

        <FormSelectField
          id="issue-size"
          label="Talla"
          hint="Opcional: escala el consumo con el factor de la talla."
        >
          <Select value={sizeId} onValueChange={setSizeId}>
            <SelectTrigger id="issue-size" className="touch-target">
              <SelectValue placeholder="Sin talla" />
            </SelectTrigger>
            <SelectContent>
              {sizes.map((size) => (
                <SelectItem key={size.id} value={size.id}>
                  {size.code} · {size.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormSelectField>

        <div className="flex flex-col gap-2">
          <Label htmlFor="issue-quantity">Piezas a producir</Label>
          <Input
            id="issue-quantity"
            // Piezas enteras: no se producen 2.5 pantalones.
            inputMode="numeric"
            placeholder="3000"
            value={quantity}
            onChange={(event) => setQuantity(event.target.value)}
            className="touch-target tabular"
          />
        </div>

        <Button
          type="button"
          onClick={handleExplode}
          disabled={isRunning || !product?.activeBomId || !quantity}
          className="h-12 w-full"
        >
          {isRunning ? "Calculando…" : "Explotar y llenar renglones"}
        </Button>

        <p className="text-xs text-muted-foreground">
          Se llenan los renglones con los rollos sugeridos: retazos primero y
          luego los más viejos. Puedes ajustarlos antes de guardar.
        </p>
      </div>
    </ResponsiveFormDialog>
  );
}
