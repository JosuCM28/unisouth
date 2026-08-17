import Link from "next/link";
import { Boxes, CalendarDays, Factory, Truck, User } from "lucide-react";
import type { ReceiptCardData } from "@/lib/repositories/receipt.repository";
import { formatDate } from "@/lib/utils";

/**
 * Tarjeta de una recepción.
 *
 * El orden responde a cómo llega la pregunta en el piso: primero CUÁNDO
 * ("¿qué llegó el martes?"), luego la GUÍA —que es el papel que trae en la
 * mano quien pregunta— y después de quién venía. El número de rollos va
 * grande a la derecha porque es lo que se compara de un vistazo contra lo
 * que se bajó del camión.
 */
export function ReceiptCard({ receipt }: { receipt: ReceiptCardData }) {
  return (
    <Link
      href={`/receipts/${receipt.code}`}
      className="flat-surface block p-3 transition-colors active:bg-accent"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 text-sm font-medium">
            <CalendarDays className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
            <span className="tabular">{formatDate(receipt.date)}</span>
          </p>

          <p className="tabular mt-1 text-xs text-muted-foreground">
            {receipt.code}
          </p>

          {receipt.guideNumber && (
            <p className="mt-1.5 text-sm">
              <span className="text-muted-foreground">Guía </span>
              <span className="tabular font-medium">{receipt.guideNumber}</span>
            </p>
          )}
        </div>

        <div className="shrink-0 text-right">
          <p className="tabular text-2xl font-semibold leading-none">
            {receipt.lotCount}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {receipt.lotCount === 1 ? "rollo" : "rollos"}
          </p>
        </div>
      </div>

      <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
        {receipt.carrier && <Chip icon={Truck} label={receipt.carrier.name} />}
        {receipt.supplier && <Chip icon={Factory} label={receipt.supplier.name} />}
        {receipt.client && <Chip icon={User} label={receipt.client.name} />}
        {receipt.origin && <Chip icon={Boxes} label={receipt.origin} />}
      </div>

      {/* Sin un solo rollo la recepción es un encabezado huérfano: casi
          siempre es una captura que se interrumpió a la mitad. */}
      {receipt.lotCount === 0 && (
        <p className="mt-2 border-t border-border pt-2 text-xs text-muted-foreground">
          Sin rollos capturados.
        </p>
      )}
    </Link>
  );
}

function Chip({
  icon: Icon,
  label,
}: {
  icon: typeof Truck;
  label: string;
}) {
  return (
    <span className="flex items-center gap-1 rounded border border-border px-1.5 py-0.5 text-xs text-muted-foreground">
      <Icon className="size-3 shrink-0" aria-hidden />
      <span className="truncate">{label}</span>
    </span>
  );
}
