"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Scissors } from "lucide-react";
import { toast } from "sonner";
import { addBatchProgressAction } from "@/app/actions/cutting-order.actions";
import { runAction } from "@/lib/offline/run-action";
import { sumBundlePieces, sumBundles } from "@/lib/bundles";
import { cutBatchLabel } from "@/lib/constants/labels";
import { cutProgress, formatDate } from "@/lib/utils";
import { ResponsiveFormDialog } from "@/components/shared/responsive-form-dialog";
import { SearchSelect } from "@/components/shared/search-select";
import { SubmitButton } from "@/components/shared/submit-button";
import {
  emptyRow,
  SizeBundleRows,
  usableRows,
  type SizeBundleRow,
} from "@/components/orders/size-bundle-rows";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

/** Un corte ya abierto de esta orden, tal como se ofrece en el selector. */
export interface BatchOption {
  id: string;
  number: number;
  label: string | null;
  openedAt: Date;
  /** Piezas que ya se le capturaron. Sólo para el texto de ayuda. */
  pieces: number;
}

/**
 * Una talla que se puede capturar: un renglón de la orden, o una del catálogo
 * que la orden todavía no pide.
 *
 * Se ofrece el catálogo entero y no sólo lo pedido porque en la mesa sale lo
 * que sale —una 43 en una orden de puras letras—, y obligar a editar la orden
 * antes de anotar el bulto es lo que devuelve a la gente a la libreta. Al
 * guardar, esa talla entra a la orden con cero pedidas y sus piezas se leen
 * como sobrantes.
 */
export interface BatchSizeOption {
  /** Identidad de la opción: el renglón si existe, si no la talla. */
  key: string;
  /** Null mientras la orden no tenga renglón para esa talla. */
  lineId: string | null;
  sizeId: string;
  code: string;
  name: string;
  ordered: number;
  cut: number;
  /** Lo que distingue dos renglones de la misma talla en una orden. */
  note: string | null;
}

/**
 * Valor del selector que significa "ábreme un corte nuevo".
 *
 * Es una opción del mismo select y no un botón aparte porque en el piso es una
 * sola decisión —"¿esto va en el corte de ayer o es uno nuevo?"— y partirla en
 * dos controles obliga a entenderla como dos.
 */
const NEW_BATCH = "__new__";

interface Props {
  orderId: string;
  batches: BatchOption[];
  sizes: BatchSizeOption[];
}

/**
 * Captura una tanda completa: se elige el corte una vez y se anotan los bultos
 * que salieron de él, uno por renglón.
 *
 * Existe porque el piso no corta talla por talla: tiende la tela, saca unas
 * cuantas de cada una, las amarra en bultos y las anota juntas. Capturarlas de
 * una en una obligaba a abrir un diálogo por talla y, sobre todo, dejaba las
 * piezas sin decir de qué tendido salieron.
 *
 * Se captura POR BULTO y no con "un número por talla" porque el bulto es la
 * unidad física que se amarra, se etiqueta y se entrega: de la 43 puede salir
 * uno de 30 y otro de 20, y esos son dos renglones. Con un solo número por
 * talla había que sumarlos a mano y el desglose se perdía antes de llegar al
 * vale de salida, que es justo donde el taller lo firma.
 */
export function OrderBatchDialog({ orderId, batches, sizes }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  /* Arranca en el último corte abierto: lo normal es seguir capturando en el
     que se está trabajando, no estrenar uno cada vez. */
  const [batchId, setBatchId] = useState(batches[0]?.id ?? NEW_BATCH);
  const [newLabel, setNewLabel] = useState("");
  const [notes, setNotes] = useState("");
  const [rows, setRows] = useState<SizeBundleRow[]>([emptyRow()]);
  const [isSaving, setIsSaving] = useState(false);

  const isNewBatch = batchId === NEW_BATCH;

  const byKey = new Map(sizes.map((size) => [size.key, size]));

  const captured = usableRows(rows);
  const total = sumBundlePieces(captured);
  const bundles = sumBundles(captured);
  // Por TALLA y no por renglón: la orden puede llevar la misma dos veces y
  // decir "2 tallas" cuando es una sola se lee como un error de captura.
  const capturedSizes = new Set(
    captured.map((row) => byKey.get(row.value)?.sizeId),
  ).size;

  /**
   * Lo que se sabe de la talla del renglón: cuánto lleva y en cuánto quedaría.
   *
   * Se suman TODOS los renglones de esa talla y no sólo el de la tarjeta:
   * cuando de la misma talla salieron dos bultos, el acumulado que interesa es
   * el de los dos juntos, y enseñar el de uno haría creer que falta el otro.
   */
  function hintFor(key: string) {
    const size = byKey.get(key);
    if (!size) return null;

    const typed = sumBundlePieces(captured.filter((row) => row.value === key));

    /* La que la orden no pedía se dice de frente ANTES de guardar: se va a
       agregar a la orden, y enterarse después de que el pedido creció una
       talla obliga a ir a buscar quién la metió. */
    if (!size.lineId) {
      const tail = typed !== 0 ? ` · entrarían ${typed}` : "";
      return `no está en la orden · se agrega con 0 pedidas${tail}`;
    }

    if (typed !== 0) {
      return `${size.cut} de ${size.ordered} · quedaría en ${size.cut + typed}`;
    }

    const { pending, surplus } = cutProgress(size.ordered, size.cut);
    const rest = surplus > 0 ? `sobran ${surplus}` : `faltan ${pending}`;

    return `${size.cut} de ${size.ordered} · ${rest}`;
  }

  function reset() {
    setBatchId(batches[0]?.id ?? NEW_BATCH);
    setNewLabel("");
    setNotes("");
    setRows([emptyRow()]);
  }

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) reset();
  }

  async function handleSave() {
    if (captured.length === 0) {
      toast.error("Agrega al menos un bulto con su talla y su cantidad.");
      return;
    }

    setIsSaving(true);
    const result = await runAction(() =>
      addBatchProgressAction({
        orderId,
        batchId: isNewBatch ? undefined : batchId,
        newBatchLabel: isNewBatch ? newLabel || undefined : undefined,
        notes: notes || undefined,
        lines: captured.map((row) => {
          const size = byKey.get(row.value);

          return {
            sizeId: size?.sizeId,
            /* Se manda el renglón cuando ya existe: la orden puede llevar la
               misma talla dos veces, y dejar que el servidor resuelva por
               talla mandaría a uno lo que se capturó en el otro. */
            lineId: size?.lineId ?? undefined,
            quantity: row.quantity,
            bundles: row.bundles,
          };
        }),
      }),
    );
    setIsSaving(false);

    if (!result.success) {
      toast.error(result.error);
      return;
    }

    toast.success(
      `${total} piezas en ${bundles} ${bundles === 1 ? "bulto" : "bultos"}`,
    );
    setOpen(false);
    reset();
    router.refresh();
  }

  return (
    <ResponsiveFormDialog
      open={open}
      onOpenChange={handleOpenChange}
      title="Capturar corte"
      description="Elige el corte y anota los bultos que salieron, uno por renglón."
      trigger={
        <Button className="touch-target">
          <Scissors className="size-4" aria-hidden />
          Capturar corte
        </Button>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="batch">Corte</Label>
          <SearchSelect
            id="batch"
            options={[
              ...batches.map((batch) => ({
                value: batch.id,
                label: cutBatchLabel(batch.number, batch.label),
                hint: batchHint(batch),
              })),
              { value: NEW_BATCH, label: "Corte nuevo" },
            ]}
            value={batchId}
            onChange={setBatchId}
            placeholder="Elige el corte"
            searchPlaceholder="Buscar corte…"
          />
        </div>

        {isNewBatch && (
          <div className="flex flex-col gap-2">
            <Label htmlFor="batch-label">Nombre del corte</Label>
            <Input
              id="batch-label"
              placeholder={`Opcional · quedará como ${cutBatchLabel(
                (batches[0]?.number ?? 0) + 1,
              )}`}
              value={newLabel}
              onChange={(event) => setNewLabel(event.target.value)}
              className="touch-target"
            />
          </div>
        )}

        <SizeBundleRows
          label="Bultos de este corte"
          options={sizes.map((size) => ({
            value: size.key,
            code: size.code,
            /* La anotación del renglón desempata dos de la misma talla, y el
               nombre largo hace que se encuentre tecleando "grande". */
            hint: size.note ?? size.name,
            keywords: size.name,
          }))}
          rows={rows}
          onChange={setRows}
          renderHint={hintFor}
          footnote="La misma talla se puede repetir: un bulto de 30 y otro de 20 son dos renglones. Para corregir un conteo de más, escribe una cantidad negativa."
        />

        <div className="flex flex-col gap-2">
          <Label htmlFor="batch-notes">Notas del corte</Label>
          <Textarea
            id="batch-notes"
            rows={2}
            placeholder="Quién cortó, en qué mesa…"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
          />
        </div>

        {captured.length > 0 && (
          <p className="tabular border border-border bg-muted p-2 text-sm">
            {total} piezas · {bundles} {bundles === 1 ? "bulto" : "bultos"} ·{" "}
            {capturedSizes} {capturedSizes === 1 ? "talla" : "tallas"}
          </p>
        )}

        <SubmitButton
          isSubmitting={isSaving}
          onClick={handleSave}
          disabled={captured.length === 0}
          className="h-12 w-full"
        >
          Guardar corte
        </SubmitButton>
      </div>
    </ResponsiveFormDialog>
  );
}

/** Cuándo se abrió el corte y qué lleva, para reconocerlo en el selector. */
function batchHint(batch: BatchOption): string {
  const pieces = `${batch.pieces} ${batch.pieces === 1 ? "pza" : "pzas"}`;
  return `${formatDate(batch.openedAt)} · ${pieces}`;
}
