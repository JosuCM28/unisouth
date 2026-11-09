import { formatDate } from "@/lib/utils";

/** Lo que lee el taller: si ya salió de la planta de corte y cuándo. */
export function DispatchNote({ dispatchedAt }: { dispatchedAt: Date | null }) {
  if (!dispatchedAt) {
    return <p className="text-xs font-medium">Aún en planta de corte</p>;
  }

  return (
    <p className="tabular text-xs font-medium">
      Enviada de planta de corte el {formatDate(dispatchedAt)}
    </p>
  );
}

/**
 * Lo que lee la casa en la ficha de la orden.
 *
 * "En planta" sólo donde el dato es confiable: lo capturado antes de que
 * existiera este botón ya salió casi todo, y decirle "en planta" a un envío de
 * hace dos meses sería afirmar algo que nadie registró.
 */
export function DispatchChip({
  dispatchedAt,
  dispatchedByName,
  tracked,
}: {
  dispatchedAt: Date | null;
  dispatchedByName: string | null;
  /** El taller lo sigue desde su cuenta, así que el dato ya se está llevando. */
  tracked: boolean;
}) {
  if (dispatchedAt) {
    return (
      <span className="tabular rounded border border-border px-1.5 py-0.5 text-xs">
        Enviado el {formatDate(dispatchedAt)}
        {dispatchedByName && ` por ${dispatchedByName}`}
      </span>
    );
  }

  if (!tracked) return null;

  return (
    <span className="rounded border border-border px-1.5 py-0.5 text-xs">
      En planta
    </span>
  );
}
