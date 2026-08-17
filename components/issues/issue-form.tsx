"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { Unit } from "@prisma/client";
import { createDocumentAction } from "@/app/actions/document.actions";
import {
  availableLotsAction,
  type IssueLotOption,
} from "@/app/actions/issue.actions";
import type { RequirementResult } from "@/lib/services/calculation.service";
import { UNIT_SHORT_LABELS } from "@/lib/constants/labels";
import { formatQuantity } from "@/lib/utils";
import { FormSection } from "@/components/shared/form-section";
import { FormSelectField } from "@/components/shared/form-field";
import { SubmitButton } from "@/components/shared/submit-button";
import { ResponsiveFormDialog } from "@/components/shared/responsive-form-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { IssueLotPicker, type PickerState } from "./issue-lot-picker";
import {
  IssueFromCalculation,
  type IssueProductOption,
} from "./issue-from-calculation";

interface MaterialOption {
  id: string;
  code: string;
  name: string;
}

interface Props {
  materials: MaterialOption[];
  products: IssueProductOption[];
  sizes: { id: string; code: string; name: string }[];
  clients: { id: string; name: string }[];
  productionRuns: { id: string; code: string; name: string | null }[];
}

/** Un renglón ya armado: el rollo concreto y cuánto se le quita. */
interface IssueLine {
  lotId: string;
  lotCode: string;
  materialName: string;
  shade: string | null;
  isRemnant: boolean;
  available: number;
  unit: Unit;
  /** Texto, no número: el input vive a medio teclear. */
  quantity: string;
}

/**
 * Alta de una salida de almacén.
 *
 * Guardar deja el vale en BORRADOR y no toca existencias: el auxiliar puede
 * armarlo con calma, corregirlo y hasta dejarlo a medias. El stock se
 * descuenta al APLICARLO desde la ficha del vale, que es un acto aparte y
 * deliberado.
 */
export function IssueForm({
  materials,
  products,
  sizes,
  clients,
  productionRuns,
}: Props) {
  const router = useRouter();

  const [clientId, setClientId] = useState("");
  const [productionRunId, setProductionRunId] = useState("");
  const [concept, setConcept] = useState("");
  const [reference, setReference] = useState("");
  const [receivedBy, setReceivedBy] = useState("");
  const [notes, setNotes] = useState("");

  const [lines, setLines] = useState<IssueLine[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerMaterialId, setPickerMaterialId] = useState("");
  const [pickerState, setPickerState] = useState<PickerState>({ kind: "idle" });
  const [isSubmitting, setIsSubmitting] = useState(false);

  /**
   * Cambiar de dueño invalida los renglones ya puestos.
   *
   * Los rollos que se alcanzaron a elegir son del cliente anterior, y surtir
   * la tela de un cliente a la producción de otro es el error más caro que
   * puede cometer el sistema. Se vacían y se avisa, en vez de dejarlos
   * mezclados esperando a que alguien lo note al aplicar el vale.
   */
  function handleClientChange(nextClientId: string) {
    setClientId(nextClientId);
    setPickerState({ kind: "idle" });
    setPickerMaterialId("");

    if (lines.length > 0) {
      setLines([]);
      toast.info("Se limpiaron los renglones: eran rollos de otro cliente.");
    }
  }

  /**
   * Busca los rollos del material recién elegido.
   *
   * Se dispara desde el evento y no desde un efecto: elegir material ES la
   * acción, y encadenarla a un efecto sólo agregaría un render intermedio en
   * el que la lista anterior sigue tocable.
   */
  async function handleMaterialChange(materialId: string) {
    setPickerMaterialId(materialId);
    setPickerState({ kind: "loading" });

    const result = await availableLotsAction({
      materialId,
      clientId: clientId || undefined,
    });

    if (!result.success) {
      setPickerState({ kind: "error", message: result.error });
      return;
    }

    setPickerState({ kind: "ready", lots: result.data });
  }

  function handlePick(lot: IssueLotOption) {
    setLines((current) => [
      ...current,
      {
        lotId: lot.id,
        lotCode: lot.code,
        materialName: lot.materialName,
        shade: lot.shade,
        isRemnant: lot.isRemnant,
        available: lot.available,
        unit: lot.unit as Unit,
        quantity: "",
      },
    ]);

    closePicker();
  }

  /** Deja el selector en blanco: al reabrirlo se elige material otra vez. */
  function closePicker() {
    setPickerOpen(false);
    setPickerMaterialId("");
    setPickerState({ kind: "idle" });
  }

  function updateQuantity(index: number, value: string) {
    setLines((current) =>
      current.map((line, position) =>
        position === index ? { ...line, quantity: value } : line,
      ),
    );
  }

  function removeLine(index: number) {
    setLines((current) => current.filter((_, position) => position !== index));
  }

  /**
   * Llena los renglones con lo que propuso el cálculo.
   *
   * Reemplaza los renglones en vez de acumularlos: si el auxiliar corrige la
   * cantidad de piezas y vuelve a explotar, sumar dejaría el doble de tela
   * sin que se note.
   */
  function handleExplode(requirements: RequirementResult[]) {
    const explodedLines: IssueLine[] = [];

    for (const requirement of requirements) {
      for (const suggested of requirement.suggestedLots) {
        explodedLines.push({
          lotId: suggested.lotId,
          lotCode: suggested.code,
          materialName: requirement.materialName,
          shade: suggested.shade,
          isRemnant: suggested.isRemnant,
          available: suggested.quantity,
          unit: requirement.unit,
          quantity: String(suggested.quantity),
        });
      }
    }

    setLines(explodedLines);

    const faltantes = requirements.filter((item) => !item.sufficient);

    if (faltantes.length > 0) {
      const mensaje =
        faltantes.length === 1
          ? "1 material no alcanza"
          : `${faltantes.length} materiales no alcanzan`;
      toast.warning(`${mensaje}: revisa los renglones antes de guardar.`);
      return;
    }

    toast.success(
      `${explodedLines.length} renglones llenados desde el cálculo`,
    );
  }

  async function handleSubmit() {
    const validLines = lines.filter((line) => Number(line.quantity) > 0);

    if (validLines.length === 0) {
      toast.error("Agrega al menos un rollo con cantidad.");
      return;
    }

    // Se avisa ANTES de mandar: al aplicar, el servicio rechazaría el vale
    // completo y el auxiliar tendría que rehacerlo entero.
    const excedida = validLines.find(
      (line) => Number(line.quantity) > line.available,
    );

    if (excedida) {
      const disponible = formatQuantity(excedida.available, {
        unit: UNIT_SHORT_LABELS[excedida.unit],
      });
      toast.error(`${excedida.lotCode} sólo tiene ${disponible}.`);
      return;
    }

    setIsSubmitting(true);

    const result = await createDocumentAction({
      type: "ISSUE",
      clientId: clientId || undefined,
      productionRunId: productionRunId || undefined,
      concept: concept || undefined,
      reference: reference || undefined,
      receivedBy: receivedBy || undefined,
      notes: notes || undefined,
      lines: validLines.map((line) => ({
        lotId: line.lotId,
        quantity: Number(line.quantity),
        unit: line.unit,
      })),
    });

    setIsSubmitting(false);

    if (!result.success) {
      toast.error(result.error);
      return;
    }

    toast.success("Salida guardada en borrador. Aplícala para descontar.");
    router.push(`/documents/${result.data.id}`);
  }

  const usedLotIds = lines.map((line) => line.lotId);

  return (
    <div className="flex flex-col gap-4">
      <div className="flat-surface flex flex-col gap-4 p-4">
        <FormSelectField
          id="issue-client"
          label="Cliente dueño del material"
          hint="Al elegirlo sólo se ofrecen sus rollos: su tela no surte la producción de otro."
        >
          <Select value={clientId} onValueChange={handleClientChange}>
            <SelectTrigger id="issue-client" className="touch-target">
              <SelectValue placeholder="Todos" />
            </SelectTrigger>
            <SelectContent>
              {clients.map((client) => (
                <SelectItem key={client.id} value={client.id}>
                  {client.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormSelectField>

        <div className="flex flex-wrap gap-2">
          <IssueFromCalculation
            products={products}
            sizes={sizes}
            clientId={clientId || undefined}
            onExplode={handleExplode}
          />

          <ResponsiveFormDialog
            open={pickerOpen}
            onOpenChange={(next) => (next ? setPickerOpen(true) : closePicker())}
            title="Agregar rollo"
            description="Se ofrecen primero los retazos y luego los más viejos."
            trigger={
              <Button type="button" variant="outline" className="touch-target">
                <Plus className="size-4" aria-hidden />
                Agregar rollo
              </Button>
            }
          >
            <div className="flex flex-col gap-4">
              <FormSelectField id="picker-material" label="Material">
                <Select
                  value={pickerMaterialId}
                  onValueChange={handleMaterialChange}
                >
                  <SelectTrigger id="picker-material" className="touch-target">
                    <SelectValue placeholder="Elige el material" />
                  </SelectTrigger>
                  <SelectContent>
                    {materials.map((material) => (
                      <SelectItem key={material.id} value={material.id}>
                        {material.code} · {material.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormSelectField>

              <IssueLotPicker
                state={pickerState}
                excludeLotIds={usedLotIds}
                hasClientFilter={Boolean(clientId)}
                onPick={handlePick}
              />
            </div>
          </ResponsiveFormDialog>
        </div>
      </div>

      <IssueLines
        lines={lines}
        onChangeQuantity={updateQuantity}
        onRemove={removeLine}
      />

      <div className="flat-surface p-4">
        <FormSection title="Detalles del vale">
          <div className="flex flex-col gap-4">
            <FormSelectField
              id="issue-run"
              label="Producción"
              hint="Para qué corrida sale el material."
            >
              <Select
                value={productionRunId}
                onValueChange={setProductionRunId}
              >
                <SelectTrigger id="issue-run" className="touch-target">
                  <SelectValue placeholder="Sin producción" />
                </SelectTrigger>
                <SelectContent>
                  {productionRuns.map((run) => (
                    <SelectItem key={run.id} value={run.id}>
                      {run.code}
                      {run.name && ` · ${run.name}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormSelectField>

            <div className="flex flex-col gap-2">
              <Label htmlFor="issue-concept">Concepto</Label>
              <Input
                id="issue-concept"
                placeholder="Corte de 3,000 pantalones"
                value={concept}
                onChange={(event) => setConcept(event.target.value)}
                className="touch-target"
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="issue-received-by">Quién recibe</Label>
              <Input
                id="issue-received-by"
                placeholder="Nombre de quien se lleva el material"
                value={receivedBy}
                onChange={(event) => setReceivedBy(event.target.value)}
                className="touch-target"
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="issue-reference">Referencia</Label>
              <Input
                id="issue-reference"
                placeholder="Orden de producción, vale en papel…"
                value={reference}
                onChange={(event) => setReference(event.target.value)}
                className="touch-target"
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="issue-notes">Notas</Label>
              <Textarea
                id="issue-notes"
                rows={3}
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
              />
            </div>
          </div>
        </FormSection>
      </div>

      <div className="flex flex-col gap-2">
        <SubmitButton
          type="button"
          onClick={handleSubmit}
          isSubmitting={isSubmitting}
          pendingLabel="Guardando…"
          disabled={lines.length === 0}
          className="h-12 w-full"
        >
          Guardar salida en borrador
        </SubmitButton>

        <p className="text-center text-xs text-muted-foreground">
          Guardar no descuenta existencias. El stock se mueve al aplicar el
          vale.
        </p>
      </div>
    </div>
  );
}

interface LinesProps {
  lines: IssueLine[];
  onChangeQuantity: (index: number, value: string) => void;
  onRemove: (index: number) => void;
}

/** Los renglones del vale, cada uno con su rollo y su cantidad. */
function IssueLines({ lines, onChangeQuantity, onRemove }: LinesProps) {
  if (lines.length === 0) {
    return (
      <div className="flat-surface p-6 text-center">
        <p className="text-sm text-muted-foreground">
          Aún no hay renglones. Agrega un rollo o trae los insumos de un
          cálculo.
        </p>
      </div>
    );
  }

  return (
    <section className="flat-surface p-4">
      <h2 className="mb-3 text-sm font-semibold">Renglones ({lines.length})</h2>

      <ul className="flex flex-col gap-3">
        {lines.map((line, index) => (
          <IssueLineRow
            key={`${line.lotId}-${index}`}
            line={line}
            index={index}
            onChangeQuantity={onChangeQuantity}
            onRemove={onRemove}
          />
        ))}
      </ul>
    </section>
  );
}

interface LineRowProps {
  line: IssueLine;
  index: number;
  onChangeQuantity: (index: number, value: string) => void;
  onRemove: (index: number) => void;
}

function IssueLineRow({
  line,
  index,
  onChangeQuantity,
  onRemove,
}: LineRowProps) {
  const excede = Number(line.quantity) > line.available;
  const unitLabel = UNIT_SHORT_LABELS[line.unit];

  return (
    <li className="flex flex-col gap-2 border-b border-border pb-3 last:border-b-0 last:pb-0">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="tabular text-sm font-medium">{line.lotCode}</p>
          <p className="truncate text-xs text-muted-foreground">
            {line.materialName}
            {line.shade && ` · tono ${line.shade}`}
            {line.isRemnant && " · retazo"}
          </p>
        </div>

        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => onRemove(index)}
          aria-label={`Quitar ${line.lotCode}`}
          className="touch-target shrink-0"
        >
          <Trash2 className="size-4" aria-hidden />
        </Button>
      </div>

      <div className="flex items-center gap-2">
        <Input
          // Metros con decimales: el teclado numérico puro no trae punto.
          inputMode="decimal"
          placeholder="0"
          value={line.quantity}
          onChange={(event) => onChangeQuantity(index, event.target.value)}
          aria-invalid={excede}
          aria-label={`Cantidad de ${line.lotCode}`}
          className="touch-target tabular"
        />
        <span className="shrink-0 text-sm text-muted-foreground">
          {unitLabel}
        </span>
      </div>

      <p className="tabular text-xs text-muted-foreground">
        Disponible: {formatQuantity(line.available, { unit: unitLabel })}
      </p>

      {excede && (
        <p className="text-xs text-destructive">
          Excede lo disponible en este rollo.
        </p>
      )}
    </li>
  );
}
