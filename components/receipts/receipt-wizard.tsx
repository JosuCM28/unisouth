"use client";

import { useMemo, useRef, useState } from "react";
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
import {
  UNIT_LABELS,
  UNIT_SHORT_LABELS,
  unitSelectGroups,
} from "@/lib/constants/labels";
import { cn, todayInputValue } from "@/lib/utils";
import { runAction } from "@/lib/offline/run-action";
import { FormField, FormSelectField } from "@/components/shared/form-field";
import {
  UnsavedChangesGuard,
  describeLoss,
} from "@/components/shared/unsaved-changes-guard";
import {
  SearchSelect,
  type SearchSelectOption,
} from "@/components/shared/search-select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/* Se arma una sola vez para todo el módulo: son 14 unidades fijas y hay un
   selector por renglón. Rearmarlas en cada tecla capturada, con veinte
   rollos en pantalla, se siente en un celular de bodega. */
const UNIT_GROUPS = unitSelectGroups();

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
    date: todayInputValue(),
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

  /* El dueño no es un dato del material sino de la recepción: se eligió en el
     paso 1 y aplica a todos los rollos de esta carga. Se muestra en cada
     renglón porque surtir tela del cliente equivocado es el error caro. */
  const clientName =
    clients.find((client) => client.id === header.clientId)?.name ?? null;

  /** Igual que los materiales: uno nuevo debe aparecer sin recargar. */
  const [helperOptions, setHelperOptions] = useState(helpers);

  /** Fila que se va a borrar. `null` = el diálogo está cerrado. */
  const [rowToDelete, setRowToDelete] = useState<number | null>(null);

  /* Rollos con algo capturado. La fecha del encabezado NO cuenta: viene
     prellenada con la de hoy y preguntar por ella sería preguntar por nada. */
  const capturedRows = rows.filter((row) => row.materialId || row.quantity).length;

  const headerTouched =
    Boolean(header.guideNumber) ||
    Boolean(header.carrierId) ||
    Boolean(header.origin) ||
    Boolean(header.supplierId) ||
    Boolean(header.clientId) ||
    Boolean(header.invoiceRef);

  /* Mientras se guarda ya no se avisa: el `router.push` del final es una
     salida legítima y el diálogo se atravesaría justo al terminar. */
  const hasUnsaved = !isSubmitting && (capturedRows > 0 || headerTouched);

  /* Las opciones se derivan una vez y no por renglón: con veinte rollos en
     pantalla, rearmar la lista de 200 materiales veinte veces por tecla
     capturada se siente en un celular de bodega. */
  const materialSelectOptions = useMemo<SearchSelectOption[]>(
    () =>
      materialOptions.map((material) => ({
        value: material.id,
        label: material.name,
        // El código va de subtítulo porque dos materiales pueden llamarse
        // casi igual y es el código lo que trae impresa la etiqueta.
        hint: material.code,
        // Color y composición no se pintan, pero sí se buscan: el auxiliar
        // muchas veces sabe "la azul marino" y no el nombre del catálogo.
        keywords: `${material.colorName ?? ""} ${material.composition ?? ""}`,
      })),
    [materialOptions],
  );

  const locationOptions = useMemo<SearchSelectOption[]>(
    () =>
      locations.map((location) => ({
        value: location.id,
        label: location.code,
        hint: location.name,
      })),
    [locations],
  );

  // El de ayudantes se pinta una vez POR RENGLÓN: aquí sí importa memorizarlo.
  const helperSelectOptions = useMemo(
    () => nameOptions(helperOptions),
    [helperOptions],
  );
  const carrierOptions = useMemo(() => nameOptions(carriers), [carriers]);
  const supplierOptions = useMemo(() => nameOptions(suppliers), [suppliers]);
  const clientOptions = useMemo(() => nameOptions(clients), [clients]);

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
    const result = await runAction(() => createReceiptAction({
      date: header.date,
      guideNumber: header.guideNumber || undefined,
      carrierId: header.carrierId || undefined,
      origin: header.origin || undefined,
      supplierId: header.supplierId || undefined,
      clientId: header.clientId || undefined,
      invoiceRef: header.invoiceRef || undefined,
      lots,
    }));
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
      {/* Veinte rollos tecleados de pie se van con un roce al "atrás" del
          teléfono. Ésta es la única red: no hay borrador ni autoguardado. */}
      <UnsavedChangesGuard
        when={hasUnsaved}
        description={
          capturedRows > 0
            ? describeLoss(capturedRows, "rollo", "rollos")
            : "Perderás los datos de la guía que capturaste."
        }
      />

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
              <SearchSelect
                id="carrierId"
                options={carrierOptions}
                value={header.carrierId}
                onChange={(value) => setHeader({ ...header, carrierId: value })}
                placeholder="Sin especificar"
                searchPlaceholder="Buscar paquetería…"
                clearLabel="Sin especificar"
              />
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
              <SearchSelect
                id="supplierId"
                options={supplierOptions}
                value={header.supplierId}
                onChange={(value) => setHeader({ ...header, supplierId: value })}
                placeholder="Sin especificar"
                searchPlaceholder="Buscar proveedor…"
                clearLabel="Sin especificar"
              />
            </FormSelectField>

            {/* El dueño se hereda a TODOS los rollos de la carga. */}
            <FormSelectField
              id="clientId"
              label="Cliente dueño"
              hint="Se aplica a todos los rollos de esta guía."
            >
              <SearchSelect
                id="clientId"
                options={clientOptions}
                value={header.clientId}
                onChange={(value) => setHeader({ ...header, clientId: value })}
                placeholder="De la fábrica"
                searchPlaceholder="Buscar cliente…"
                clearLabel="De la fábrica"
              />
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
                    {/* Buscador Y desplegable: con 200 materiales en el
                        catálogo, recorrer la lista con el dedo es más lento
                        que teclear tres letras. Se busca también por código y
                        por color, que es lo que trae impreso la etiqueta del
                        rollo cuando el nombre no se lee. */}
                    <SearchSelect
                      id={`material-row-${index}`}
                      className="min-w-0 flex-1"
                      options={materialSelectOptions}
                      value={row.materialId}
                      onChange={(value) => {
                        const material = materialOptions.find(
                          (item) => item.id === value,
                        );
                        updateRow(index, {
                          materialId: value,
                          unit: material?.baseUnit ?? "",
                        });
                      }}
                      placeholder="Elige el material"
                      searchPlaceholder="Buscar por nombre, código o color…"
                      emptyMessage="Ningún material coincide."
                    />

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

                  {/* Ficha rápida del material elegido: el auxiliar tiene el
                      rollo en la mano y necesita confirmar que la etiqueta
                      coincide con lo que acaba de escoger de la lista. */}
                  <MaterialPreview
                    material={materialOptions.find(
                      (item) => item.id === row.materialId,
                    )}
                    clientName={clientName}
                  />
                </FormSelectField>

                <div className="grid grid-cols-[1fr_auto] gap-3">
                  <div className="flex flex-col gap-2">
                    <Label htmlFor={`quantity-row-${index}`}>Cantidad</Label>
                    <Input
                      id={`quantity-row-${index}`}
                      ref={index === rows.length - 1 ? lastQuantityRef : undefined}
                      inputMode="decimal"
                      placeholder="0"
                      className="touch-target tabular text-lg"
                      value={row.quantity}
                      onChange={(event) =>
                        updateRow(index, { quantity: event.target.value })
                      }
                      onKeyDown={(event) => handleKeyDown(event, index)}
                    />
                  </div>

                  {/* La unidad se elige, no se impone. La tela viene en
                      metros casi siempre, pero cuando el proveedor sólo pesó
                      el rollo la nota trae kilos y hay que poder capturarla
                      tal cual, sin inventar una conversión. */}
                  <UnitPicker
                    index={index}
                    value={row.unit}
                    onChange={(unit) => updateRow(index, { unit })}
                  />
                </div>

                {/* Aviso, no bloqueo: quien recibe tiene el rollo en la mano
                    y sabe si de verdad viene en kilos. Sólo se le recuerda
                    en qué unidad está dado de alta el material, por si el
                    dedo resbaló en el selector. */}
                <UnitMismatchNotice
                  unit={row.unit}
                  material={materialOptions.find(
                    (item) => item.id === row.materialId,
                  )}
                />

                <FormField
                  id={`shade-row-${index}`}
                  label="Tono"
                  placeholder="A-42"
                  className="tabular"
                  value={row.shade}
                  onChange={(event) => updateRow(index, { shade: event.target.value })}
                />

                <div className="grid grid-cols-2 gap-3">
                  <FormSelectField id={`location-row-${index}`} label="Ubicación">
                    <SearchSelect
                      id={`location-row-${index}`}
                      options={locationOptions}
                      value={row.locationId}
                      onChange={(value) => updateRow(index, { locationId: value })}
                      placeholder="Sin asignar"
                      searchPlaceholder="Buscar ubicación…"
                      clearLabel="Sin asignar"
                    />
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
                    <SearchSelect
                      id={`helper-row-${index}`}
                      className="min-w-0 flex-1"
                      options={helperSelectOptions}
                      value={row.helperId}
                      onChange={(value) => updateRow(index, { helperId: value })}
                      placeholder="Sin asignar"
                      searchPlaceholder="Buscar ayudante…"
                      clearLabel="Sin asignar"
                    />

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
 * Selector de unidad del renglón.
 *
 * Angosto a propósito: comparte fila con la cantidad, que es el campo que
 * de verdad se teclea. Las unidades de diario van arriba y separadas del
 * resto del catálogo para no obligar a desplazar por el metro y el kilo.
 */
function UnitPicker({
  index,
  value,
  onChange,
}: {
  index: number;
  value: Unit | "";
  onChange: (unit: Unit) => void;
}) {
  return (
    <FormSelectField id={`unit-row-${index}`} label="Unidad">
      <Select value={value} onValueChange={(next) => onChange(next as Unit)}>
        <SelectTrigger id={`unit-row-${index}`} className="touch-target w-28">
          <SelectValue placeholder="—" />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            {UNIT_GROUPS.common.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectGroup>

          <SelectSeparator />

          <SelectGroup>
            <SelectLabel>Otras unidades</SelectLabel>
            {UNIT_GROUPS.rest.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </FormSelectField>
  );
}

/**
 * Avisa cuando el rollo se captura en una unidad distinta a la del material.
 *
 * No estorba el flujo: recibir en kilos algo dado de alta en metros es un
 * caso REAL y frecuente. Pero también es lo que se ve cuando alguien se
 * equivocó de renglón en el selector, y ese error llega hasta el kárdex.
 */
function UnitMismatchNotice({
  unit,
  material,
}: {
  unit: Unit | "";
  material: MaterialOption | undefined;
}) {
  if (!unit || !material || unit === material.baseUnit) return null;

  return (
    <p className="text-xs text-state-reserved">
      Este material se maneja en {UNIT_LABELS[material.baseUnit].toLowerCase()}{" "}
      ({UNIT_SHORT_LABELS[material.baseUnit]}). Se guardará en{" "}
      {UNIT_SHORT_LABELS[unit]} tal como llegó.
    </p>
  );
}

/**
 * Ficha rápida del material seleccionado.
 *
 * No repite el nombre —ya se lee en el select de arriba— sino lo que el
 * auxiliar necesita cotejar contra la etiqueta física: de quién es la tela,
 * de qué está hecha y de qué color. Si el material no trae esos datos
 * capturados, se dice explícitamente en vez de mostrar un hueco: "sin
 * composición registrada" es información, un espacio en blanco no.
 */
function MaterialPreview({
  material,
  clientName,
}: {
  material: MaterialOption | undefined;
  clientName: string | null;
}) {
  if (!material) return null;

  return (
    <dl className="mt-2 flex flex-col gap-1 border border-border bg-muted/40 p-2.5 text-xs">
      <PreviewRow
        label="Cliente dueño"
        value={clientName ?? "De la fábrica"}
      />
      <PreviewRow label="Color" value={material.colorName} />
      <PreviewRow label="Composición" value={material.composition} />
      <PreviewRow label="Código" value={material.code} tabular />

      {/* Sólo si aplica: en telas que lo exigen, capturar el tono no es
          opcional; dos partidas distintas en un tendido salen con franjas. */}
      {material.requiresShade && (
        <p className="mt-1 border-t border-border pt-1 text-state-reserved">
          Este material exige registrar el tono.
        </p>
      )}
    </dl>
  );
}

function PreviewRow({
  label,
  value,
  tabular,
}: {
  label: string;
  value: string | null;
  tabular?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="shrink-0 text-muted-foreground">{label}</dt>
      {/* break-words y NO truncate: la composición es justo el dato que se
          coteja contra la etiqueta del rollo, y cortarla con "…" en celular
          la vuelve inútil. Mejor que ocupe dos renglones. */}
      <dd
        className={cn(
          "min-w-0 break-words text-right",
          tabular && "tabular",
          !value && "text-muted-foreground",
        )}
      >
        {value || "Sin registrar"}
      </dd>
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

/** Catálogos que sólo son id + nombre: paquetería, proveedor, cliente, ayudante. */
function nameOptions(items: { id: string; name: string }[]): SearchSelectOption[] {
  return items.map((item) => ({ value: item.id, label: item.name }));
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
