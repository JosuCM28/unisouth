import { Ban, FileText, Printer } from "lucide-react";
import { sumBundlePieces } from "@/lib/bundles";
import type { ActiveWorkshopDelivery } from "@/lib/services/workshop-delivery.service";
import { formatDate, formatDateTime, formatQuantity } from "@/lib/utils";
import { CutTagChip } from "@/components/orders/size-note";
import { OrderBatches } from "@/components/orders/order-batches";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { DeliveryStateBadge } from "./delivery-state-badge";
import { DispatchNote } from "./dispatch-status";
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
  canReceive = true,
  onReceived,
}: {
  delivery: ActiveWorkshopDelivery;
  /**
   * Si se ofrece Recibir. ADMIN abre la ficha desde el tablero pero no
   * confirma: eso le toca al taller, y el botón le rebotaría.
   */
  canReceive?: boolean;
  onReceived?: () => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      <DeliveryHeader
        delivery={delivery}
        canReceive={canReceive}
        onReceived={onReceived}
      />
      <DeliveryLines delivery={delivery} />
      <IncomingOutputs delivery={delivery} />
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

function DeliveryHeader({
  delivery,
  canReceive,
  onReceived,
}: {
  delivery: ActiveWorkshopDelivery;
  canReceive: boolean;
  onReceived?: () => void;
}) {
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

      <DispatchNote dispatchedAt={delivery.dispatchedAt} />

      {delivery.state === "RECEIVED" && (
        <p className="tabular text-sm">
          Recibida el {formatDateTime(delivery.receivedAt)}
          {delivery.receivedByName && ` por ${delivery.receivedByName}`}
        </p>
      )}

      {delivery.receivedNotes && (
        <p className="break-words border border-border bg-muted p-2 text-sm">
          <span className="font-medium">Nota:</span> {delivery.receivedNotes}
        </p>
      )}

      <div className="flex flex-col gap-2 sm:flex-row">
        {canReceive && delivery.state === "PENDING" && delivery.dispatchedAt && (
          <ReceiveButton
            id={delivery.id}
            code={delivery.code}
            pieces={delivery.pieces}
            bundles={delivery.bundles}
            onReceived={onReceived}
          />
        )}
        {delivery.voucherId && (
          <DocumentLinks
            label="salida"
            pdfHref={`/api/workshop-pdf/voucher/${delivery.voucherId}`}
            printHref={`/print/document/${delivery.voucherId}`}
          />
        )}
        {delivery.orderId && (
          <DocumentLinks
            label="orden"
            pdfHref={`/api/workshop-pdf/order/${delivery.orderId}`}
            printHref={`/print/order/${delivery.orderId}`}
          />
        )}
      </div>
    </section>
  );
}

/**
 * Cada hoja con dos salidas: el PDF y la página de impresión.
 *
 * El PDF va primero porque en el celular la página de impresión, hecha para
 * una hoja carta, no cabe y se ve rota; el visor del teléfono sí la enseña
 * completa y deja hacerle zoom. Reimprimir sigue para quien imprime en PC.
 */
function DocumentLinks({
  label,
  pdfHref,
  printHref,
}: {
  label: string;
  pdfHref: string;
  printHref: string;
}) {
  return (
    <>
      <Button asChild variant="outline" className="touch-target">
        <a href={pdfHref} target="_blank" rel="noopener">
          <FileText className="size-4" aria-hidden />
          Ver {label} en PDF
        </a>
      </Button>
      <Button asChild variant="outline" className="touch-target">
        <a href={printHref} target="_blank" rel="noopener">
          <Printer className="size-4" aria-hidden />
          Reimprimir {label}
        </a>
      </Button>
    </>
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

/**
 * Lo que otros talleres mandaron de esta orden. Sólo se lee: nadie tiene que
 * recibirlo, y por eso no lleva botón.
 */
function IncomingOutputs({ delivery }: { delivery: ActiveWorkshopDelivery }) {
  if (delivery.incoming.length === 0) return null;

  return (
    <section className="flat-surface flex flex-col gap-2 p-4">
      <h2 className="text-sm font-semibold">De otros talleres</h2>
      <ul className="flex flex-col gap-1 text-sm">
        {delivery.incoming.map((output) => (
          <li key={output.code} className="tabular">
            De {output.fromWorkshop}: {formatQuantity(output.pieces)} pzas
            {output.parts && ` · ${output.parts}`} · {formatDate(output.date)}
            <span className="ml-2 text-xs text-muted-foreground">{output.code}</span>
          </li>
        ))}
      </ul>
    </section>
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
