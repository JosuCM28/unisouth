import Link from "next/link";
import { ChevronRight, Inbox } from "lucide-react";
import type {
  WorkshopDeliveryList,
  WorkshopDeliveryRow,
} from "@/lib/services/workshop-delivery.service";
import { formatDate, formatQuantity } from "@/lib/utils";
import { EmptyState } from "@/components/shared/empty-state";
import { DeliveryStateBadge } from "./delivery-state-badge";

/** Las entregas del taller: tarjetas en celular, tabla desde `md:`. */
export function DeliveryList({ list }: { list: WorkshopDeliveryList }) {
  if (list.rows.length === 0) {
    return (
      <div className="flat-surface">
        <EmptyState
          icon={Inbox}
          title="Aún no te han mandado nada"
          description="Cuando te envíen un corte, aparece aquí para que confirmes que te llegó."
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <ul className="flex flex-col gap-2 md:hidden">
        {list.rows.map((row) => (
          <DeliveryCard key={row.id} row={row} />
        ))}
      </ul>

      <DeliveryTable rows={list.rows} />

      {list.truncated && (
        <p className="text-xs text-muted-foreground">
          Se muestran las {list.rows.length} entregas más recientes.
        </p>
      )}
    </div>
  );
}

function DeliveryCard({ row }: { row: WorkshopDeliveryRow }) {
  const content = (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="tabular text-sm font-medium">{row.code}</span>
          <DeliveryStateBadge state={row.state} />
        </div>
        <CardBody row={row} />
      </div>
      {row.state !== "CANCELLED" && (
        <ChevronRight
          className="mt-0.5 size-4 shrink-0 text-muted-foreground"
          aria-hidden
        />
      )}
    </div>
  );

  if (row.state === "CANCELLED") {
    return <li className="flat-surface p-3">{content}</li>;
  }

  return (
    <li>
      <Link
        href={`/workshop-orders/${row.id}`}
        className="flat-surface touch-target block p-3"
      >
        {content}
      </Link>
    </li>
  );
}

/** Una cancelada dice sólo que existió: sus datos ya no son para el taller. */
function CardBody({ row }: { row: WorkshopDeliveryRow }) {
  if (row.state === "CANCELLED") {
    return (
      <p className="tabular text-xs text-muted-foreground">
        {formatDate(row.sentAt)} · Esta entrega se canceló
      </p>
    );
  }

  return (
    <>
      <p className="tabular text-sm">
        {row.orderReference} · {row.clientName}
      </p>
      <p className="break-words text-sm">{row.description}</p>
      <p className="tabular text-xs text-muted-foreground">
        {row.stageName} · {formatDate(row.sentAt)} ·{" "}
        {formatQuantity(row.pieces)} pzas · {row.bundles} bultos
      </p>
    </>
  );
}

function DeliveryTable({ rows }: { rows: WorkshopDeliveryRow[] }) {
  return (
    <div className="flat-surface hidden md:block">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs">
            <th className="p-3 font-medium">Entrega</th>
            <th className="p-3 font-medium">Estado</th>
            <th className="p-3 font-medium">Orden</th>
            <th className="p-3 font-medium">Prenda</th>
            <th className="p-3 font-medium">Etapa</th>
            <th className="p-3 font-medium">Salió</th>
            <th className="p-3 text-right font-medium">Piezas</th>
            <th className="p-3 text-right font-medium">Bultos</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <TableRow key={row.id} row={row} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TableRow({ row }: { row: WorkshopDeliveryRow }) {
  if (row.state === "CANCELLED") {
    return (
      <tr className="border-b border-border text-muted-foreground last:border-0">
        <td className="tabular p-3 font-medium">{row.code}</td>
        <td className="p-3">
          <DeliveryStateBadge state={row.state} />
        </td>
        <td className="p-3" colSpan={3}>
          Esta entrega se canceló
        </td>
        <td className="tabular p-3">{formatDate(row.sentAt)}</td>
        <td className="p-3" colSpan={2} />
      </tr>
    );
  }

  return (
    <tr className="border-b border-border last:border-0">
      <td className="tabular p-3 font-medium">
        <Link href={`/workshop-orders/${row.id}`} className="underline">
          {row.code}
        </Link>
      </td>
      <td className="p-3">
        <DeliveryStateBadge state={row.state} />
      </td>
      <td className="tabular p-3">
        {row.orderReference}
        <span className="block text-xs text-muted-foreground">
          {row.clientName}
        </span>
      </td>
      <td className="p-3">{row.description}</td>
      <td className="p-3">{row.stageName}</td>
      <td className="tabular p-3">{formatDate(row.sentAt)}</td>
      <td className="tabular p-3 text-right">{formatQuantity(row.pieces)}</td>
      <td className="tabular p-3 text-right">{row.bundles}</td>
    </tr>
  );
}
