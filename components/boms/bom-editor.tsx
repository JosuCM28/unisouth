"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useFieldArray, useForm } from "react-hook-form";
import { Info, Plus, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { BomStatus, Unit } from "@prisma/client";
import { createBomAction, updateBomAction } from "@/app/actions/bom.actions";
import { UNIT_LABELS, UNIT_SHORT_LABELS, toSelectOptions } from "@/lib/constants/labels";
import type { MaterialOption } from "@/lib/repositories/material.repository";
import { simulate } from "@/lib/bom-simulator";
import { formatQuantity } from "@/lib/utils";
import { FormField, FormSelectField } from "@/components/shared/form-field";
import { SubmitButton } from "@/components/shared/submit-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

const UNIT_OPTIONS = toSelectOptions(UNIT_LABELS);

export interface BomEditorLine {
  materialId: string;
  consumptionPerUnit: string;
  unit: Unit;
  wastePct: string;
  sizeId: string;
  isFixedQuantity: boolean;
  part: string;
}

interface BomEditorProps {
  productId: string;
  productName: string;
  materials: MaterialOption[];
  sizes: { id: string; code: string; name: string }[];
  bom?: {
    id: string;
    version: number;
    status: BomStatus;
    globalWastePct: string;
    name: string | null;
    /** Si ya la usó un cálculo, editarla creará una versión nueva. */
    usedByCalculations: number;
    lines: BomEditorLine[];
  };
}

interface FormValues {
  name: string;
  globalWastePct: string;
  lines: BomEditorLine[];
}

export function BomEditor({
  productId, productName, materials, sizes, bom,
}: BomEditorProps) {
  const router = useRouter();
  const [simulationQty, setSimulationQty] = useState("500");
  const isEditing = Boolean(bom);

  // Editar una ficha ya usada NO la modifica: crea una v2. Se avisa antes
  // de que el usuario escriba, no después de guardar.
  const willVersion = Boolean(
    bom && bom.status === "ACTIVE" && bom.usedByCalculations > 0,
  );

  const { register, control, handleSubmit, setValue, watch, formState: { isSubmitting } } =
    useForm<FormValues>({
      defaultValues: {
        name: bom?.name ?? "",
        globalWastePct: bom?.globalWastePct ?? "0",
        lines: bom?.lines ?? [emptyLine()],
      },
    });

  const { fields, append, remove } = useFieldArray({ control, name: "lines" });
  const watchedLines = watch("lines");
  const globalWaste = watch("globalWastePct");

  /** Simulación en vivo con las mismas funciones puras del motor real. */
  const simulation = useMemo(() => {
    const quantity = Number(simulationQty.replace(",", ".")) || 0;
    const lines = watchedLines
      .filter((line) => line.materialId && line.consumptionPerUnit)
      .map((line) => ({
        materialName:
          materials.find((m) => m.id === line.materialId)?.name ?? "—",
        unit: UNIT_SHORT_LABELS[line.unit] ?? line.unit,
        consumptionPerUnit: Number(line.consumptionPerUnit.replace(",", ".")) || 0,
        wastePct: Number((line.wastePct || "0").replace(",", ".")) || 0,
        isFixedQuantity: line.isFixedQuantity,
        hasOwnSize: Boolean(line.sizeId),
      }));

    return simulate(lines, quantity, Number(globalWaste?.replace(",", ".")) || 0);
  }, [watchedLines, simulationQty, globalWaste, materials]);

  async function onSubmit(values: FormValues) {
    const payload = {
      productId,
      name: values.name || undefined,
      status: bom?.status ?? "DRAFT",
      globalWastePct: values.globalWastePct || 0,
      lines: values.lines
        .filter((line) => line.materialId && line.consumptionPerUnit)
        .map((line) => ({
          materialId: line.materialId,
          consumptionPerUnit: Number(line.consumptionPerUnit.replace(",", ".")),
          unit: line.unit,
          wastePct: line.wastePct || 0,
          sizeId: line.sizeId || undefined,
          isFixedQuantity: line.isFixedQuantity,
          optional: false,
          part: line.part || undefined,
        })),
    };

    const result = isEditing
      ? await updateBomAction({ id: bom!.id, data: payload })
      : await createBomAction(payload);

    if (!result.success) {
      toast.error(result.error);
      return;
    }

    const data = result.data as { versioned?: boolean; bom?: { version: number } };
    if (data?.versioned) {
      toast.success(
        `Se creó la versión ${data.bom?.version}. La anterior quedó como obsoleta pero se conserva.`,
      );
    } else {
      toast.success("Ficha guardada");
    }

    router.refresh();
  }

  return (
    <div className="flex flex-col gap-4">
      {willVersion && (
        <div className="flex items-start gap-2 border border-state-reserved bg-state-reserved-muted p-3">
          <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
          <p className="text-xs">
            Esta ficha ya se usó en{" "}
            <span className="tabular font-medium">{bom!.usedByCalculations}</span>{" "}
            {bom!.usedByCalculations === 1 ? "cálculo" : "cálculos"}. Al guardar
            NO se modifica: se crea la versión {bom!.version + 1} y ésta queda
            como obsoleta, para que los cálculos viejos sigan siendo
            reproducibles.
          </p>
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
        <div className="grid gap-3 md:grid-cols-2">
          <FormField
            id="bom-name"
            label="Nombre de la ficha"
            placeholder={`${productName} v${(bom?.version ?? 0) + 1}`}
            {...register("name")}
          />
          <FormField
            id="globalWastePct"
            label="Merma global del proceso"
            inputMode="decimal"
            suffix="%"
            hint="Tendido, puntas, trazo. Se compone con la merma de cada línea."
            className="tabular"
            {...register("globalWastePct")}
          />
        </div>

        <div className="flex flex-col gap-2">
          <h3 className="text-sm font-medium">Materiales por pieza</h3>

          {fields.map((field, index) => (
            <div key={field.id} className="flat-surface flex flex-col gap-3 p-3">
              <div className="flex items-start justify-between gap-2">
                <span className="text-xs text-muted-foreground">
                  Renglón {index + 1}
                </span>
                {fields.length > 1 && (
                  <Button
                    type="button" variant="ghost" size="icon"
                    className="touch-target"
                    aria-label={`Quitar renglón ${index + 1}`}
                    onClick={() => remove(index)}
                  >
                    <Trash2 className="size-4" aria-hidden />
                  </Button>
                )}
              </div>

              <FormSelectField id={`material-${index}`} label="Material">
                <Select
                  value={watch(`lines.${index}.materialId`)}
                  onValueChange={(value) => {
                    setValue(`lines.${index}.materialId`, value);
                    // La unidad se toma del material: evita capturar metros
                    // de tela como si fueran piezas.
                    const material = materials.find((m) => m.id === value);
                    if (material) setValue(`lines.${index}.unit`, material.baseUnit);
                  }}
                >
                  <SelectTrigger id={`material-${index}`} className="touch-target w-full">
                    <SelectValue placeholder="Elige el material" />
                  </SelectTrigger>
                  <SelectContent>
                    {materials.map((material) => (
                      <SelectItem key={material.id} value={material.id}>
                        {material.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormSelectField>

              <div className="grid grid-cols-2 gap-3">
                <FormField
                  id={`consumption-${index}`}
                  label="Consumo por pieza"
                  inputMode="decimal"
                  placeholder="2"
                  className="tabular"
                  {...register(`lines.${index}.consumptionPerUnit`)}
                />
                <FormField
                  id={`waste-${index}`}
                  label="Merma"
                  inputMode="decimal"
                  suffix="%"
                  className="tabular"
                  {...register(`lines.${index}.wastePct`)}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <FormSelectField id={`unit-${index}`} label="Unidad">
                  <Select
                    value={watch(`lines.${index}.unit`)}
                    onValueChange={(value) =>
                      setValue(`lines.${index}.unit`, value as Unit)
                    }
                  >
                    <SelectTrigger id={`unit-${index}`} className="touch-target w-full">
                      <SelectValue placeholder="—" />
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

                <FormSelectField id={`size-${index}`} label="Sólo para talla">
                  <Select
                    value={watch(`lines.${index}.sizeId`) || "none"}
                    onValueChange={(value) =>
                      setValue(`lines.${index}.sizeId`, value === "none" ? "" : value)
                    }
                  >
                    <SelectTrigger id={`size-${index}`} className="touch-target w-full">
                      <SelectValue placeholder="Todas" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Todas</SelectItem>
                      {sizes.map((size) => (
                        <SelectItem key={size.id} value={size.id}>
                          {size.code} · {size.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormSelectField>
              </div>

              <FormField
                id={`part-${index}`}
                label="Parte"
                placeholder="Cuerpo, mangas, bolsas…"
                {...register(`lines.${index}.part`)}
              />
            </div>
          ))}

          <Button
            type="button" variant="outline" className="touch-target"
            onClick={() => append(emptyLine())}
          >
            <Plus className="size-4" aria-hidden />
            Agregar material
          </Button>
        </div>

        <SubmitButton isSubmitting={isSubmitting} pendingLabel="Guardando…" className="h-12 w-full">
          <Save className="size-4" aria-hidden />
          {willVersion ? `Guardar como v${bom!.version + 1}` : "Guardar ficha"}
        </SubmitButton>
      </form>

      {/* Simulador: no guarda nada, sólo responde "¿y si produzco N?" */}
      <section className="flat-surface p-4">
        <h3 className="text-sm font-semibold">Simulador</h3>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Cuánto material se necesita. No guarda nada.
        </p>

        <div className="mt-3 flex items-center gap-2">
          <Label htmlFor="sim-qty" className="shrink-0 text-sm">
            Si produzco
          </Label>
          <Input
            id="sim-qty"
            inputMode="numeric"
            value={simulationQty}
            onChange={(event) => setSimulationQty(event.target.value)}
            className="tabular touch-target w-24 text-center"
          />
          <span className="shrink-0 text-sm text-muted-foreground">piezas</span>
        </div>

        {simulation.length === 0 ? (
          <p className="mt-3 text-xs text-muted-foreground">
            Captura al menos un material con su consumo.
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-border">
            {simulation.map((row) => (
              <li key={row.materialName} className="flex items-center justify-between gap-2 py-2">
                <div className="min-w-0">
                  <p className="truncate text-sm">{row.materialName}</p>
                  <p className="tabular text-xs text-muted-foreground">
                    base {formatQuantity(row.base)}
                    {row.wastePct > 0 && ` · merma ${formatQuantity(row.wastePct)}%`}
                  </p>
                </div>
                <span className="tabular shrink-0 text-base font-semibold">
                  {formatQuantity(row.required, { unit: row.unit })}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function emptyLine(): BomEditorLine {
  return {
    materialId: "",
    consumptionPerUnit: "",
    unit: "METER",
    wastePct: "",
    sizeId: "",
    isFixedQuantity: false,
    part: "",
  };
}
