"use client";

import { useState } from "react";
import { Ruler } from "lucide-react";
import { toast } from "sonner";
import type { Unit } from "@prisma/client";
import {
  lotCorrectionInfoAction,
  recountLotAction,
  type LotCorrectionInfo,
} from "@/app/actions/lot.actions";
import { runAction } from "@/lib/offline/run-action";
import { UNIT_SHORT_LABELS, unitSelectGroups } from "@/lib/constants/labels";
import { formatQuantity } from "@/lib/utils";
import { ResponsiveFormDialog } from "@/components/shared/responsive-form-dialog";
import { SearchSelect } from "@/components/shared/search-select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface Props {
  lotId: string;
  lotCode: string;
  /** Lo que el vale cree que hay. Sólo para el encabezado del diálogo. */
  available: number;
  unit: Unit;
  /** El tono con el que el vale lo tiene pintado hoy. */
  shade: string | null;
  /** Cuánto quedó de verdad, en qué unidad y con qué tono. */
  onCorrected: (result: {
    available: number;
    unit: Unit;
    shade: string | null;
  }) => void;
}

/* El mismo orden por uso que en la recepción: kg y m arriba, el resto
   alfabético. Ordenarlas distinto aquí obligaría a buscar con el pulgar la
   unidad que allá está a la vista. */
const { common, rest } = unitSelectGroups();
const UNIT_OPTIONS = [...common, ...rest];

/**
 * Corrige el metraje real de un rollo sin salirse del vale.
 *
 * El caso es cotidiano: el rollo que está en la mano mide otra cosa que lo
 * que dice el sistema porque se capturó mal al recibirlo. Antes había que
 * abandonar el vale a medias, ir a la ficha del rollo, recontarlo y volver a
 * empezar; y como eso cuesta, lo que pasaba en realidad es que se tecleaba la
 * cantidad de todos modos y el vale reventaba al aplicarlo.
 *
 * NO es "escribir una cantidad libre en el renglón". Lo que hace es el
 * reconteo de siempre —el mismo `recountLotAction`, con su movimiento de
 * ajuste y su motivo obligatorio— sólo que disparado desde aquí. El saldo del
 * rollo queda corregido para la próxima salida, y no sólo para este papel.
 *
 * El TONO se corrige aquí mismo por lo mismo: el rollo está en la mano y los
 * dos errores se descubren en el mismo instante —mide 110 y no 100, y es
 * negro y no blanco—. Corregirlo cambia el rollo, así que el vale impreso
 * sale con el tono bueno sin tocar el documento: la salida lee el tono vivo
 * del rollo, no una copia.
 */
export function IssueLotCorrectDialog({
  lotId,
  lotCode,
  available,
  unit,
  shade,
  onCorrected,
}: Props) {
  const [open, setOpen] = useState(false);
  const [info, setInfo] = useState<LotCorrectionInfo | null>(null);
  const [quantity, setQuantity] = useState("");
  const [nextUnit, setNextUnit] = useState<string>(unit);
  const [nextShade, setNextShade] = useState(shade ?? "");
  const [reason, setReason] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  /**
   * Al abrir se pregunta por el rollo en vez de confiar en lo que trae el
   * renglón: si la unidad se puede cambiar o no depende de su kárdex, y el
   * vale no lo conoce. Enterarse de que no se puede después de teclear el
   * motivo sería peor que no ofrecerlo.
   */
  async function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) return;

    setInfo(null);
    setReason("");

    const result = await runAction(() => lotCorrectionInfoAction({ lotId }));

    if (!result.success) {
      toast.error(result.error);
      setOpen(false);
      return;
    }

    setInfo(result.data);
    setQuantity(String(result.data.currentQuantity));
    setNextUnit(result.data.unit);
    // El tono se relee del rollo y no del renglón: el vale pudo quedar
    // abierto mientras alguien más lo corrigió desde la ficha.
    setNextShade(result.data.shade ?? "");
  }

  const trimmedShade = nextShade.trim();
  /* "No lo toques" y "déjalo en blanco" son distintos, y esta comparación es
     la que los separa: sin ella, un rollo sin tono mandaría `shade: ""` en
     cada reconteo y la bitácora se llenaría de cambios que nadie hizo. */
  const shadeChanged = Boolean(info) && trimmedShade !== (info?.shade ?? "");

  async function handleSave() {
    const counted = Number(quantity.replace(",", "."));

    if (!Number.isFinite(counted) || counted < 0) {
      toast.error("Escribe cuánto mide de verdad.");
      return;
    }

    if (!reason.trim()) {
      toast.error("Escribe por qué no coincide.");
      return;
    }

    setIsSaving(true);
    const result = await runAction(() =>
      recountLotAction({
        lotId,
        countedQuantity: counted,
        reason: reason.trim(),
        // Sólo viaja si de verdad cambió: mandarla igual haría que el
        // servicio entrara por el camino de la corrección de unidad.
        unit: nextUnit !== info?.unit ? nextUnit : undefined,
        // Mismo criterio: ausente es "no lo toques". Cuando sí cambió viaja
        // tal cual, y en blanco significa borrarlo.
        shade: shadeChanged ? trimmedShade : undefined,
      }),
    );
    setIsSaving(false);

    if (!result.success) {
      toast.error(result.error);
      return;
    }

    /* El renglón se queda con lo que de verdad quedó libre. La reserva no se
       toca al recontar, así que se resta la que el rollo ya traía. */
    onCorrected({
      available: counted - (info?.reservedQuantity ?? 0),
      unit: nextUnit as Unit,
      shade: trimmedShade || null,
    });

    toast.success(`${lotCode} corregido`);
    setOpen(false);
  }

  const unitChanged = Boolean(info) && nextUnit !== info?.unit;

  return (
    <ResponsiveFormDialog
      open={open}
      onOpenChange={handleOpenChange}
      title={`Corregir ${lotCode}`}
      description="Lo que de verdad mide y de qué tono es. Se corrige el rollo, no sólo este vale."
      trigger={
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="touch-target shrink-0 text-muted-foreground"
          aria-label={`Corregir el metraje y el tono de ${lotCode}`}
        >
          <Ruler className="size-4" aria-hidden />
        </Button>
      }
    >
      {!info ? (
        <p className="text-sm text-muted-foreground">Consultando el rollo…</p>
      ) : (
        <div className="flex flex-col gap-4">
          <p className="tabular text-sm text-muted-foreground">
            El sistema dice{" "}
            {formatQuantity(available, {
              unit: UNIT_SHORT_LABELS[unit],
            })}
            .
          </p>

          <div className="flex flex-col gap-2">
            <Label htmlFor="correct-quantity">Cuánto mide de verdad</Label>
            <Input
              id="correct-quantity"
              inputMode="decimal"
              value={quantity}
              onChange={(event) => setQuantity(event.target.value)}
              className="touch-target tabular"
            />
          </div>

          {/* La unidad sólo se ofrece si el rollo todavía no se movió. Cuando
              ya se movió se explica por qué, en vez de esconder el campo y
              dejar a quien lo busca pensando que la app no lo trae. */}
          {info.canChangeUnit ? (
            <div className="flex flex-col gap-2">
              <Label htmlFor="correct-unit">Unidad</Label>
              <SearchSelect
                id="correct-unit"
                options={UNIT_OPTIONS}
                value={nextUnit}
                onChange={setNextUnit}
                placeholder="Unidad"
                searchPlaceholder="Buscar unidad…"
              />
              {unitChanged && (
                <p className="text-xs text-muted-foreground">
                  Se cerrará el saldo en {UNIT_SHORT_LABELS[info.unit]} y se
                  volverá a abrir en {UNIT_SHORT_LABELS[nextUnit as Unit]}.
                  Quedan los dos movimientos en el kárdex.
                </p>
              )}
            </div>
          ) : (
            <p className="flat-surface p-3 text-xs text-muted-foreground">
              La unidad ({UNIT_SHORT_LABELS[info.unit]}) ya no se puede cambiar:
              el rollo tiene movimientos registrados con ella y cambiarla
              descuadraría su kárdex. Si de plano está mal, cancélalo y
              regístralo de nuevo.
            </p>
          )}

          {/* El tono va JUNTO al metraje y no en otra pantalla: se descubren
              en el mismo instante, con el rollo en la mano y la etiqueta a la
              vista. Corregirlo cambia el rollo, así que el vale impreso sale
              con el tono bueno sin tocar el documento. */}
          <div className="flex flex-col gap-2">
            <Label htmlFor="correct-shade">Tono / partida de tintura</Label>
            <Input
              id="correct-shade"
              value={nextShade}
              onChange={(event) => setNextShade(event.target.value)}
              placeholder="A-42"
              className="touch-target tabular"
            />
            {shadeChanged && (
              <p className="text-xs text-muted-foreground">
                {trimmedShade
                  ? `Quedará como tono ${trimmedShade} en el rollo y en este vale.`
                  : "Se quedará sin tono en el rollo y en este vale."}
              </p>
            )}
            {/* Aviso, no bloqueo: si el rollo de verdad no trae tono, el
                sistema no puede inventárselo. Pero esta tela no se tiende sin
                él, y dejarlo en blanco sin decir nada es peor. */}
            {info.requiresShade && !trimmedShade && (
              <p className="text-xs text-state-reserved">
                Esta tela se maneja por tono: sin él no se sabe qué rollos se
                pueden tender juntos.
              </p>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="correct-reason">Por qué no coincide</Label>
            <Textarea
              id="correct-reason"
              rows={2}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Se capturó mal al recibirlo; medido con cinta"
            />
          </div>

          <Button
            type="button"
            onClick={handleSave}
            disabled={isSaving || !reason.trim()}
            className="h-12 w-full"
          >
            {isSaving ? "Ajustando…" : "Ajustar el rollo"}
          </Button>
        </div>
      )}
    </ResponsiveFormDialog>
  );
}
