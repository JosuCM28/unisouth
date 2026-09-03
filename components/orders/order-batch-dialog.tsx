"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Scissors } from "lucide-react";
import { toast } from "sonner";
import { saveBatchProgressAction } from "@/app/actions/cutting-order.actions";
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

/** Un bulto ya capturado en un corte, tal como vuelve a la pantalla. */
export interface BatchEntry {
  lineId: string;
  /** Piezas POR BULTO. */
  quantity: number;
  bundles: number;
}

/** Un corte ya abierto de esta orden, tal como se ofrece en el selector. */
export interface BatchOption {
  id: string;
  number: number;
  label: string | null;
  openedAt: Date;
  /** Piezas que ya se le capturaron. Sólo para el texto de ayuda. */
  pieces: number;
  /**
   * Lo que ya lleva capturado, bulto por bulto.
   *
   * Viaja con la opción y no se pide al elegirla: el selector se usa de pie en
   * la mesa y un viaje al servidor entre tocar el corte y ver sus números es
   * medio segundo en el que la pantalla parece vacía y alguien vuelve a
   * teclear lo que ya estaba.
   */
  entries: BatchEntry[];
  /** El vale vivo de este corte. Con uno, el corte ya no se puede cambiar. */
  issue: { code: string; isDraft: boolean } | null;
}

/**
 * Un renglón de la orden, tal como se ofrece en el selector.
 *
 * Se ofrece un renglón por RENGLÓN y no una entrada por talla: una orden puede
 * llevar la misma talla dos veces —con foleos o anotaciones distintas— y
 * juntarlas mandaría a una lo que se capturó para la otra. La anotación viaja
 * para poder desempatarlas de un vistazo.
 *
 * Sólo lo que la orden pidió: la captura es el avance de un pedido, no la
 * puerta por la que se le agregan tallas.
 */
export interface BatchSizeOption {
  lineId: string;
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
  const [rows, setRows] = useState<SizeBundleRow[]>(() =>
    rowsOf(batches[0]),
  );
  const [isSaving, setIsSaving] = useState(false);

  const isNewBatch = batchId === NEW_BATCH;
  const selected = batches.find((batch) => batch.id === batchId);

  /* Un corte que ya salió en un vale no se toca: ese papel lleva su desglose
     bulto por bulto y puede estar firmado. Se dice aquí, con el folio, en vez
     de dejar teclear y rebotar al guardar. */
  const blocked = selected?.issue ?? null;

  // Se está corrigiendo, no estrenando: cambia lo que dice la pantalla.
  const isEditing = (selected?.entries.length ?? 0) > 0;

  /** Al cambiar de corte se trae lo que ese corte ya lleva. */
  function handleBatchChange(next: string) {
    setBatchId(next);
    setRows(rowsOf(batches.find((batch) => batch.id === next)));
  }

  const byLine = new Map(sizes.map((size) => [size.lineId, size]));

  const captured = usableRows(rows);
  const total = sumBundlePieces(captured);
  const bundles = sumBundles(captured);
  // Por TALLA y no por renglón: la orden puede llevar la misma dos veces y
  // decir "2 tallas" cuando es una sola se lee como un error de captura.
  const capturedSizes = new Set(
    captured.map((row) => byLine.get(row.value)?.code),
  ).size;

  /**
   * Lo que ya aporta ESTE corte a una talla, según lo guardado.
   *
   * Es la pieza que hace que el acumulado no mienta al corregir: guardar
   * REEMPLAZA lo de este corte, así que el total de la talla no es "lo que
   * lleva más lo tecleado" —eso contaría dos veces lo que ya estaba— sino lo
   * que dieron los OTROS cortes más lo que quede aquí.
   */
  function alreadyHere(lineId: string) {
    return sumBundlePieces(
      (selected?.entries ?? []).filter((entry) => entry.lineId === lineId),
    );
  }

  /**
   * Lo que se sabe de la talla del renglón: cuánto lleva y en cuánto quedaría.
   *
   * Se suman TODOS los renglones de esa talla y no sólo el de la tarjeta:
   * cuando de la misma talla salieron dos bultos, el acumulado que interesa es
   * el de los dos juntos, y enseñar el de uno haría creer que falta el otro.
   */
  function hintFor(lineId: string) {
    const size = byLine.get(lineId);
    if (!size) return null;

    const typed = sumBundlePieces(
      captured.filter((row) => row.value === lineId),
    );

    // Lo que dieron los demás cortes: la base sobre la que se suma lo de éste.
    const others = size.cut - alreadyHere(lineId);

    if (typed !== 0) {
      return `${size.cut} de ${size.ordered} · quedaría en ${others + typed}`;
    }

    const { pending, surplus } = cutProgress(size.ordered, size.cut);
    const rest = surplus > 0 ? `sobran ${surplus}` : `faltan ${pending}`;

    return `${size.cut} de ${size.ordered} · ${rest}`;
  }

  function reset() {
    setBatchId(batches[0]?.id ?? NEW_BATCH);
    setNewLabel("");
    setNotes("");
    setRows(rowsOf(batches[0]));
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
      saveBatchProgressAction({
        orderId,
        batchId: isNewBatch ? undefined : batchId,
        newBatchLabel: isNewBatch ? newLabel || undefined : undefined,
        notes: notes || undefined,
        lines: captured.map((row) => ({
          lineId: row.value,
          quantity: row.quantity,
          bundles: row.bundles,
        })),
      }),
    );
    setIsSaving(false);

    if (!result.success) {
      toast.error(result.error);
      return;
    }

    const bultos = `${bundles} ${bundles === 1 ? "bulto" : "bultos"}`;

    toast.success(
      result.data.replaced
        ? `Corte corregido: queda en ${total} piezas y ${bultos}`
        : `${total} piezas en ${bultos}`,
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
      description={
        isEditing
          ? "Este corte ya tiene bultos capturados. Corrígelos y se guardan tal cual."
          : "Elige el corte y anota los bultos que salieron, uno por renglón."
      }
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
            onChange={handleBatchChange}
            placeholder="Elige el corte"
            searchPlaceholder="Buscar corte…"
          />

          {blocked && (
            <p className="flex items-start gap-2 border border-state-reserved bg-card p-3 text-sm">
              <AlertTriangle
                className="size-4 shrink-0 text-state-reserved"
                aria-hidden
              />
              <span>
                Este corte ya salió en{" "}
                <span className="tabular font-medium">{blocked.code}</span>{" "}
                ({blocked.isDraft ? "borrador" : "aplicada"}) y no se puede
                cambiar: ese vale lleva su desglose bulto por bulto. Cancela la
                salida si necesitas corregirlo.
              </span>
            </p>
          )}
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
            value: size.lineId,
            code: size.code,
            /* La anotación del renglón desempata dos de la misma talla, y el
               nombre largo hace que se encuentre tecleando "grande". */
            hint: size.note ?? size.name,
            keywords: size.name,
          }))}
          rows={rows}
          onChange={setRows}
          renderHint={hintFor}
          footnote={
            isEditing
              ? "El corte queda EXACTAMENTE con estos renglones: lo que quites aquí desaparece de él. La misma talla se puede repetir."
              : "La misma talla se puede repetir: un bulto de 30 y otro de 20 son dos renglones."
          }
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
          disabled={captured.length === 0 || Boolean(blocked)}
          className="h-12 w-full"
        >
          {isEditing ? "Guardar cambios" : "Guardar corte"}
        </SubmitButton>
      </div>
    </ResponsiveFormDialog>
  );
}

/**
 * Los renglones con los que abre la pantalla para un corte.
 *
 * Un corte que ya tiene bultos vuelve con ellos puestos, que es lo que permite
 * corregirlos: aparecer vacío hacía creer que no había nada capturado y que
 * volver a teclearlo era lo correcto. Uno recién estrenado —o "Corte nuevo"—
 * abre con un renglón en blanco, listo para el primer bulto.
 */
function rowsOf(batch?: BatchOption): SizeBundleRow[] {
  if (!batch || batch.entries.length === 0) return [emptyRow()];

  return batch.entries.map((entry) => ({
    key: crypto.randomUUID(),
    value: entry.lineId,
    quantity: String(entry.quantity),
    bundles: String(entry.bundles),
  }));
}

/** Cuándo se abrió el corte y qué lleva, para reconocerlo en el selector. */
function batchHint(batch: BatchOption): string {
  const pieces = `${batch.pieces} ${batch.pieces === 1 ? "pza" : "pzas"}`;
  return `${formatDate(batch.openedAt)} · ${pieces}`;
}
