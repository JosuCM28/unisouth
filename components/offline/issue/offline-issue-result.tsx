import { CheckCircle2, CloudOff } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Cómo terminó la última salida capturada en esta pantalla. */
export type IssueResult =
  | { status: "sent"; code: string }
  | { status: "queued"; localCode: string };

/**
 * El folio que va en el vale de papel.
 *
 * Sin señal el número es provisional (TMP-…) y se dice así de claro: quien
 * firma debe saber que el folio real llega al volver el internet, y que lo
 * encontrará en "Datos sin conexión" junto al TMP que anotó.
 */
export function OfflineIssueResult({
  result,
  onNew,
  newLabel = "Capturar otra salida",
}: {
  result: IssueResult;
  onNew: () => void;
  /** Desde la ficha de la orden el botón cierra, y se dice así. */
  newLabel?: string;
}) {
  const queued = result.status === "queued";
  const Icon = queued ? CloudOff : CheckCircle2;

  return (
    <div className="flex flex-col items-center gap-4 py-8 text-center">
      <Icon className="size-10 text-muted-foreground" aria-hidden />

      <div>
        <p className="text-sm text-muted-foreground">
          {queued ? "Folio provisional" : "Salida aplicada"}
        </p>
        <p className="tabular text-2xl font-semibold">
          {queued ? result.localCode : result.code}
        </p>
      </div>

      {queued && (
        <p className="max-w-sm text-sm text-muted-foreground">
          Anótalo en el vale. Se aplica sola al volver el internet y ahí recibe
          su folio real. Si algún rollo ya no alcanza, aparecerá en rojo en las
          capturas pendientes.
        </p>
      )}

      <Button type="button" className="touch-target" onClick={onNew}>
        {newLabel}
      </Button>
    </div>
  );
}
