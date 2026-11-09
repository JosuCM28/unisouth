import { Ban, Printer } from "lucide-react";
import { sumBundlePieces } from "@/lib/bundles";
import type { ActiveWorkshopDelivery } from "@/lib/services/workshop-delivery.service";
import { formatDate, formatDateTime, formatQuantity } from "@/lib/utils";
import { CutTagChip } from "@/components/orders/size-note";
import { OrderBatches } from "@/components/orders/order-batches";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { DeliveryStateBadge } from "./delivery-state-badge";
import { ReceiveButton } from "./receive-button";

export function CancelledDelivery({ code }: { code: string }) {
  return (
    <div className="flat-surface">
      <EmptyState
        icon={Ban}
        title={`La entrega ${code} se canceló`}
        description="Ya no está disponible. Si tienes dudas, comunícate con la fábrica."
      />
    </div>
  );
}

/** Una entrega vigente: qué se mandó, de qué orden y cómo confirmarla. */
export function DeliveryDetail({
  delivery,
}: {
  delivery: ActiveWorkshopDelivery;
}) {
  return (
    <div className="flex flex-col gap-4">
      <DeliveryHeader delivery={delivery} />
      <DeliveryLines delivery={delivery} />
      <OrderData delivery={delivery} />
      <Notes delivery={delivery} />

      {delivery.showCuts && <OrderCuts delivery={delivery} />}
    </div>
  );
}

function OrderCuts({ delivery }: { delivery: ActiveWorkshopDelivery }) {
  return (
    <section className="flat-surface p-4">
      <h2 className="mb-3 text-sm font-semibold">
        Cortes de la orden ({delivery.cuts.length})
      </h2>
      {delivery.cuts.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Esta orden todavía no tiene cortes capturados.
        </p>
      ) : (
        <OrderBatches
          batches={delivery.cuts}
          orderId={delivery.id}
          orderCode={delivery.order.reference}
        />
      )}
    </section>
  );
}

function DeliveryHeader({ delivery }: { delivery: ActiveWorkshopDelivery }) {
  return (
    <section className="flat-surface flex flex-col gap-3 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="tabular text-lg font-semibold">{delivery.code}</span>
        <DeliveryStateBadge state={delivery.state} />
      </div>

      <p className="tabular text-sm text-muted-foreground">
        {delivery.stageName} · salió el {formatDate(delivery.sentAt)} ·{" "}
        {formatQuantity(delivery.pieces)} pzas · {delivery.bundles} bultos
      </p>

      {delivery.state === "RECEIVED" && (
        <p className="tabular text-sm">
          Recibida el {formatDateTime(delivery.receivedAt)}
          {delivery.receivedByName && ` por ${delivery.receivedByName}`}
        </p>
      )}

      <div className="flex flex-col gap-2 sm:flex-row">
        {delivery.state === "PENDING" && (
          <ReceiveButton
            id={delivery.id}
            code={delivery.code}
            pieces={delivery.pieces}
            bundles={delivery.bundles}
          />
        )}
        {delivery.voucherId && (
          <Button asChild variant="outline" className="touch-target">
            <a
              href={`/print/document/${delivery.voucherId}`}
              target="_blank"
              rel="noopener"
            >
              <Printer className="size-4" aria-hidden />
              Reimprimir salida
            </a>
          </Button>
        )}
      </div>
    </section>
  );
}

function DeliveryLines({ delivery }: { delivery: ActiveWorkshopDelivery }) {
  return (
    <section className="flat-surface p-4">
      <h2 className="mb-2 text-sm font-semibold">Lo que te mandaron</h2>
      <ul className="flex flex-col">
        {delivery.lines.map((line) => (
          <li
            key={line.id}
            className="flex items-start justify-between gap-3 border-t border-border py-1.5 text-sm"
          >
            <span className="flex min-w-0 flex-col gap-0.5">
              <span className="flex items-center gap-1.5">
                <span className="tabular font-medium">Talla {line.sizeCode}</span>
                {line.tag && <CutTagChip tag={line.tag} className="text-xs" />}
              </span>
              {line.notes && (
                <span className="break-words text-xs text-muted-foreground">
                  {line.notes}
                </span>
              )}
            </span>
            <span className="tabular shrink-0">
              {line.bundles > 1 && `${line.sentQuantity} × ${line.bundles} = `}
              {sumBundlePieces([
                { quantity: line.sentQuantity, bundles: line.bundles },
              ])}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function OrderData({ delivery }: { delivery: ActiveWorkshopDelivery }) {
  const { order } = delivery;

  return (
    <section className="flat-surface p-4">
      <h2 className="mb-2 text-sm font-semibold">Datos de la orden</h2>
      <dl className="grid gap-x-8 sm:grid-cols-2">
        <Row label="Folio de orden" value={order.reference} tabular />
        <Row label="PO cliente" value={order.clientPo} tabular />
        <Row label="Cliente" value={order.clientName} />
        <Row label="Prenda" value={order.description} />
        <Row label="Tela" value={order.fabric} />
        <Row label="Molde" value={order.pattern} />
        <Row label="Versión" value={order.version} />
        <Row label="Notas de versión" value={order.versionNotes} />
        <Row
          label="Entrega"
          value={order.dueDate ? formatDate(order.dueDate) : null}
          tabular
        />
        <Row label="Qué partes van" value={delivery.parts} />
        <Row label="Referencia" value={delivery.reference} tabular />
      </dl>
    </section>
  );
}

function Row({
  label,
  value,
  tabular = false,
}: {
  label: string;
  value: string | null;
  tabular?: boolean;
}) {
  if (!value) return null;

  return (
    <div className="flex justify-between gap-3 border-b border-border py-1.5 text-sm last:border-0">
      <dt className="shrink-0 text-muted-foreground">{label}</dt>
      <dd className={tabular ? "tabular text-right" : "break-words text-right"}>
        {value}
      </dd>
    </div>
  );
}

function Notes({ delivery }: { delivery: ActiveWorkshopDelivery }) {
  const { order, notes } = delivery;
  if (order.cutNotes.length === 0 && !order.notes && !notes) return null;

  return (
    <section className="flat-surface flex flex-col gap-2 p-4">
      <h2 className="text-sm font-semibold">Notas</h2>
      {order.cutNotes.length > 0 && (
        <ol className="flex flex-col gap-1 text-sm">
          {order.cutNotes.map((note, index) => (
            <li key={index} className="flex gap-2">
              <span className="tabular shrink-0 font-medium">
                Nota {index + 1}.
              </span>
              <span className="break-words">{note}</span>
            </li>
          ))}
        </ol>
      )}
      {order.notes && (
        <p className="whitespace-pre-wrap text-sm">{order.notes}</p>
      )}
      {notes && <p className="whitespace-pre-wrap text-sm">{notes}</p>}
    </section>
  );
}
