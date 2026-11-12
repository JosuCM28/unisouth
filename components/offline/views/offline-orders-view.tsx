"use client";

import { useMemo, useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import {
  CUTTING_ORDER_STATUS_LABELS,
  CUTTING_ORDER_STATUS_STYLES,
} from "@/lib/constants/labels";
import type { OfflineIssue, OfflineOrder } from "@/lib/offline/snapshot.types";
import { cn } from "@/lib/utils";
import { byId, useOfflineTable } from "@/hooks/use-offline-table";
import { OfflineOrderDetail } from "./offline-order-detail";
import { MAX_RESULTS, matches, normalizeTerm, OfflineSearchField } from "./offline-search-field";
import {
  OfflineLoading, OfflineSnapshotMissing, OfflineSnapshotNotice,
} from "./offline-snapshot-notice";

/**
 * Órdenes abiertas y en corte, leídas de la copia del equipo.
 *
 * La copia sólo trae las vivas: una orden terminada ya no se consulta en el
 * piso, y bajarlas todas llenaría el celular de historia.
 */
export function OfflineOrdersView() {
  const orders = useOfflineTable("orders");
  const clients = useOfflineTable("clients");
  const sizes = useOfflineTable("sizes");
  const tags = useOfflineTable("cutTags");
  const issues = useOfflineTable("issues");
  const [search, setSearch] = useState("");

  const clientById = useMemo(() => byId(clients.records), [clients.records]);
  const sizeById = useMemo(() => byId(sizes.records), [sizes.records]);
  const tagById = useMemo(() => byId(tags.records), [tags.records]);
  const issuesByOrder = useMemo(() => groupIssues(issues.records), [issues.records]);

  const filtered = useMemo(() => {
    const term = normalizeTerm(search);
    return orders.records
      .filter((order) =>
        matches(term, [
          order.code, order.reference, order.clientPo, order.description,
          order.clientId ? clientById.get(order.clientId)?.name : null,
        ]),
      )
      // Lo que se entrega primero, arriba; sin fecha de entrega, al final.
      .sort((a, b) => (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999"));
  }, [orders.records, clientById, search]);

  if (!orders.loaded) return <OfflineLoading />;
  if (!orders.meta) return <OfflineSnapshotMissing />;

  return (
    <div className="flex flex-col gap-3">
      <OfflineSnapshotNotice meta={orders.meta} />

      <OfflineSearchField
        value={search}
        onChange={setSearch}
        placeholder="Orden, folio, PO o cliente"
        label="Buscar orden"
      />

      <ul className="flex flex-col gap-2">
        {filtered.slice(0, MAX_RESULTS).map((order) => (
          <OrderRow
            key={order.id}
            order={order}
            clientName={order.clientId ? clientById.get(order.clientId)?.name : undefined}
            detail={
              <OfflineOrderDetail
                order={order}
                sizes={sizeById}
                tags={tagById}
                issues={issuesByOrder.get(order.id) ?? []}
              />
            }
          />
        ))}
        {filtered.length === 0 && (
          <li className="px-3 py-6 text-center text-sm text-muted-foreground">
            Ninguna orden abierta con esa búsqueda en la copia.
          </li>
        )}
      </ul>
    </div>
  );
}

function OrderRow({
  order,
  clientName,
  detail,
}: {
  order: OfflineOrder;
  clientName: string | undefined;
  detail: ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <li className="flat-surface">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="touch-target flex w-full items-start justify-between gap-3 p-3 text-left transition-colors hover:bg-muted"
      >
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-1.5 text-sm font-medium">
            <span className="tabular">{order.code}</span>
            <span className={cn("rounded-[4px] px-1.5 text-xs", CUTTING_ORDER_STATUS_STYLES[order.status])}>
              {CUTTING_ORDER_STATUS_LABELS[order.status]}
            </span>
          </p>
          <p className="truncate text-sm">{order.description ?? "Sin descripción"}</p>
          <p className="truncate text-xs text-muted-foreground">{clientName ?? "Sin cliente"}</p>
        </div>
        <ChevronDown className={cn("mt-1 size-4 shrink-0 transition-transform", open && "rotate-180")} aria-hidden />
      </button>

      {open && detail}
    </li>
  );
}

/** Las salidas por orden, la más reciente primero. */
function groupIssues(issues: OfflineIssue[]): Map<string, OfflineIssue[]> {
  const grouped = new Map<string, OfflineIssue[]>();
  for (const issue of issues) {
    if (!issue.cuttingOrderId) continue;
    const list = grouped.get(issue.cuttingOrderId) ?? [];
    list.push(issue);
    grouped.set(issue.cuttingOrderId, list);
  }
  for (const list of grouped.values()) list.sort((a, b) => b.date.localeCompare(a.date));
  return grouped;
}
