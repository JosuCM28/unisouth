"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { Unit } from "@prisma/client";
import {
  createDocumentAction,
  updateDocumentAction,
} from "@/app/actions/document.actions";
import {
  availableLotsAction,
  type IssueLotOption,
} from "@/app/actions/issue.actions";
import type { RequirementResult } from "@/lib/services/calculation.service";
import { UNIT_SHORT_LABELS } from "@/lib/constants/labels";
import { sumIssueLines, type IssueTotals } from "@/lib/issue-totals";
import { formatQuantity } from "@/lib/utils";
import { runAction } from "@/lib/offline/run-action";
import { FormSection } from "@/components/shared/form-section";
import { FormSelectField } from "@/components/shared/form-field";
import { SubmitButton } from "@/components/shared/submit-button";
import { UnsavedChangesGuard } from "@/components/shared/unsaved-changes-guard";
import { ResponsiveFormDialog } from "@/components/shared/responsive-form-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SearchSelect } from "@/components/shared/search-select";
import { ApplicableRules } from "@/components/rules/applicable-rules";
import { IssueLotPicker, type PickerState } from "./issue-lot-picker";
import { IssueLotCorrectDialog } from "./issue-lot-correct-dialog";
import { IssueRunningTotal } from "./issue-running-total";
import {
  IssueCutTable,
  type CutLineDraft,
  type CutTagOption,
  type SizeOption,
} from "./issue-cut-table";
import {
  IssueCutHeader,
  EMPTY_CUT_HEADER,
  type CutHeaderDraft,
} from "./issue-cut-header";
import {
  IssueFromCalculation,
  type IssueProductOption,
} from "./issue-from-calculation";

interface MaterialOption {
  id: string;
  code: string;
  name: string;
  /** Rollos surtibles hoy. Se muestra para no elegir a ciegas. */
  lotCount: number;
  /** Dueños que tienen rollos de este material. */
  clientIds: string[];
}

/**
 * Una salida en BORRADOR que se vuelve a abrir para corregir.
 *
 * Sólo los borradores: una salida aplicada ya movió inventario y editarla
 * dejaría el kárdex sin explicación. Eso lo rechaza el servicio, y aquí ni
 * siquiera se ofrece.
 */
export interface EditableIssue {
  id: string;
  clientId: string | null;
  productionRunId: string | null;
  concept: string | null;
  reference: string | null;
  receivedBy: string | null;
  notes: string | null;
  cutHeader: CutHeaderDraft;
  lines: {
    lotId: string;
    lotCode: string;
    materialName: string;
    shade: string | null;
    isRemnant: boolean;
    available: number;
    unit: Unit;
    quantity: string;
  }[];
  cutLines: CutLineDraft[];
}

interface ClientOption {
  id: string;
  name: string;
  lotCount: number;
}

/** Centinela del material propio: en la base es `clientId = null`. */
const FACTORY_OWNER = "__factory__";

interface Props {
  materials: MaterialOption[];
  products: IssueProductOption[];
  sizes: { id: string; code: string; name: string }[];
  /** Catálogo completo para la tabla de corte, con su grupo de escala. */
  cutSizes: SizeOption[];
  /** Foleos disponibles, administrados en /cut-tags. */
  cutTags: CutTagOption[];
  clients: ClientOption[];
  productionRuns: { id: string; code: string; name: string | null }[];
  /** Presente = se está corrigiendo un borrador, no creando uno nuevo. */
  document?: EditableIssue;
  /**
   * Si quien tiene la pantalla abierta puede ajustar saldos.
   *
   * Corregir el metraje de un rollo es un reconteo, y eso exige
   * `inventory:adjust`, no el `inventory:write` que basta para armar el vale.
   * Dirección tiene lo segundo y no lo primero, así que el botón se le
   * esconde en vez de dejarlo tocar algo que el servidor va a rechazar.
   */
  canAdjust?: boolean;
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
  cutSizes,
  cutTags,
  clients,
  productionRuns,
  document,
  canAdjust = false,
}: Props) {
  const router = useRouter();
  const isEditing = Boolean(document);

  const [clientId, setClientId] = useState(
    document?.clientId ?? (document ? FACTORY_OWNER : ""),
  );
  const [productionRunId, setProductionRunId] = useState(
    document?.productionRunId ?? "",
  );
  const [concept, setConcept] = useState(document?.concept ?? "");
  const [reference, setReference] = useState(document?.reference ?? "");
  const [receivedBy, setReceivedBy] = useState(document?.receivedBy ?? "");
  const [notes, setNotes] = useState(document?.notes ?? "");

  /* El centinela "de la fábrica" sólo vive en la interfaz: hacia el servidor
     viaja como ausencia de dueño, que es como está guardado en la base. */
  const realClientId =
    clientId && clientId !== FACTORY_OWNER ? clientId : undefined;

  const [lines, setLines] = useState<IssueLine[]>(document?.lines ?? []);
  const [cutLines, setCutLines] = useState<CutLineDraft[]>(
    document?.cutLines ?? [],
  );
  const [cutHeader, setCutHeader] = useState<CutHeaderDraft>(
    document?.cutHeader ?? EMPTY_CUT_HEADER,
  );
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerMaterialId, setPickerMaterialId] = useState("");
  const [pickerState, setPickerState] = useState<PickerState>({ kind: "idle" });
  const [isSubmitting, setIsSubmitting] = useState(false);

  /* Foto del vale tal como se cargó, para saber después si se tocó algo.
     Se calcula una sola vez: el documento no cambia mientras la pantalla
     está abierta. */
  const [originalSnapshot] = useState(() =>
    snapshot(
      document?.lines ?? [],
      document?.cutLines ?? [],
      document?.cutHeader ?? EMPTY_CUT_HEADER,
      document?.concept ?? "",
      document?.reference ?? "",
      document?.receivedBy ?? "",
      document?.notes ?? "",
    ),
  );

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

    const result = await runAction(() => availableLotsAction({
      materialId,
      clientId: realClientId,
    }));

    if (!result.success) {
      setPickerState({ kind: "error", message: result.error });
      return;
    }

    setPickerState({ kind: "ready", lots: result.data });
  }

  /**
   * Agrega el rollo y DEJA el selector abierto.
   *
   * Una salida normal se lleva ocho o diez rollos del mismo material. Cerrar
   * el diálogo en cada uno obligaba a reabrirlo y volver a elegir material
   * diez veces; ahora se van marcando de corrido y se cierra al terminar.
   *
   * La cantidad se propone en el disponible completo: lo habitual es sacar el
   * rollo entero, y el que sale a medias se corrige tecleando encima.
   */
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
        quantity: String(lot.available),
      },
    ]);
  }

  /**
   * Abre el selector y, si no hay nada que elegir, se salta el paso.
   *
   * Con un solo material surtible —lo normal cuando ya se filtró por dueño—
   * obligar a elegirlo es un toque de más que no aporta información: se carga
   * su lista de rollos de una vez y el auxiliar ya está marcando.
   */
  function openPicker() {
    setPickerOpen(true);

    const only = visibleMaterials.length === 1 ? visibleMaterials[0] : undefined;
    if (only && !pickerMaterialId) void handleMaterialChange(only.id);
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
   * El rollo se acaba de recontar: el renglón se pone al día con lo que de
   * verdad quedó.
   *
   * La cantidad a surtir se reajusta sólo si se había quedado por encima de
   * lo que hay. Si el auxiliar ya había tecleado menos —está sacando un
   * pedazo, no el rollo entero— pisarle el número le borraría la captura.
   */
  function handleCorrected(
    index: number,
    corrected: { available: number; unit: Unit },
  ) {
    setLines((current) =>
      current.map((line, position) => {
        if (position !== index) return line;

        const excedia = Number(line.quantity) > corrected.available;

        return {
          ...line,
          available: corrected.available,
          unit: corrected.unit,
          quantity: excedia ? String(corrected.available) : line.quantity,
        };
      }),
    );
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
    const validCutLines = cutLines.filter(
      (line) => line.sizeId && Number(line.quantity) > 0,
    );

    /* Se acepta una salida SÓLO con desglose de cortes: a veces lo que se
       manda al taller son prendas ya cortadas y no hay tela que descontar.
       Lo que no tiene sentido es un vale vacío por completo. */
    if (validLines.length === 0 && validCutLines.length === 0) {
      toast.error("Agrega al menos un rollo o una talla al desglose.");
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

    const payload = {
      type: "ISSUE" as const,
      clientId: realClientId,
      productionRunId: productionRunId || undefined,
      concept: concept || undefined,
      reference: reference || undefined,
      receivedBy: receivedBy || undefined,
      notes: notes || undefined,
      // El encabezado del desglose: qué prenda, con qué tela y en qué versión.
      // Va siempre, aunque el vale no lleve tallas: no estorba y evita tener
      // que decidir aquí si "cuenta" como desglose.
      cutDescription: cutHeader.cutDescription || undefined,
      cutFabricId: cutHeader.cutFabricId || undefined,
      cutFabricText: cutHeader.cutFabricText || undefined,
      cutPattern: cutHeader.cutPattern || undefined,
      cutVersion: cutHeader.cutVersion || undefined,
      cutVersionNotes: cutHeader.cutVersionNotes || undefined,
      cutNotes: cutHeader.cutNotes,
      lines: validLines.map((line) => ({
        lotId: line.lotId,
        quantity: Number(line.quantity),
        unit: line.unit,
      })),
      // Sólo los renglones completos: uno a medio teclear no es un error del
      // usuario, es un renglón que todavía no termina de llenar.
      cutLines: validCutLines
        .map((line) => ({
          sizeId: line.sizeId,
          quantity: Number(line.quantity),
          bundles: Number(line.bundles) || 1,
          tagId: line.tag || undefined,
          notes: line.notes || undefined,
        })),
    };

    /* Editar sólo aplica a borradores. El servicio lo vuelve a comprobar: si
       alguien deja la pestaña abierta y el vale se aplica desde otro lado, el
       guardado se rechaza en vez de reescribir un documento ya aplicado. */
    const result = document
      ? await runAction(() => updateDocumentAction({ id: document.id, data: payload }))
      : await runAction(() => createDocumentAction(payload));

    setIsSubmitting(false);

    if (!result.success) {
      toast.error(result.error);
      return;
    }

    if (isEditing) {
      toast.success("Borrador actualizado");
      router.push(`/documents/${document!.id}`);
      return;
    }

    toast.success("Salida guardada en borrador. Aplícala para descontar.");
    router.push(`/documents/${result.data.id}`);
  }

  const usedLotIds = lines.map((line) => line.lotId);

  /* Se recalcula en cada tecla: el punto de mostrarlo es que el total siga a
     la mano que escribe. Son decenas de renglones, no miles, así que sumar
     de nuevo cuesta menos que cualquier esquema para evitarlo. */
  const totals = useMemo(() => sumIssueLines(lines), [lines]);

  /* Un vale es guardable si lleva ALGO: rollos que descontar o prendas en el
     desglose. Sólo con cortes es un caso legítimo —se manda al taller lo ya
     cortado— y por eso el botón no puede exigir rollos. */
  const hasSomething =
    lines.length > 0 ||
    cutLines.some((line) => line.sizeId && Number(line.quantity) > 0);

  /* Trabajo que se perdería al salir.
   *
   * Al CORREGIR un borrador no basta con "tiene renglones": el vale ya venía
   * con ellos y preguntar nada más por abrirlo y cerrarlo sería un estorbo.
   * Se compara contra lo que se cargó, así que sólo molesta si de verdad se
   * tocó algo. En un vale nuevo cualquier captura cuenta. */
  const hasUnsaved =
    !isSubmitting &&
    (isEditing
      ? snapshot(lines, cutLines, cutHeader, concept, reference, receivedBy, notes) !==
        originalSnapshot
      : hasSomething || Boolean(concept || reference || receivedBy || notes));

  /* Para el SELECTOR DE ROLLOS sólo se ofrecen materiales con existencia, y
     con dueño elegido sólo los suyos. Antes se listaba el catálogo entero y la
     mitad devolvía lista vacía: el auxiliar tenía que probar uno por uno para
     descubrir cuál tenía tela.

     Esto NO aplica al encabezado del corte, que ofrece el catálogo completo:
     ahí la tela se nombra aunque no haya rollo que descontar. */
  const visibleMaterials = (
    clientId
      ? materials.filter((material) => material.clientIds.includes(clientId))
      : materials
  ).filter((material) => material.lotCount > 0);

  return (
    <div className="flex flex-col gap-4">
      {/* Armar un vale es elegir rollo por rollo de una lista: rehacerlo
          porque el pulgar rozó "atrás" son varios minutos perdidos. */}
      <UnsavedChangesGuard
        when={hasUnsaved}
        description={describeIssueLoss(lines.length, cutLines.length)}
      />

      <div className="flat-surface flex flex-col gap-4 p-4">
        <FormSelectField
          id="issue-client"
          label="Empresa dueña del corte"
          hint="Al elegirla sólo se ofrecen sus rollos: su tela no surte la producción de otro. Se ofrecen todas, tengan rollos o no."
        >
          <SearchSelect
            id="issue-client"
            options={clients.map((client) => ({
              value: client.id,
              label: client.name,
              // Se dice "sin rollos" en vez de "0 rollos": el cero se lee como
              // un dato que falta, y aquí es una empresa perfectamente
              // elegible para una salida de puros cortes.
              hint:
                client.lotCount > 0
                  ? `${client.lotCount} ${client.lotCount === 1 ? "rollo" : "rollos"}`
                  : "sin rollos en bodega",
            }))}
            value={clientId}
            onChange={handleClientChange}
            placeholder="Todos"
            searchPlaceholder="Buscar cliente…"
            clearLabel="Todos"
          />
        </FormSelectField>

        {/* Las reglas de esa empresa, en cuanto se sabe cuál es. Van justo
            debajo del selector y ANTES de elegir rollos: de nada sirve
            enterarse de que el corte lleva bordado cuando el vale ya está
            armado y firmado. */}
        <ApplicableRules clientId={realClientId} />

        <div className="flex flex-wrap gap-2">
          <IssueFromCalculation
            products={products}
            sizes={sizes}
            clientId={realClientId}
            onExplode={handleExplode}
          />

          <ResponsiveFormDialog
            open={pickerOpen}
            onOpenChange={(next) => (next ? openPicker() : closePicker())}
            title="Agregar rollos"
            description="Marca todos los que se lleven. Retazos primero, luego los más viejos."
            trigger={
              <Button type="button" variant="outline" className="touch-target">
                <Plus className="size-4" aria-hidden />
                Agregar rollos
              </Button>
            }
          >
            <div className="flex flex-col gap-4">
              <FormSelectField id="picker-material" label="Material">
                <SearchSelect
                  id="picker-material"
                  options={visibleMaterials.map((material) => ({
                    value: material.id,
                    label: material.name,
                    hint: `${material.code} · ${material.lotCount} ${material.lotCount === 1 ? "rollo" : "rollos"}`,
                    keywords: material.code,
                  }))}
                  value={pickerMaterialId}
                  onChange={handleMaterialChange}
                  placeholder="Elige el material"
                  searchPlaceholder="Buscar por código o nombre…"
                  emptyMessage="Este cliente no tiene material en bodega."
                />
              </FormSelectField>

              <IssueLotPicker
                state={pickerState}
                excludeLotIds={usedLotIds}
                hasClientFilter={Boolean(clientId)}
                onPick={handlePick}
              />

              {/* El acumulado, dentro del propio selector: es aquí donde se
                  va marcando rollo por rollo, así que es aquí donde se decide
                  si ya se juntaron los metros. Verlo obligaba a cerrar el
                  diálogo, mirar la lista y volver a abrirlo. */}
              {totals.lines > 0 && (
                <div className="border border-border bg-muted px-3 py-2">
                  <IssueRunningTotal totals={totals} />
                </div>
              )}

              {/* Cerrar es explícito: el selector se queda abierto para poder
                  marcar varios rollos seguidos sin reabrirlo cada vez. */}
              <Button
                type="button"
                className="touch-target"
                onClick={closePicker}
              >
                Listo
                {lines.length > 0 && ` · ${lines.length} rollo(s)`}
              </Button>
            </div>
          </ResponsiveFormDialog>
        </div>
      </div>

      <IssueLines
        lines={lines}
        totals={totals}
        onChangeQuantity={updateQuantity}
        onRemove={removeLine}
        onCorrected={handleCorrected}
        canAdjust={canAdjust}
      />

      <div className="flat-surface flex flex-col gap-2 p-4">
        <h2 className="text-sm font-semibold">Desglose de corte</h2>

        {/* El encabezado va ANTES de las tallas y plegado: es lo que se lee
            arriba en la hoja impresa, pero en captura casi siempre se llena
            una vez y no se vuelve a tocar. */}
        <FormSection
          title="Encabezado del corte"
          description="Qué prenda, con qué tela y en qué versión. La empresa dueña y la fecha son las del vale."
        >
          <IssueCutHeader
            fabrics={materials}
            value={cutHeader}
            onChange={setCutHeader}
          />
        </FormSection>

        <FormSection
          title="Tallas"
          description="Prendas por talla que se van a cortar."
          defaultOpen
        >
          <IssueCutTable
            sizes={cutSizes}
            tags={cutTags}
            lines={cutLines}
            onChange={setCutLines}
          />
        </FormSection>
      </div>

      <div className="flat-surface p-4">
        <FormSection title="Detalles del vale">
          <div className="flex flex-col gap-4">
            <FormSelectField
              id="issue-run"
              label="Producción"
              hint="Para qué corrida sale el material."
            >
              <SearchSelect
                id="issue-run"
                options={productionRuns.map((run) => ({
                  value: run.id,
                  label: run.name ?? run.code,
                  hint: run.name ? run.code : undefined,
                  keywords: run.code,
                }))}
                value={productionRunId}
                onChange={setProductionRunId}
                placeholder="Sin producción"
                searchPlaceholder="Buscar producción…"
                clearLabel="Sin producción"
              />
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
          disabled={!hasSomething}
          className="h-12 w-full"
        >
          {isEditing ? "Guardar cambios" : "Guardar salida en borrador"}
        </SubmitButton>

        <p className="text-center text-xs text-muted-foreground">
          Guardar no descuenta existencias. El stock se mueve al aplicar el
          vale, y sólo por los rollos que lleve.
        </p>
      </div>
    </div>
  );
}

interface LinesProps {
  lines: IssueLine[];
  totals: IssueTotals;
  onChangeQuantity: (index: number, value: string) => void;
  onRemove: (index: number) => void;
  onCorrected: (
    index: number,
    corrected: { available: number; unit: Unit },
  ) => void;
  canAdjust: boolean;
}

/** Los renglones del vale, cada uno con su rollo y su cantidad. */
function IssueLines({
  lines,
  totals,
  onChangeQuantity,
  onRemove,
  onCorrected,
  canAdjust,
}: LinesProps) {
  if (lines.length === 0) {
    return (
      <div className="flat-surface p-6 text-center">
        <p className="text-sm text-muted-foreground">
          Aún no hay rollos. Agrega uno o trae los insumos de un cálculo.
        </p>
        {/* Se dice explícitamente que son opcionales: si no, el auxiliar que
            sólo quiere mandar el desglose de cortes cree que le falta algo. */}
        <p className="mt-1 text-xs text-muted-foreground">
          Son opcionales: puedes generar la salida sólo con el desglose de
          cortes.
        </p>
      </div>
    );
  }

  return (
    <section className="flat-surface p-4">
      <h2 className="text-sm font-semibold">Renglones ({lines.length})</h2>

      {/* El acumulado va ARRIBA de la lista y no al pie: en el celular la
          lista crece más que la pantalla, y un total al final obligaría a
          bajar hasta el fondo justo para ver el número que se consulta más. */}
      <div className="mt-3 border-y border-border bg-muted px-3 py-2">
        <IssueRunningTotal totals={totals} />
      </div>

      <ul className="mt-3 flex flex-col gap-3">
        {lines.map((line, index) => (
          <IssueLineRow
            key={`${line.lotId}-${index}`}
            line={line}
            index={index}
            onChangeQuantity={onChangeQuantity}
            onRemove={onRemove}
            onCorrected={onCorrected}
            canAdjust={canAdjust}
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
  onCorrected: (
    index: number,
    corrected: { available: number; unit: Unit },
  ) => void;
  canAdjust: boolean;
}

function IssueLineRow({
  line,
  index,
  onChangeQuantity,
  onRemove,
  onCorrected,
  canAdjust,
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

        <div className="flex shrink-0 items-center">
          {/* Va junto a quitar porque se usa en el mismo momento: con el rollo
              en la mano, al descubrir que no mide lo que dice el sistema. */}
          {canAdjust && (
            <IssueLotCorrectDialog
              lotId={line.lotId}
              lotCode={line.lotCode}
              available={line.available}
              unit={line.unit}
              onCorrected={(corrected) => onCorrected(index, corrected)}
            />
          )}

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
          Excede lo disponible en este rollo. El vale no se puede aplicar por
          encima del saldo
          {canAdjust
            ? ": si el rollo mide más de lo que dice el sistema, corrígelo con la regla de arriba."
            : "; pide que recuenten el rollo si mide más de lo que dice el sistema."}
        </p>
      )}
    </li>
  );
}

/**
 * Foto comparable del vale.
 *
 * Sólo se usa para saber si el usuario tocó algo desde que abrió el
 * borrador. Serializar es más barato de mantener que comparar campo por
 * campo, y son decenas de renglones, no miles.
 */
function snapshot(
  lines: { lotId: string; quantity: string }[],
  cutLines: CutLineDraft[],
  cutHeader: CutHeaderDraft,
  concept: string,
  reference: string,
  receivedBy: string,
  notes: string,
): string {
  return JSON.stringify([
    lines.map((line) => [line.lotId, line.quantity]),
    cutLines,
    cutHeader,
    concept,
    reference,
    receivedBy,
    notes,
  ]);
}

/** Qué se pierde, dicho en rollos y tallas y no en "cambios". */
function describeIssueLoss(lineCount: number, cutCount: number): string {
  const partes: string[] = [];

  if (lineCount > 0) {
    partes.push(`${lineCount} ${lineCount === 1 ? "rollo" : "rollos"}`);
  }
  if (cutCount > 0) {
    partes.push(`${cutCount} ${cutCount === 1 ? "talla" : "tallas"} del desglose`);
  }

  if (partes.length === 0) return "Perderás lo que llevas capturado del vale.";

  return `Perderás ${partes.join(" y ")} que capturaste.`;
}
