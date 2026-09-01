"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Scissors } from "lucide-react";
import { toast } from "sonner";
import { addBatchProgressAction } from "@/app/actions/cutting-order.actions";
import { runAction } from "@/lib/offline/run-action";
import { cutBatchLabel } from "@/lib/constants/labels";
import { cutProgress, formatDate } from "@/lib/utils";
import { ResponsiveFormDialog } from "@/components/shared/responsive-form-dialog";
import { SearchSelect } from "@/components/shared/search-select";
import { SubmitButton } from "@/components/shared/submit-button";
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

/** Una talla de la orden, con lo que lleva. */
export interface BatchSizeRow {
  lineId: string;
  sizeCode: string;
  ordered: number;
  cut: number;
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
  sizes: BatchSizeRow[];
}

/**
 * Captura una tanda completa: se elige el corte una vez y se teclean todas las
 * tallas que salieron de él.
 *
 * Existe porque el piso no corta talla por talla: tiende la tela, saca unas
 * cuantas de cada una y las anota juntas. Capturarlas de una en una obligaba a
 * abrir un diálogo por talla y, sobre todo, dejaba las piezas sin decir de qué
 * tendido salieron: el acumulado subía y nadie podía responder cuántas dio el
 * segundo corte.
 *
 * Las tallas se enseñan TODAS y se dejan en blanco las que no salieron. Pedir
 * un cero explícito en cada una es teclear de más para decir "nada".
 */
export function OrderBatchDialog({ orderId, batches, sizes }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  /* Arranca en el último corte abierto: lo normal es seguir capturando en el
     que se está trabajando, no estrenar uno cada vez. */
  const [batchId, setBatchId] = useState(batches[0]?.id ?? NEW_BATCH);
  const [newLabel, setNewLabel] = useState("");
  const [notes, setNotes] = useState("");
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);

  const isNewBatch = batchId === NEW_BATCH;

  const captured = sizes
    .map((size) => ({ size, quantity: Number(quantities[size.lineId]) || 0 }))
    .filter((row) => row.quantity !== 0);

  const total = captured.reduce((sum, row) => sum + row.quantity, 0);

  function reset() {
    setBatchId(batches[0]?.id ?? NEW_BATCH);
    setNewLabel("");
    setNotes("");
    setQuantities({});
  }

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) reset();
  }

  async function handleSave() {
    if (captured.length === 0) {
      toast.error("Captura cuántas piezas salieron de al menos una talla.");
      return;
    }

    setIsSaving(true);
    const result = await runAction(() =>
      addBatchProgressAction({
        orderId,
        batchId: isNewBatch ? undefined : batchId,
        newBatchLabel: isNewBatch ? newLabel || undefined : undefined,
        notes: notes || undefined,
        lines: captured.map((row) => ({
          lineId: row.size.lineId,
          quantity: row.quantity,
        })),
      }),
    );
    setIsSaving(false);

    if (!result.success) {
      toast.error(result.error);
      return;
    }

    toast.success(
      `${total} piezas en ${captured.length} ${
        captured.length === 1 ? "talla" : "tallas"
      }`,
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
      description="Elige el corte y anota cuántas piezas salieron de cada talla."
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

        {/* Una fila por talla, con lo que lleva a la izquierda: quien captura
            está viendo el bulto y necesita saber si esa talla ya está completa
            antes de anotar. */}
        <div className="flex flex-col gap-2">
          <Label>Piezas de este corte</Label>

          <ul className="flex flex-col gap-2">
            {sizes.map((size) => {
              const typed = Number(quantities[size.lineId]) || 0;
              const { pending, surplus } = cutProgress(size.ordered, size.cut);

              return (
                <li
                  key={size.lineId}
                  className="flex items-center gap-3 border border-border p-2"
                >
                  <div className="min-w-0 flex-1">
                    <p className="tabular text-sm font-medium">
                      Talla {size.sizeCode}
                    </p>
                    <p className="tabular text-xs text-muted-foreground">
                      {size.cut} de {size.ordered}
                      {surplus > 0
                        ? ` · sobran ${surplus}`
                        : ` · faltan ${pending}`}
                    </p>
                  </div>

                  <Input
                    inputMode="numeric"
                    placeholder="0"
                    aria-label={`Piezas de la talla ${size.sizeCode}`}
                    value={quantities[size.lineId] ?? ""}
                    onChange={(event) =>
                      setQuantities((current) => ({
                        ...current,
                        [size.lineId]: event.target.value,
                      }))
                    }
                    className="tabular touch-target w-24 shrink-0 text-right"
                  />

                  {/* El acumulado que quedaría, sólo en la talla que se está
                      tecleando: es la comprobación que se hace en voz alta. */}
                  {typed !== 0 && (
                    <span className="tabular w-16 shrink-0 text-right text-xs text-muted-foreground">
                      → {size.cut + typed}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>

          <p className="text-xs text-muted-foreground">
            Deja en blanco las tallas que no salieron en este corte. Para
            corregir un conteo de más, escribe un número negativo.
          </p>
        </div>

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
            {total} piezas en {captured.length}{" "}
            {captured.length === 1 ? "talla" : "tallas"}
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
