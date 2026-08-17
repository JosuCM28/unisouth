"use client";

import { useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { Calculator, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { runCalculationAction } from "@/app/actions/calculation.actions";
import { createFromCalculationAction } from "@/app/actions/purchase-request.actions";
import type { RequirementResult } from "@/lib/services/calculation.service";
import { FormField, FormSelectField } from "@/components/shared/form-field";
import { FormSection } from "@/components/shared/form-section";
import { SubmitButton } from "@/components/shared/submit-button";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { RequirementTable } from "./requirement-table";

export interface ProductOption {
  id: string;
  code: string;
  name: string;
  /** Ficha ACTIVE del producto; sin ella no se puede calcular. */
  activeBomId: string | null;
}

interface CalculatorFormProps {
  products: ProductOption[];
  sizes: { id: string; code: string; name: string }[];
  clients: { id: string; name: string }[];
}

interface FormValues {
  clientId: string;
  safetyMarginPct: string;
  respectOwnership: boolean;
  includeRemnants: boolean;
  lines: { productId: string; sizeId: string; quantity: string }[];
}

export function CalculatorForm({
  products,
  sizes,
  clients,
}: CalculatorFormProps) {
  const [requirements, setRequirements] = useState<RequirementResult[] | null>(
    null,
  );
  const [code, setCode] = useState<string | null>(null);
  const [calculationId, setCalculationId] = useState<string | null>(null);

  const {
    register,
    control,
    handleSubmit,
    setValue,
    watch,
    formState: { isSubmitting },
  } = useForm<FormValues>({
    defaultValues: {
      clientId: "",
      safetyMarginPct: "",
      respectOwnership: true,
      includeRemnants: true,
      lines: [{ productId: "", sizeId: "", quantity: "" }],
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: "lines" });

  async function onSubmit(values: FormValues) {
    const lines = values.lines
      .filter((line) => line.productId && line.quantity)
      .map((line) => {
        const product = products.find((item) => item.id === line.productId);
        return {
          productId: line.productId,
          bomId: product?.activeBomId ?? "",
          quantity: Number(line.quantity),
          sizeId: line.sizeId || undefined,
        };
      });

    if (lines.length === 0) {
      toast.error("Agrega al menos un producto con su cantidad.");
      return;
    }

    const sinFicha = lines.find((line) => !line.bomId);
    if (sinFicha) {
      toast.error(
        "Uno de los productos no tiene ficha técnica activa. Actívala antes de calcular.",
      );
      return;
    }

    const result = await runCalculationAction({
      clientId: values.clientId || undefined,
      safetyMarginPct: values.safetyMarginPct || 0,
      globalWastePct: 0,
      respectOwnership: values.respectOwnership,
      includeRemnants: values.includeRemnants,
      lines,
    });

    if (!result.success) {
      toast.error(result.error);
      return;
    }

    const data = result.data as {
      calculation: { id: string; code: string };
      requirements: RequirementResult[];
    };

    setRequirements(data.requirements);
    setCode(data.calculation.code);
    setCalculationId(data.calculation.id);
    toast.success(`Cálculo ${data.calculation.code} generado`);
  }

  return (
    <div className="flex flex-col gap-6">
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
        <div className="flex flex-col gap-3">
          {fields.map((field, index) => (
            <div key={field.id} className="flat-surface flex flex-col gap-3 p-3">
              <div className="flex items-start justify-between gap-2">
                <span className="text-xs font-medium text-muted-foreground">
                  Producto {index + 1}
                </span>
                {fields.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="touch-target"
                    aria-label={`Quitar producto ${index + 1}`}
                    onClick={() => remove(index)}
                  >
                    <Trash2 className="size-4" aria-hidden />
                  </Button>
                )}
              </div>

              <FormSelectField id={`product-${index}`} label="Producto">
                <Select
                  value={watch(`lines.${index}.productId`)}
                  onValueChange={(value) =>
                    setValue(`lines.${index}.productId`, value)
                  }
                >
                  <SelectTrigger
                    id={`product-${index}`}
                    className="touch-target w-full"
                  >
                    <SelectValue placeholder="Elige el producto" />
                  </SelectTrigger>
                  <SelectContent>
                    {products.map((product) => (
                      <SelectItem key={product.id} value={product.id}>
                        {product.name}
                        {!product.activeBomId && " (sin ficha activa)"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormSelectField>

              <div className="grid grid-cols-2 gap-3">
                <FormField
                  id={`quantity-${index}`}
                  label="Piezas"
                  inputMode="numeric"
                  placeholder="500"
                  className="tabular text-lg"
                  {...register(`lines.${index}.quantity`)}
                />

                <FormSelectField id={`size-${index}`} label="Talla">
                  <Select
                    value={watch(`lines.${index}.sizeId`) || "none"}
                    onValueChange={(value) =>
                      setValue(
                        `lines.${index}.sizeId`,
                        value === "none" ? "" : value,
                      )
                    }
                  >
                    <SelectTrigger
                      id={`size-${index}`}
                      className="touch-target w-full"
                    >
                      <SelectValue placeholder="Sin talla" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Sin talla</SelectItem>
                      {sizes.map((size) => (
                        <SelectItem key={size.id} value={size.id}>
                          {size.code} · {size.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormSelectField>
              </div>
            </div>
          ))}
        </div>

        <Button
          type="button"
          variant="outline"
          className="touch-target"
          onClick={() => append({ productId: "", sizeId: "", quantity: "" })}
        >
          <Plus className="size-4" aria-hidden />
          Agregar otro producto
        </Button>

        <FormSection title="Opciones">
          <FormSelectField id="clientId" label="Cliente">
            <Select
              value={watch("clientId") || "none"}
              onValueChange={(value) =>
                setValue("clientId", value === "none" ? "" : value)
              }
            >
              <SelectTrigger id="clientId" className="touch-target w-full">
                <SelectValue placeholder="Cualquiera" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Cualquiera</SelectItem>
                {clients.map((client) => (
                  <SelectItem key={client.id} value={client.id}>
                    {client.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormSelectField>

          <FormField
            id="safetyMarginPct"
            label="Factor de seguridad"
            inputMode="decimal"
            suffix="%"
            placeholder="5"
            className="tabular"
            {...register("safetyMarginPct")}
          />

          <div className="flex items-start justify-between gap-4">
            <div>
              <Label htmlFor="respectOwnership" className="cursor-pointer">
                Respetar dueño
              </Label>
              <p className="mt-1 text-xs text-muted-foreground">
                No surtir material de un cliente a la producción de otro.
              </p>
            </div>
            <Switch
              id="respectOwnership"
              checked={watch("respectOwnership")}
              onCheckedChange={(checked) =>
                setValue("respectOwnership", checked)
              }
            />
          </div>

          <div className="flex items-start justify-between gap-4">
            <div>
              <Label htmlFor="includeRemnants" className="cursor-pointer">
                Incluir retazos
              </Label>
              <p className="mt-1 text-xs text-muted-foreground">
                Se ofrecen primero, para que no se acumulen.
              </p>
            </div>
            <Switch
              id="includeRemnants"
              checked={watch("includeRemnants")}
              onCheckedChange={(checked) => setValue("includeRemnants", checked)}
            />
          </div>
        </FormSection>

        <SubmitButton
          isSubmitting={isSubmitting}
          pendingLabel="Calculando…"
          className="h-14 w-full text-base"
        >
          <Calculator className="size-5" aria-hidden />
          Calcular
        </SubmitButton>
      </form>

      {requirements && (
        <section className="flex flex-col gap-3">
          <div className="flex items-baseline justify-between gap-2">
            <h2 className="text-sm font-semibold">Resultado</h2>
            {code && (
              <span className="tabular text-xs text-muted-foreground">{code}</span>
            )}
          </div>

          <RequirementTable
            requirements={requirements}
            onGeneratePurchaseRequest={async () => {
              if (!calculationId) return;

              // Los faltantes ya están calculados: retecleárlos sería pedir
              // errores de dedo justo en lo que se va a comprar.
              const created = await createFromCalculationAction({ calculationId });

              if (!created.success) {
                toast.error(created.error);
                return;
              }

              toast.success(created.message ?? "Requisición generada");
            }}
          />
        </section>
      )}
    </div>
  );
}
