"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Copy, Plus, Save, Trash2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { MaterialFormDialog } from "@/components/materials/material-form-dialog";
import { HelperFormDialog } from "@/components/helpers/helper-form-dialog";
import { ReceiptTotals } from "./receipt-totals";
import { toast } from "sonner";
import type { Unit } from "@prisma/client";
import { createReceiptAction } from "@/app/actions/receipt.actions";
import type { MaterialOption } from "@/lib/repositories/material.repository";
import { UNIT_SHORT_LABELS } from "@/lib/constants/labels";
import { FormField, FormSelectField } from "@/components/shared/form-field";
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

interface HeaderState {
  date: string;
  guideNumber: string;
  carrierId: string;
  origin: string;
  supplierId: string;
  clientId: string;
  invoiceRef: string;
}

interface LotRow {
  materialId: string;
  quantity: string;
  unit: Unit | "";
  locationId: string;
  /** Quién bajó este rollo. Va por rollo: dos ayudantes pueden repartirse
   *  un mismo camión y cada uno cobra lo suyo. */
  helperId: string;
  shade: string;
  supplierLotNumber: string;
}

interface ReceiptWizardProps {
  materials: MaterialOption[];
  helpers: { id: string; name: string }[];
  locations: { id: string; code: string; name: string }[];
  clients: { id: string; name: string }[];
  suppliers: { id: string; name: string }[];
  carriers: { id: string; name: string }[];
}

/**
 * Alta de recepción en dos pasos.
 *
 * Paso 1 es el encabezado —de dónde viene la carga— y paso 2 la captura de
 * los rollos. Se separan porque el encabezado se llena una vez y los rollos
 * son veinte: mezclarlos obligaría a barrer entre campos que ya no cambian.
 */
export function ReceiptWizard({
  materials,
  helpers,
  locations,
  clients,
  suppliers,
  carriers,
}: ReceiptWizardProps) {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [header, setHeader] = useState<HeaderState>({
    date: new Date().toISOString().slice(0, 10),
    guideNumber: "",
    carrierId: "",
    origin: "",
    supplierId: "",
    clientId: "",
    invoiceRef: "",
  });

  const [rows, setRows] = useState<LotRow[]>([emptyRow()]);
  const lastQuantityRef = useRef<HTMLInputElement>(null);

  /**
   * Los materiales se llevan en estado, no en props.
   *
   * Si el auxiliar da de alta uno a media captura, tiene que aparecer en el
   * select sin recargar: recargar perdería los rollos ya capturados.
   */
  const [materialOptions, setMaterialOptions] = useState(materials);

  /** Igual que los materiales: uno nuevo debe aparecer sin recargar. */
  const [helperOptions, setHelperOptions] = useState(helpers);

  /** Fila que se va a borrar. `null` = el diálogo está cerrado. */
  const [rowToDelete, setRowToDelete] = useState<number | null>(null);

  function updateRow(index: number, patch: Partial<LotRow>) {
    setRows((current) =>
      current.map((row, i) => (i === index ? { ...row, ...patch } : row)),
    );
  }

  function addRow() {
    setRows((current) => [...current, emptyRow()]);
  }

  /**
   * Duplica el renglón anterior.
   *
   * En una carga real llegan quince rollos del mismo material y el mismo
   * tono; sólo cambia el metraje. Recapturarlo quince veces es lo que hace
   * que la gente abandone el sistema.
   */
  function duplicateLast() {
    setRows((current) => {
      const last = current[current.length - 1];
      if (!last) return [...current, emptyRow()];
      return [...current, { ...last, quantity: "" }];
    });

    // El foco va al metraje del renglón nuevo: es el único campo que cambia.
    setTimeout(() => lastQuantityRef.current?.focus(), 50);
  }

  /**
   * Pide confirmación antes de borrar.
   *
   * Un renglón capturado puede llevar medio minuto de trabajo —material,
   * metraje, tono, lote del proveedor— y el bote de basura queda a un dedo
   * del campo de cantidad. Sin confirmación, un roce con el guante borra la
   * captura y no hay forma de deshacerla.
   */
  function requestRemove(index: number) {
    const row = rows[index];

    // Una fila en blanco no vale la pregunta: no hay nada que perder.
    if (!row || (!row.materialId && !row.quantity)) {
      removeRow(index);
      return;
    }

    setRowToDelete(index);
  }

  function removeRow(index: number) {
    setRows((current) =>
      current.length === 1 ? current : current.filter((_, i) => i !== index),
    );
    setRowToDelete(null);
  }

  /** Al crear un material desde aquí, se selecciona en la fila que lo pidió. */
  function handleMaterialCreated(
    index: number,
    material: { id: string; name: string; baseUnit: Unit },
  ) {
    setMaterialOptions((current) => [...current, material as MaterialOption]);
    updateRow(index, { materialId: material.id, unit: material.baseUnit });
  }

  /** Enter avanza al siguiente renglón, como en una hoja de cálculo. */
  function handleKeyDown(event: React.KeyboardEvent, index: number) {
    if (event.key !== "Enter") return;
    event.preventDefault();

    if (index === rows.length - 1) {
      duplicateLast();
      return;
    }

    const next = document.querySelector<HTMLInputElement>(
      `#quantity-row-${index + 1}`,
    );
    next?.focus();
  }

  async function handleSubmit() {
    const lots = rows
      .filter((row) => row.materialId && row.quantity)
      .map((row) => ({
        materialId: row.materialId,
        quantity: row.quantity,
        unit: row.unit,
        locationId: row.locationId || undefined,
        helperId: row.helperId || undefined,
        shade: row.shade || undefined,
        supplierLotNumber: row.supplierLotNumber || undefined,
      }));

    if (lots.length === 0) {
      toast.error("Captura al menos un rollo con material y cantidad.");
      return;
    }

    setIsSubmitting(true);
    const result = await createReceiptAction({
      date: header.date,
      guideNumber: header.guideNumber || undefined,
      carrierId: header.carrierId || undefined,
      origin: header.origin || undefined,
      supplierId: header.supplierId || undefined,
      clientId: header.clientId || undefined,
      invoiceRef: header.invoiceRef || undefined,
      lots,
    });
    setIsSubmitting(false);

    if (!result.success) {
      toast.error(result.error);
      return;
    }

    const data = result.data as { lotCodes: string[] };
    toast.success(
      `Recepción registrada con ${data.lotCodes.length} ${data.lotCodes.length === 1 ? "rollo" : "rollos"}`,
    );
    router.push("/lots");
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-4">
      <StepIndicator step={step} />

      {step === 1 ? (
        <section className="flat-surface flex flex-col gap-4 p-4">
          <FormField
            id="date"
            label="Fecha"
            type="date"
            className="tabular"
            value={header.date}
            onChange={(event) => setHeader({ ...header, date: event.target.value })}
          />

          <div className="grid gap-3 md:grid-cols-2">
            <FormField
              id="guideNumber"
              label="Guía"
              placeholder="1Z999AA10123456784"
              className="tabular"
              value={header.guideNumber}
              onChange={(event) => setHeader({ ...header, guideNumber: event.target.value })}
            />

            <FormSelectField id="carrierId" label="Paquetería">
              <Select
                value={header.carrierId || "none"}
                onValueChange={(value) =>
                  setHeader({ ...header, carrierId: value === "none" ? "" : value })
                }
              >
                <SelectTrigger id="carrierId" className="touch-target w-full">
                  <SelectValue placeholder="Sin especificar" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sin especificar</SelectItem>
                  {carriers.map((carrier) => (
                    <SelectItem key={carrier.id} value={carrier.id}>
                      {carrier.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormSelectField>
          </div>

          <FormField
            id="origin"
            label="Origen"
            placeholder="Monterrey"
            value={header.origin}
            onChange={(event) => setHeader({ ...header, origin: event.target.value })}
          />

          <div className="grid gap-3 md:grid-cols-2">
            <FormSelectField id="supplierId" label="Proveedor">
              <Select
                value={header.supplierId || "none"}
                onValueChange={(value) =>
                  setHeader({ ...header, supplierId: value === "none" ? "" : value })
                }
              >
                <SelectTrigger id="supplierId" className="touch-target w-full">
                  <SelectValue placeholder="Sin especificar" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sin especificar</SelectItem>
                  {suppliers.map((supplier) => (
                    <SelectItem key={supplier.id} value={supplier.id}>
                      {supplier.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormSelectField>

            {/* El dueño se hereda a TODOS los rollos de la carga. */}
            <FormSelectField
              id="clientId"
              label="Cliente dueño"
              hint="Se aplica a todos los rollos de esta guía."
            >
              <Select
                value={header.clientId || "none"}
                onValueChange={(value) =>
                  setHeader({ ...header, clientId: value === "none" ? "" : value })
                }
              >
                <SelectTrigger id="clientId" className="touch-target w-full">
                  <SelectValue placeholder="De la fábrica" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">De la fábrica</SelectItem>
                  {clients.map((client) => (
                    <SelectItem key={client.id} value={client.id}>
                      {client.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormSelectField>
          </div>

          <FormField
            id="invoiceRef"
            label="Factura"
            className="tabular"
            value={header.invoiceRef}
            onChange={(event) => setHeader({ ...header, invoiceRef: event.target.value })}
          />

          <Button
            type="button"
            onClick={() => setStep(2)}
            className="h-12 w-full"
          >
            Capturar rollos
            <ArrowRight className="size-4" aria-hidden />
          </Button>
        </section>
      ) : (
        <section className="flex flex-col gap-3">
          {/* Sticky: el total tiene que seguir a la vista mientras se
              capturan quince rollos, o hay que subir cada vez para
              compararlo con la factura. */}
          <div className="sticky top-14 z-20 -mx-4 bg-background px-4 pb-1 pt-2 md:top-0 md:mx-0 md:px-0">
            <ReceiptTotals rows={rows} materials={materialOptions} />
          </div>

          <div className="flex flex-col gap-2">
            {rows.map((row, index) => (
              <div key={index} className="flat-surface flex flex-col gap-3 p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="tabular text-xs text-muted-foreground">
                    Rollo {index + 1}
                  </span>
                  {rows.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="touch-target"
                      aria-label={`Quitar rollo ${index + 1}`}
                      onClick={() => requestRemove(index)}
                    >
                      <Trash2 className="size-4" aria-hidden />
                    </Button>
                  )}
                </div>

                <FormSelectField id={`material-row-${index}`} label="Material">
                  <div className="flex gap-2">
                    <Select
                      value={row.materialId}
                      onValueChange={(value) => {
                        const material = materialOptions.find(
                          (item) => item.id === value,
                        );
                        updateRow(index, {
                          materialId: value,
                          unit: material?.baseUnit ?? "",
                        });
                      }}
                    >
                      <SelectTrigger
                        id={`material-row-${index}`}
                        className="touch-target min-w-0 flex-1"
                      >
                        <SelectValue placeholder="Elige el material" />
                      </SelectTrigger>
                      <SelectContent>
                        {materialOptions.map((material) => (
                          <SelectItem key={material.id} value={material.id}>
                            {material.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    {/* Llega un material que nadie dio de alta: se registra
                        aquí mismo y queda seleccionado, sin perder la
                        captura de los rollos anteriores. */}
                    <MaterialFormDialog
                      onCreated={(material) =>
                        handleMaterialCreated(index, material)
                      }
                      trigger={
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="touch-target shrink-0"
                          aria-label="Registrar material nuevo"
                          title="Registrar material nuevo"
                        >
                          <Plus className="size-4" aria-hidden />
                        </Button>
                      }
                    />
                  </div>
                </FormSelectField>

                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-2">
                    <Label htmlFor={`quantity-row-${index}`}>Cantidad</Label>
                    <div className="relative">
                      <Input
                        id={`quantity-row-${index}`}
                        ref={index === rows.length - 1 ? lastQuantityRef : undefined}
                        inputMode="decimal"
                        placeholder="0"
                        className="touch-target tabular pr-12 text-lg"
                        value={row.quantity}
                        onChange={(event) =>
                          updateRow(index, { quantity: event.target.value })
                        }
                        onKeyDown={(event) => handleKeyDown(event, index)}
                      />
                      {row.unit && (
                        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                          {UNIT_SHORT_LABELS[row.unit]}
                        </span>
                      )}
                    </div>
                  </div>

                  <FormField
                    id={`shade-row-${index}`}
                    label="Tono"
                    placeholder="A-42"
                    className="tabular"
                    value={row.shade}
                    onChange={(event) => updateRow(index, { shade: event.target.value })}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <FormSelectField id={`location-row-${index}`} label="Ubicación">
                    <Select
                      value={row.locationId || "none"}
                      onValueChange={(value) =>
                        updateRow(index, { locationId: value === "none" ? "" : value })
                      }
                    >
                      <SelectTrigger
                        id={`location-row-${index}`}
                        className="touch-target w-full"
                      >
                        <SelectValue placeholder="Sin asignar" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Sin asignar</SelectItem>
                        {locations.map((location) => (
                          <SelectItem key={location.id} value={location.id}>
                            {location.code}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormSelectField>

                  <FormField
                    id={`supplierLot-row-${index}`}
                    label="Lote proveedor"
                    className="tabular"
                    value={row.supplierLotNumber}
                    onChange={(event) =>
                      updateRow(index, { supplierLotNumber: event.target.value })
                    }
                  />
                </div>

                {/* Quién bajó ESTE rollo: es lo que sostiene su bonificación. */}
                <FormSelectField
                  id={`helper-row-${index}`}
                  label="Ayudante que lo bajó"
                >
                  <div className="flex gap-2">
                    <Select
                      value={row.helperId || "none"}
                      onValueChange={(value) =>
                        updateRow(index, {
                          helperId: value === "none" ? "" : value,
                        })
                      }
                    >
                      <SelectTrigger
                        id={`helper-row-${index}`}
                        className="touch-target min-w-0 flex-1"
                      >
                        <SelectValue placeholder="Sin asignar" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Sin asignar</SelectItem>
                        {helperOptions.map((helper) => (
                          <SelectItem key={helper.id} value={helper.id}>
                            {helper.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    {/* Llega un ayudante nuevo con el camión: se registra sin
                        salir de la captura. */}
                    <HelperFormDialog
                      onCreated={(helper) => {
                        setHelperOptions((current) => [...current, helper]);
                        updateRow(index, { helperId: helper.id });
                      }}
                      trigger={
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="touch-target shrink-0"
                          aria-label="Registrar ayudante nuevo"
                          title="Registrar ayudante nuevo"
                        >
                          <Plus className="size-4" aria-hidden />
                        </Button>
                      }
                    />
                  </div>
                </FormSelectField>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Button type="button" variant="outline" className="touch-target" onClick={addRow}>
              <Plus className="size-4" aria-hidden />
              Otro rollo
            </Button>
            <Button
              type="button"
              variant="outline"
              className="touch-target"
              onClick={duplicateLast}
            >
              <Copy className="size-4" aria-hidden />
              Duplicar
            </Button>
          </div>

          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              className="touch-target"
              onClick={() => setStep(1)}
            >
              <ArrowLeft className="size-4" aria-hidden />
              Atrás
            </Button>

            <Button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="h-12 flex-1"
            >
              <Save className="size-4" aria-hidden />
              {isSubmitting ? "Guardando…" : `Guardar ${rows.length} rollos`}
            </Button>
          </div>
        </section>
      )}

      {/* Confirmación de borrado. Sólo aparece si el renglón tiene algo
          capturado: preguntar por una fila vacía sería un estorbo. */}
      <AlertDialog
        open={rowToDelete !== null}
        onOpenChange={(open) => {
          if (!open) setRowToDelete(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              ¿Quitar el rollo {(rowToDelete ?? 0) + 1}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {describeRow(rows[rowToDelete ?? 0], materialOptions)}
            </AlertDialogDescription>
          </AlertDialogHeader>

          <AlertDialogFooter>
            <AlertDialogCancel className="touch-target">
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => removeRow(rowToDelete ?? 0)}
              className="touch-target bg-destructive text-white hover:bg-destructive/90"
            >
              Quitar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/**
 * Describe el renglón que se va a borrar.
 *
 * Con quince rollos capturados, "¿quitar el rollo 7?" no dice nada. El
 * material y el metraje sí: el auxiliar reconoce cuál es.
 */
function describeRow(
  row: LotRow | undefined,
  materials: MaterialOption[],
): string {
  if (!row) return "Se quitará de la captura.";

  const material = materials.find((item) => item.id === row.materialId);
  const partes: string[] = [];

  if (material) partes.push(material.name);
  if (row.quantity) {
    const unidad = row.unit ? ` ${UNIT_SHORT_LABELS[row.unit]}` : "";
    partes.push(`${row.quantity}${unidad}`);
  }
  if (row.shade) partes.push(`tono ${row.shade}`);

  if (partes.length === 0) return "Se quitará de la captura.";

  return `${partes.join(" · ")}. Se quitará de la captura y no se guardará.`;
}

function StepIndicator({ step }: { step: 1 | 2 }) {
  return (
    <ol className="flex items-center gap-2 text-sm">
      <Step number={1} label="Encabezado" active={step === 1} done={step > 1} />
      <span className="h-px flex-1 bg-border" aria-hidden />
      <Step number={2} label="Rollos" active={step === 2} done={false} />
    </ol>
  );
}

function Step({
  number,
  label,
  active,
  done,
}: {
  number: number;
  label: string;
  active: boolean;
  done: boolean;
}) {
  const isCurrent = active || done;

  return (
    <li className="flex items-center gap-2">
      <span
        className={
          isCurrent
            ? "tabular flex size-6 items-center justify-center rounded bg-primary text-xs font-medium text-primary-foreground"
            : "tabular flex size-6 items-center justify-center rounded border border-border text-xs text-muted-foreground"
        }
      >
        {number}
      </span>
      <span className={isCurrent ? "font-medium" : "text-muted-foreground"}>
        {label}
      </span>
    </li>
  );
}

function emptyRow(): LotRow {
  return {
    materialId: "",
    quantity: "",
    unit: "",
    locationId: "",
    helperId: "",
    shade: "",
    supplierLotNumber: "",
  };
}
