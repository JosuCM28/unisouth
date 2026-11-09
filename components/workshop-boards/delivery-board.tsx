import Link from "next/link";
import { Factory, Inbox } from "lucide-react";
import { WORKSHOP_BOARD_TAB_LABELS } from "@/lib/constants/labels";
import type { Role } from "@/lib/constants/roles";
import type {
  WorkshopBoardTab,
  WorkshopRole,
} from "@/lib/constants/workshop-access";
import {
  WorkshopDeliveryService,
  type WorkshopDeliveryList,
  type WorkshopDeliveryRow,
} from "@/lib/services/workshop-delivery.service";
import { cn, formatDate, formatDateTime, formatQuantity } from "@/lib/utils";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { DispatchNote } from "@/components/workshop-orders/dispatch-status";
import { ReceiveButton } from "@/components/workshop-orders/receive-button";

export interface DeliveryBoardProps {
  title: string;
  /** De qué taller es este tablero. */
  boardRole: WorkshopRole;
  /** Quién lo mira: ADMIN lo ve, pero confirmar le toca al taller. */
  viewerRole: Role;
  tab: WorkshopBoardTab;
  basePath: string;
}

const TAB_PARAMS: Record<WorkshopBoardTab, string> = {
  pending: "por-recibir",
  received: "recibidas",
};

const TABS: WorkshopBoardTab[] = ["pending", "received"];

const EMPTY_MESSAGES: Record<WorkshopBoardTab, string> = {
  pending: "No tienes entregas por recibir.",
  received: "Todavía no has marcado ninguna entrega como recibida.",
};

export async function DeliveryBoard(props: DeliveryBoardProps) {
  const list = await new WorkshopDeliveryService().listForRole(props.boardRole);
  return <DeliveryBoardView {...props} list={list} />;
}

/** Sin consultas: recibe las entregas ya leídas. */
export function DeliveryBoardView({
  title,
  boardRole,
  viewerRole,
  tab,
  basePath,
  list,
}: DeliveryBoardProps & { list: WorkshopDeliveryList | null }) {
  if (!list) {
    return (
      <div className="flex flex-col gap-4">
        <PageHeader title={title} description="Sin taller ligado" />
        <div className="flat-surface">
          <EmptyState
            icon={Factory}
            title="Este tablero aún no está ligado a un taller"
            description="Se liga en el catálogo de Talleres, en Cuenta de acceso."
          />
        </div>
      </div>
    );
  }

  const groups = groupRows(list.rows);
  const rows = groups[tab];
  // El detalle pide la llave del taller: a ADMIN lo mandaría a un error.
  const isOwner = viewerRole === boardRole;

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={title} description={list.workshopName} />

      <nav className="flex border-b border-border" aria-label="Entregas">
        {TABS.map((item) => (
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
            <span className="tabular text-xs">{groups[item].length}</span>
          </Link>
        ))}
      </nav>

      {rows.length === 0 ? (
        <div className="flat-surface">
          <EmptyState icon={Inbox} title={EMPTY_MESSAGES[tab]} />
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {rows.map((row) => (
            <BoardRow key={row.id} row={row} isOwner={isOwner} />
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * Las canceladas no van en ninguna pestaña: ni le falta recibirlas ni cuentan
 * como recibidas. Siguen en Órdenes, donde se explica qué pasó con ellas.
 */
function groupRows(
  rows: WorkshopDeliveryRow[],
): Record<WorkshopBoardTab, WorkshopDeliveryRow[]> {
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
}: {
  row: WorkshopDeliveryRow;
  isOwner: boolean;
}) {
  return (
    <li className="flat-surface flex flex-col gap-2 p-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <DeliveryCode row={row} isOwner={isOwner} />
          <p className="tabular text-sm">
            {row.orderReference} · {row.clientName}
          </p>
          <p className="break-words text-sm">{row.description}</p>
          <p className="tabular text-xs text-muted-foreground">
            {row.stageName} · {formatDate(row.sentAt)} ·{" "}
            {formatQuantity(row.pieces)} pzas · {row.bundles} bultos
          </p>
          <DispatchNote dispatchedAt={row.dispatchedAt} />
        </div>

        {isOwner && row.state === "PENDING" && row.dispatchedAt && (
          <ReceiveButton
            id={row.id}
            code={row.code}
            pieces={row.pieces}
            bundles={row.bundles}
          />
        )}
      </div>

      {row.state === "RECEIVED" && <ReceivedInfo row={row} />}
    </li>
  );
}

function DeliveryCode({
  row,
  isOwner,
}: {
  row: WorkshopDeliveryRow;
  isOwner: boolean;
}) {
  if (!isOwner) {
    return <p className="tabular text-sm font-medium">{row.code}</p>;
  }

  return (
    <Link
      href={`/workshop-orders/${row.id}`}
      className="tabular touch-target flex w-fit items-center text-sm font-medium underline"
    >
      {row.code}
    </Link>
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
