"use client";

import { useMemo, useState, type ComponentProps } from "react";
import Link from "next/link";
import { Inbox, SearchX } from "lucide-react";
import { WORKSHOP_BOARD_TAB_LABELS } from "@/lib/constants/labels";
import type { WorkshopBoardTab } from "@/lib/constants/workshop-access";
import type { WorkshopDeliveryRow } from "@/lib/services/workshop-delivery.service";
import { cn, formatDate, formatDateTime, formatQuantity } from "@/lib/utils";
import { filterDeliveries } from "@/lib/workshop-delivery-search";
import { EmptyState } from "@/components/shared/empty-state";
import { DeliveryFilter } from "@/components/workshop-orders/delivery-filter";
import { DispatchNote } from "@/components/workshop-orders/dispatch-status";
import { ReceiveButton } from "@/components/workshop-orders/receive-button";
import {
  BoardDeliveryDialog,
  useBoardDelivery,
} from "./board-delivery-dialog";
import { BoardReportDialog } from "./board-report-dialog";
import {
  activeOutputCount,
  OutputsPanel,
  type OutputsBoardData,
} from "@/components/workshop-outputs/outputs-panel";

interface Props {
  rows: WorkshopDeliveryRow[];
  /** `null` = este taller no lleva pestaña Salidas (confección, o sin cuenta). */
  outputs: OutputsBoardData | null;
  tab: WorkshopBoardTab;
  basePath: string;
  /** Sólo el dueño abre el detalle y confirma; ADMIN nada más mira. */
  isOwner: boolean;
  /** Lo que la ventana del reporte necesita; el filtro lo pone el buscador. */
  report: Omit<ComponentProps<typeof BoardReportDialog>, "search">;
}

const TAB_PARAMS: Record<WorkshopBoardTab, string> = {
  pending: "por-recibir",
  received: "recibidas",
  outputs: "salidas",
};

type DeliveryTab = Exclude<WorkshopBoardTab, "outputs">;

const EMPTY_MESSAGES: Record<DeliveryTab, string> = {
  pending: "No tienes entregas por recibir.",
  received: "Todavía no has marcado ninguna entrega como recibida.",
};

/**
 * Pestañas y entregas del tablero, con su buscador.
 *
 * El filtro va ANTES de partir en pestañas: así el contador de cada una dice
 * cuántas coinciden, y el taller ve de un vistazo si lo que busca ya lo
 * recibió o sigue pendiente.
 */
export function DeliveryBoardBody({
  rows,
  outputs,
  tab: requestedTab,
  basePath,
  isOwner,
  report,
}: Props) {
  const [query, setQuery] = useState("");
  const delivery = useBoardDelivery(report.boardKey);
  const groups = useMemo(
    () => groupRows(filterDeliveries(rows, query)),
    [rows, query],
  );
  /* Un taller sin Salidas que llegue con ?pestana=salidas cae en Por recibir. */
  const tab = requestedTab === "outputs" && !outputs ? "pending" : requestedTab;
  const tabs: WorkshopBoardTab[] = outputs ? ["pending", "received", "outputs"] : ["pending", "received"];
  const counts: Record<WorkshopBoardTab, number> = {
    pending: groups.pending.length,
    received: groups.received.length,
    outputs: outputs ? activeOutputCount(outputs) : 0,
  };

  return (
    <>
      <div className="flex flex-col gap-2 sm:flex-row">
        <DeliveryFilter value={query} onChange={setQuery} className="flex-1" />
        <BoardReportDialog {...report} search={query} />
      </div>

      <nav className="flex border-b border-border" aria-label="Entregas">
        {tabs.map((item) => (
          <Link
            key={item}
            href={`${basePath}?pestana=${TAB_PARAMS[item]}`}
            scroll={false}
            aria-current={item === tab ? "page" : undefined}
            className={cn(
              "touch-target flex flex-1 items-center justify-center gap-2 border-b-2 px-4 text-sm transition-colors sm:flex-none",
              item === tab
                ? "border-primary font-medium text-foreground"
                : "border-transparent text-muted-foreground",
            )}
          >
            {WORKSHOP_BOARD_TAB_LABELS[item]}
            <span className="tabular text-xs">{counts[item]}</span>
          </Link>
        ))}
      </nav>

      {tab === "outputs" && outputs ? (
        <OutputsPanel data={outputs} isOwner={isOwner} query={query} />
      ) : (
        <BoardList
          rows={groups[tab === "outputs" ? "pending" : tab]}
          tab={tab === "outputs" ? "pending" : tab}
          query={query}
          isOwner={isOwner}
          onOpen={(row) => delivery.open({ id: row.id, code: row.code })}
        />
      )}

      {/* Una sola ventana para todo el tablero: cambia de entrega, no se
          monta una por tarjeta. */}
      <BoardDeliveryDialog delivery={delivery} isOwner={isOwner} />
    </>
  );
}

function BoardList({
  rows,
  tab,
  query,
  isOwner,
  onOpen,
}: {
  rows: WorkshopDeliveryRow[];
  tab: DeliveryTab;
  query: string;
  isOwner: boolean;
  onOpen: (row: WorkshopDeliveryRow) => void;
}) {
  if (rows.length > 0) {
    return (
      <ul className="flex flex-col gap-2">
        {rows.map((row) => (
          <BoardRow key={row.id} row={row} isOwner={isOwner} onOpen={onOpen} />
        ))}
      </ul>
    );
  }

  if (query.trim()) {
    return (
      <div className="flat-surface">
        <EmptyState
          icon={SearchX}
          title={`Ninguna entrega coincide con “${query.trim()}”`}
        />
      </div>
    );
  }

  return (
    <div className="flat-surface">
      <EmptyState icon={Inbox} title={EMPTY_MESSAGES[tab]} />
    </div>
  );
}

/**
 * Las canceladas no van en ninguna pestaña: ni le falta recibirlas ni cuentan
 * como recibidas. Siguen en Órdenes, donde se explica qué pasó con ellas.
 */
function groupRows(
  rows: WorkshopDeliveryRow[],
): Record<DeliveryTab, WorkshopDeliveryRow[]> {
  return {
    // La que más lleva esperando va primero: es la que urge revisar.
    pending: rows
      .filter((row) => row.state === "PENDING")
      .sort((a, b) => a.sentAt.getTime() - b.sentAt.getTime()),
    received: rows
      .filter((row) => row.state === "RECEIVED")
      .sort(
        (a, b) =>
          (b.receivedAt?.getTime() ?? 0) - (a.receivedAt?.getTime() ?? 0),
      ),
  };
}

function BoardRow({
  row,
  isOwner,
  onOpen,
}: {
  row: WorkshopDeliveryRow;
  isOwner: boolean;
  onOpen: (row: WorkshopDeliveryRow) => void;
}) {
  return (
    <li className="flat-surface relative flex flex-col gap-2 p-3 transition-colors active:bg-accent">
      {/* La tarjeta entera abre la ficha, como capa encima y no envolviéndola:
          un <button> dentro de otro no es HTML válido, y Recibir tiene que
          seguir respondiendo por su cuenta. */}
      <button
        type="button"
        onClick={() => onOpen(row)}
        className="absolute inset-0 z-10"
        aria-label={`Ver la entrega ${row.code}`}
      />
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="tabular text-sm font-medium">{row.code}</p>
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
        </div>

        {/* Por encima de la capa: confirmar no debe abrir la ficha. */}
        {isOwner && row.state === "PENDING" && row.dispatchedAt && (
          <div className="relative z-20">
            <ReceiveButton
              id={row.id}
              code={row.code}
              pieces={row.pieces}
              bundles={row.bundles}
            />
          </div>
        )}
      </div>

      {row.state === "RECEIVED" && <ReceivedInfo row={row} />}
    </li>
  );
}

function ReceivedInfo({ row }: { row: WorkshopDeliveryRow }) {
  return (
    <div className="flex flex-col gap-1 border-t border-border pt-2 text-xs">
      <p className="tabular text-muted-foreground">
        Recibida el {formatDateTime(row.receivedAt)}
        {row.receivedByName && ` por ${row.receivedByName}`}
      </p>
      {row.receivedNotes && (
        <p className="break-words text-sm">
          <span className="font-medium">Nota:</span> {row.receivedNotes}
        </p>
      )}
    </div>
  );
}
