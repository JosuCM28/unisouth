import Link from "next/link";
import { Boxes, CalendarDays, Factory, Truck, User } from "lucide-react";
import type { ReceiptCardData } from "@/lib/repositories/receipt.repository";
import { UNIT_SHORT_LABELS } from "@/lib/constants/labels";
import { formatDate, formatQuantity } from "@/lib/utils";

/**
 * Tarjeta de una recepción.
 *
 * El orden responde a cómo llega la pregunta en el piso: primero CUÁNDO
 * ("¿qué llegó el martes?"), luego QUÉ TELA —que es lo que de verdad
 * identifica la entrega— y después la guía, que es el papel que trae en la
 * mano quien pregunta.
 *
 * A la derecha van los METROS grandes y los rollos debajo. El metraje es lo
 * que se compara contra la factura; el conteo de rollos, contra lo que se
 * bajó del camión. Antes sólo estaba el conteo y había que abrir la
 * recepción para saber cuánta tela era.
 */
export function ReceiptCard({ receipt }: { receipt: ReceiptCardData }) {
  const unitLabel = receipt.unit ? UNIT_SHORT_LABELS[receipt.unit] : "";

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

          {/* La tela, en grande: es lo que distingue una recepción de otra
              cuando llegan tres el mismo día.

              Con dos o más telas el nombre se calla y el desglose de abajo
              toma el relevo: ahí cada una viene con su cantidad, que es lo
              que hay que cuadrar contra la factura. */}
          {receipt.materialNames.length === 1 && (
            <p className="mt-1 truncate text-sm font-medium">
              {receipt.materialNames[0]}
            </p>
          )}

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
          {receipt.totalQuantity > 0 && (
            <p className="tabular text-2xl font-semibold leading-none">
              {formatQuantity(receipt.totalQuantity, { unit: unitLabel })}
            </p>
          )}
          <p className="tabular mt-0.5 text-xs text-muted-foreground">
            {receipt.lotCount} {receipt.lotCount === 1 ? "rollo" : "rollos"}
          </p>
        </div>
      </div>

      {/* Cuánto entró de CADA tela.

          Sólo cuando la guía trae más de una: con una sola, la cifra grande
          de arriba ya es ésa y repetirla llenaría la tarjeta de ruido. Con
          dos, ese total grande es la suma y no dice cuánto fue de cada cual
          —que es justo lo que se compara contra la factura—. */}
      {receipt.materials.length > 1 && (
        <ul className="mt-2 border-t border-border">
          {receipt.materials.map((material) => (
            <li
              key={`${material.materialId}-${material.unit}`}
              className="flex items-baseline justify-between gap-3 border-b border-border py-1.5 last:border-0 text-sm"
            >
              <span className="min-w-0 truncate font-medium">
                {material.name}
              </span>
              <span className="tabular shrink-0">
                {formatQuantity(material.quantity, {
                  unit: UNIT_SHORT_LABELS[material.unit],
                })}
                <span className="ml-1.5 text-xs text-muted-foreground">
                  {material.lots} {material.lots === 1 ? "rollo" : "rollos"}
                </span>
              </span>
            </li>
          ))}
        </ul>
      )}

      {/* Sólo se pintan los chips que traen dato: una fila de "—" ocupa el
          mismo espacio que la información y no dice nada. */}
      <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
        {/* Los dueños salen de los rollos, no del encabezado: una guía puede
            traer tela de dos clientes y en ese caso el encabezado está vacío
            a propósito. Con más de dos se cuentan, que si no el chip se come
            la tarjeta entera en el celular. */}
        {receipt.ownerNames.length > 0 && (
          <Chip icon={User} label={ownersLabel(receipt.ownerNames)} />
        )}
        {receipt.origin && <Chip icon={Boxes} label={receipt.origin} />}
        {receipt.invoiceRef && (
          <Chip icon={Factory} label={`Factura ${receipt.invoiceRef}`} />
        )}
        {receipt.carrier && <Chip icon={Truck} label={receipt.carrier.name} />}
        {receipt.supplier && <Chip icon={Factory} label={receipt.supplier.name} />}
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
    <span className="flex max-w-full items-center gap-1 rounded border border-border px-1.5 py-0.5 text-xs text-muted-foreground">
      <Icon className="size-3 shrink-0" aria-hidden />
      <span className="truncate">{label}</span>
    </span>
  );
}

/** Uno o dos dueños se nombran; de tres en adelante se cuentan. */
function ownersLabel(owners: string[]): string {
  if (owners.length <= 2) return owners.join(" · ");
  return `${owners.length} dueños`;
}
