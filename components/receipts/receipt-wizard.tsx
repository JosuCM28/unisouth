"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Copy, Plus, Save } from "lucide-react";
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
import { ReceiptRow, type LotRow } from "./receipt-row";
import {
  ReceiptEmailDialog,
  type ReceiptEmailOptions,
} from "./receipt-email-dialog";
import { toast } from "sonner";
import type { Unit } from "@prisma/client";
import { createReceiptAction } from "@/app/actions/receipt.actions";
import type { MaterialOption } from "@/lib/repositories/material.repository";
import { UNIT_SHORT_LABELS } from "@/lib/constants/labels";
import { todayInputValue } from "@/lib/utils";
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

interface HeaderState {
  date: string;
  guideNumber: string;
  carrierId: string;
  origin: string;
  supplierId: string;
  invoiceRef: string;
}

interface ReceiptWizardProps {
  materials: MaterialOption[];
  helpers: { id: string; name: string }[];
  locations: { id: string; code: string; name: string }[];
  clients: { id: string; name: string }[];
  suppliers: { id: string; name: string }[];
  carriers: { id: string; name: string }[];
  /**
   * El canal de correo, para ofrecer mandar la recepción al guardarla. Si
   * ADMIN lo tiene apagado, guardar lleva directo al inventario como antes.
   */
  email: ReceiptEmailOptions;
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
  email,
}: ReceiptWizardProps) {
  const router = useRouter();
  /* La recepción recién guardada, mientras se pregunta si se manda por
     correo. Con ella puesta la captura ya está a salvo en la base. */
  const [saved, setSaved] = useState<{ id: string; code: string } | null>(
    null,
  );
  const [step, setStep] = useState<1 | 2>(1);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [header, setHeader] = useState<HeaderState>({
    date: todayInputValue(),
    guideNumber: "",
    carrierId: "",
    origin: "",
    supplierId: "",
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

  /* Renglón que pidió dar de alta un material o un ayudante. Hay UN diálogo
     de cada uno para toda la captura, no uno por renglón: con 80 rollos eran
     160 formularios montados que nadie abría y que sí costaban en cada
     render. `null` = cerrado. */
  const [materialDialogRow, setMaterialDialogRow] = useState<number | null>(
    null,
  );
  const [helperDialogRow, setHelperDialogRow] = useState<number | null>(null);

  /* Rollos con algo capturado. La fecha del encabezado NO cuenta: viene
     prellenada con la de hoy y preguntar por ella sería preguntar por nada. */
  const capturedRows = rows.filter((row) => row.materialId || row.quantity).length;

  const headerTouched =
    Boolean(header.guideNumber) ||
    Boolean(header.carrierId) ||
    Boolean(header.origin) ||
    Boolean(header.supplierId) ||
    Boolean(header.invoiceRef);

  /* Mientras se guarda ya no se avisa: el `router.push` del final es una
     salida legítima y el diálogo se atravesaría justo al terminar. */
  const hasUnsaved =
    !isSubmitting && !saved && (capturedRows > 0 || headerTouched);

  /* Índice por id: cada renglón necesita SU material (ficha, aviso de
     unidad) y un `.find()` sobre 200 por renglón y por render era trabajo
     de más. Además devuelve el mismo objeto siempre, que es lo que deja
     al renglón memorizado saltarse el render. */
  const materialById = useMemo(
    () => new Map(materialOptions.map((material) => [material.id, material])),
    [materialOptions],
  );

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

  /* De aquí para abajo, todo lo que baja a `ReceiptRow` va en `useCallback`
     y recibe el índice como argumento. Si se armara un cierre por renglón,
     cada render entregaría funciones nuevas y el `memo` del renglón no
     serviría: volverían a pintarse los 80 con cada tecla. */

  const updateRow = useCallback((index: number, patch: Partial<LotRow>) => {
    // Los demás renglones conservan su MISMO objeto: así el memo los salta.
    setRows((current) =>
      current.map((row, i) => (i === index ? { ...row, ...patch } : row)),
    );
  }, []);

  const selectMaterial = useCallback(
    (index: number, materialId: string) => {
      updateRow(index, {
        materialId,
        unit: materialById.get(materialId)?.baseUnit ?? "",
      });
    },
    [materialById, updateRow],
  );

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
  const duplicateLast = useCallback(() => {
    setRows((current) => {
      const last = current[current.length - 1];
      if (!last) return [...current, emptyRow()];
      return [...current, { ...last, quantity: "" }];
    });

    // El foco va al metraje del renglón nuevo: es el único campo que cambia.
    setTimeout(() => lastQuantityRef.current?.focus(), 50);
  }, []);

  const removeRow = useCallback((index: number) => {
    setRows((current) =>
      current.length === 1 ? current : current.filter((_, i) => i !== index),
    );
    setRowToDelete(null);
  }, []);

  /**
   * Pide confirmación antes de borrar.
   *
   * Un renglón capturado puede llevar medio minuto de trabajo —material,
   * metraje, tono, lote del proveedor— y el bote de basura queda a un dedo
   * del campo de cantidad. Sin confirmación, un roce con el guante borra la
   * captura y no hay forma de deshacerla.
   *
   * Si está en blanco lo dice el propio renglón: así esta función no depende
   * de `rows` y no cambia en cada tecla.
   */
  const requestRemove = useCallback(
    (index: number, isBlank: boolean) => {
      // Una fila en blanco no vale la pregunta: no hay nada que perder.
      if (isBlank) {
        removeRow(index);
        return;
      }

      setRowToDelete(index);
    },
    [removeRow],
  );

  /** Enter avanza al siguiente renglón, como en una hoja de cálculo. */
  const handleEnter = useCallback(
    (index: number, isLast: boolean) => {
      if (isLast) {
        duplicateLast();
        return;
      }

      document
        .querySelector<HTMLInputElement>(`#quantity-row-${index + 1}`)
        ?.focus();
    },
    [duplicateLast],
  );

  /** Al crear un material desde aquí, se selecciona en la fila que lo pidió. */
  function handleMaterialCreated(
    index: number,
    material: { id: string; name: string; baseUnit: Unit },
  ) {
    setMaterialOptions((current) => [...current, material as MaterialOption]);
    updateRow(index, { materialId: material.id, unit: material.baseUnit });
  }

  async function handleSubmit() {
    const lots = rows
      .filter((row) => row.materialId && row.quantity)
      .map((row) => ({
        materialId: row.materialId,
        quantity: row.quantity,
        unit: row.unit,
        locationId: row.locationId || undefined,
        clientId: row.clientId || undefined,
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
      invoiceRef: header.invoiceRef || undefined,
      lots,
    }));
    setIsSubmitting(false);

    if (!result.success) {
      toast.error(result.error);
      return;
    }

    const data = result.data as {
      receipt: { id: string; code: string };
      lotCodes: string[];
    };
    toast.success(
      `Recepción registrada con ${data.lotCodes.length} ${data.lotCodes.length === 1 ? "rollo" : "rollos"}`,
    );

    /* Con el correo prendido se pregunta ANTES de irse: la pregunta es sobre
       esta carga, y en el inventario ya no habría a qué contestarla. */
    if (email.enabled) {
      setSaved({ id: data.receipt.id, code: data.receipt.code });
      return;
    }

    goToInventory();
  }

  function goToInventory() {
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

      {saved && (
        <ReceiptEmailDialog
          receiptId={saved.id}
          receiptCode={saved.code}
          email={email}
          mode="after-save"
          open
          onOpenChange={() => undefined}
          onDone={goToInventory}
        />
      )}

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

          {/* El dueño NO está aquí: se elige en cada rollo, porque una misma
              guía puede traer tela de dos clientes. */}
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
            {rows.map((row, index) => {
              const isLast = index === rows.length - 1;

              return (
                <ReceiptRow
                  key={index}
                  index={index}
                  row={row}
                  material={materialById.get(row.materialId)}
                  isLast={isLast}
                  canRemove={rows.length > 1}
                  quantityRef={isLast ? lastQuantityRef : undefined}
                  materialOptions={materialSelectOptions}
                  clientOptions={clientOptions}
                  locationOptions={locationOptions}
                  helperOptions={helperSelectOptions}
                  onChange={updateRow}
                  onSelectMaterial={selectMaterial}
                  onRemove={requestRemove}
                  onEnter={handleEnter}
                  onNewMaterial={setMaterialDialogRow}
                  onNewHelper={setHelperDialogRow}
                />
              );
            })}
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

      {/* Llega un material que nadie dio de alta: se registra aquí mismo y
          queda seleccionado en el renglón que lo pidió, sin perder la captura
          de los rollos anteriores. */}
      <MaterialFormDialog
        open={materialDialogRow !== null}
        onOpenChange={(open) => {
          if (!open) setMaterialDialogRow(null);
        }}
        onCreated={(material) => {
          if (materialDialogRow !== null) {
            handleMaterialCreated(materialDialogRow, material);
          }
        }}
      />

      {/* Llega un ayudante nuevo con el camión: se registra sin salir de la
          captura y queda asignado al renglón que lo pidió. */}
      <HelperFormDialog
        open={helperDialogRow !== null}
        onOpenChange={(open) => {
          if (!open) setHelperDialogRow(null);
        }}
        onCreated={(helper) => {
          setHelperOptions((current) => [...current, helper]);
          if (helperDialogRow !== null) {
            updateRow(helperDialogRow, { helperId: helper.id });
          }
        }}
      />

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
              {describeRow(rows[rowToDelete ?? 0], materialById)}
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
  materialById: Map<string, MaterialOption>,
): string {
  if (!row) return "Se quitará de la captura.";

  const material = materialById.get(row.materialId);
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
    clientId: "",
    helperId: "",
    shade: "",
    supplierLotNumber: "",
  };
}
