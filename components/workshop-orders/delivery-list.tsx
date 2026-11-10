"use client";

import { useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { ChevronRight, Inbox, SearchX } from "lucide-react";
import type {
  WorkshopDeliveryList,
  WorkshopDeliveryRow,
} from "@/lib/services/workshop-delivery.service";
import { formatDate, formatQuantity } from "@/lib/utils";
import { filterDeliveries } from "@/lib/workshop-delivery-search";
import { ColumnPicker } from "@/components/shared/column-picker";
import { EmptyState } from "@/components/shared/empty-state";
import {
  useColumnVisibility,
  type ColumnVisibility,
} from "@/components/shared/use-column-visibility";
import { DeliveryFilter } from "./delivery-filter";
import { DeliveryStateBadge } from "./delivery-state-badge";
import { DispatchNote } from "./dispatch-status";

interface DeliveryColumn {
  id: string;
  label: string;
  numeric?: boolean;
  cell: (row: WorkshopDeliveryRow) => ReactNode;
  /** Qué enseña una cancelada en esta columna. Sin esto, celda vacía. */
  cancelledCell?: (row: WorkshopDeliveryRow) => ReactNode;
}

/*
 * El folio no está aquí: es el enlace a la entrega y siempre se ve. Lo demás
 * se prende y apaga desde Columnas.
 */
const COLUMNS: DeliveryColumn[] = [
  {
    id: "state",
    label: "Estado",
    cell: (row) => (
      <>
        <DeliveryStateBadge state={row.state} />
        <DispatchNote dispatchedAt={row.dispatchedAt} />
      </>
    ),
    cancelledCell: (row) => <DeliveryStateBadge state={row.state} />,
  },
  {
    id: "order",
    label: "Orden",
    cell: (row) => (
      <span className="tabular">
        {row.orderReference}
        <span className="block text-xs text-muted-foreground">
          {row.clientName}
        </span>
      </span>
    ),
    cancelledCell: () => "Esta entrega se canceló",
  },
  {
    id: "clientPo",
    label: "PO cliente",
    cell: (row) => <span className="tabular">{row.clientPo ?? "—"}</span>,
  },
  { id: "description", label: "Prenda", cell: (row) => row.description },
  { id: "stage", label: "Etapa", cell: (row) => row.stageName },
  {
    id: "sentAt",
    label: "Salió",
    cell: (row) => <span className="tabular">{formatDate(row.sentAt)}</span>,
    cancelledCell: (row) => (
      <span className="tabular">{formatDate(row.sentAt)}</span>
    ),
  },
  {
    id: "pieces",
    label: "Piezas",
    numeric: true,
    cell: (row) => <span className="tabular">{formatQuantity(row.pieces)}</span>,
  },
  {
    id: "bundles",
    label: "Bultos",
    numeric: true,
    cell: (row) => <span className="tabular">{row.bundles}</span>,
  },
];

const PICKABLE = COLUMNS.map(({ id, label }) => ({ id, label }));

/* La PO nace escondida, igual que en Órdenes: quien la usa la prende. Fuera
   del componente para que el hook reciba siempre el mismo objeto. */
const DEFAULT_VISIBILITY: ColumnVisibility = { clientPo: false };

/** Las entregas del taller: tarjetas en celular, tabla desde `md:`. */
export function DeliveryList({ list }: { list: WorkshopDeliveryList }) {
  const [query, setQuery] = useState("");
  const { visibility, setVisible } = useColumnVisibility(
    "workshop-orders",
    DEFAULT_VISIBILITY,
  );

  const rows = useMemo(
    () => filterDeliveries(list.rows, query),
    [list.rows, query],
  );
  const columns = COLUMNS.filter((column) => visibility[column.id] !== false);

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
      <div className="flex gap-2">
        <DeliveryFilter value={query} onChange={setQuery} className="flex-1" />
        {/* En celular son tarjetas: no hay columnas que elegir. */}
        <div className="hidden md:block">
          <ColumnPicker
            columns={PICKABLE}
            visibility={visibility}
            onChange={setVisible}
          />
        </div>
      </div>

      <DeliveryResults rows={rows} columns={columns} query={query} />

      {list.truncated && (
        <p className="text-xs text-muted-foreground">
          Se muestran las {list.rows.length} entregas más recientes.
        </p>
      )}
    </div>
  );
}

function DeliveryResults({
  rows,
  columns,
  query,
}: {
  rows: WorkshopDeliveryRow[];
  columns: DeliveryColumn[];
  query: string;
}) {
  if (rows.length === 0) {
    return (
      <div className="flat-surface">
        <EmptyState
          icon={SearchX}
          title={`Ninguna entrega coincide con “${query.trim()}”`}
          description="Prueba con el número de orden, la empresa, la prenda o la PO."
        />
      </div>
    );
  }

  return (
    <>
      <ul className="flex flex-col gap-2 md:hidden">
        {rows.map((row) => (
          <DeliveryCard key={row.id} row={row} />
        ))}
      </ul>
      <DeliveryTable rows={rows} columns={columns} />
    </>
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
      {row.clientPo && (
        <p className="tabular text-xs text-muted-foreground">
          PO {row.clientPo}
        </p>
      )}
      <p className="break-words text-sm">{row.description}</p>
      <p className="tabular text-xs text-muted-foreground">
        {row.stageName} · {formatDate(row.sentAt)} ·{" "}
        {formatQuantity(row.pieces)} pzas · {row.bundles} bultos
      </p>
      <DispatchNote dispatchedAt={row.dispatchedAt} />
    </>
  );
}

function DeliveryTable({
  rows,
  columns,
}: {
  rows: WorkshopDeliveryRow[];
  columns: DeliveryColumn[];
}) {
  return (
    <div className="flat-surface hidden md:block">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs">
            <th className="p-3 font-medium">Entrega</th>
            {columns.map((column) => (
              <th
                key={column.id}
                className={column.numeric ? "p-3 text-right font-medium" : "p-3 font-medium"}
              >
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <TableRow key={row.id} row={row} columns={columns} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TableRow({
  row,
  columns,
}: {
  row: WorkshopDeliveryRow;
  columns: DeliveryColumn[];
}) {
  const cancelled = row.state === "CANCELLED";

  return (
    <tr
      className={
        cancelled
          ? "border-b border-border text-muted-foreground last:border-0"
          : "border-b border-border last:border-0"
      }
    >
      <td className="tabular p-3 font-medium">
        <DeliveryCode row={row} />
      </td>
      {columns.map((column) => (
        <td
          key={column.id}
          className={column.numeric ? "p-3 text-right" : "p-3"}
        >
          {cellContent(column, row)}
        </td>
      ))}
    </tr>
  );
}

function cellContent(column: DeliveryColumn, row: WorkshopDeliveryRow) {
  if (row.state !== "CANCELLED") return column.cell(row);
  return column.cancelledCell?.(row) ?? null;
}

/** Una cancelada no tiene ficha que abrir: el folio va sin enlace. */
function DeliveryCode({ row }: { row: WorkshopDeliveryRow }) {
  if (row.state === "CANCELLED") return row.code;

  return (
    <Link href={`/workshop-orders/${row.id}`} className="underline">
      {row.code}
    </Link>
  );
}
