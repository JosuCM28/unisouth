import { CheckCircle2, CloudOff } from "lucide-react";
import type { SubmitOutcome } from "@/lib/offline/submit";
import { Button } from "@/components/ui/button";

/** Cómo terminó una captura de la orden: subió, o quedó con folio TMP. */
export type CaptureResult =
  | { status: "sent"; code: string }
  | { status: "queued"; localCode: string };

/**
 * Traduce el desenlace a lo que se pinta. Un rechazo del servidor (había
 * señal y el dato no pasó) devuelve `null` con su motivo: la captura se queda
 * en pantalla para corregirla, no hay nada que mostrar todavía.
 */
export function toCaptureResult(
  outcome: SubmitOutcome<{ code: string }>,
  localCode: string,
): { result: CaptureResult } | { error: string } {
  if (outcome.status === "sent") return { result: { status: "sent", code: outcome.data.code } };
  if (outcome.status === "queued") return { result: { status: "queued", localCode } };
  return { error: outcome.error };
}

/**
 * El folio que va en el papel.
 *
 * Sin señal el número es provisional (TMP-…) y se dice así de claro: el
 * folio real lo pone el servidor al subir —el que siga en la serie— y queda
 * junto al TMP en "Datos sin conexión".
 */
export function OfflineCaptureResult({
  result,
  sentLabel,
  onClose,
}: {
  result: CaptureResult;
  /** "Corte guardado", "Envío registrado". */
  sentLabel: string;
  onClose: () => void;
}) {
  const queued = result.status === "queued";
  const Icon = queued ? CloudOff : CheckCircle2;

  return (
    <div className="flex flex-col items-center gap-4 py-6 text-center">
      <Icon className="size-10 text-muted-foreground" aria-hidden />

      <div>
        <p className="text-sm text-muted-foreground">
          {queued ? "Folio provisional" : sentLabel}
        </p>
        <p className="tabular text-2xl font-semibold">
          {queued ? result.localCode : result.code}
        </p>
      </div>

      {queued && (
        <p className="max-w-sm text-sm text-muted-foreground">
          Anótalo en el papel. Se sube solo al volver el internet y ahí recibe
          su folio real. Si algo ya no cuadra, aparecerá en rojo en las
          capturas pendientes.
        </p>
      )}

      <Button type="button" className="touch-target" onClick={onClose}>
        Listo
      </Button>
    </div>
  );
}
