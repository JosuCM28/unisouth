"use client";

import { DOCUMENT_STATUS_LABELS } from "@/lib/constants/labels";
import type {
  OfflineCutTag,
  OfflineIssue,
  OfflineOrder,
  OfflineSize,
} from "@/lib/offline/snapshot.types";
import { formatDate, formatQuantity } from "@/lib/utils";

interface Props {
  order: OfflineOrder;
  sizes: Map<string, OfflineSize>;
  tags: Map<string, OfflineCutTag>;
  /** Las salidas de esta orden que vienen en la copia. */
  issues: OfflineIssue[];
}

/** Lo que se consulta de una orden en el piso: tallas, avance y sus salidas. */
export function OfflineOrderDetail({ order, sizes, tags, issues }: Props) {
  const lines = [...order.lines].sort((a, b) => a.position - b.position);
  const ordered = lines.reduce((total, line) => total + line.orderedQuantity, 0);
  const cut = lines.reduce((total, line) => total + line.cutQuantity, 0);

  return (
    <div className="flex flex-col gap-3 border-t border-border p-3 text-sm">
      <dl className="grid grid-cols-2 gap-x-3 gap-y-2">
        <Field label="Folio de orden" value={order.reference} />
        <Field label="PO cliente" value={order.clientPo} />
        <Field label="Pedido" value={formatDate(order.orderedAt)} />
        <Field label="Entrega" value={order.dueDate ? formatDate(order.dueDate) : null} />
      </dl>

      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-xs text-muted-foreground">
            <th className="py-1 text-left font-normal">Talla</th>
            <th className="py-1 text-left font-normal">Folio</th>
            <th className="py-1 text-right font-normal">Pedido</th>
            <th className="py-1 text-right font-normal">Cortado</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((line) => (
            <tr key={line.id} className="border-b border-border last:border-0">
              <td className="tabular py-1">{sizes.get(line.sizeId)?.code ?? "—"}</td>
              <td className="py-1">{line.tagId ? tags.get(line.tagId)?.name : ""}</td>
              <td className="tabular py-1 text-right">{formatQuantity(line.orderedQuantity)}</td>
              <td className="tabular py-1 text-right">{formatQuantity(line.cutQuantity)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="font-medium">
            <td className="py-1" colSpan={2}>Total</td>
            <td className="tabular py-1 text-right">{formatQuantity(ordered)}</td>
            <td className="tabular py-1 text-right">{formatQuantity(cut)}</td>
          </tr>
        </tfoot>
      </table>

      <IssueList issues={issues} />
    </div>
  );
}

function IssueList({ issues }: { issues: OfflineIssue[] }) {
  if (issues.length === 0) {
    return <p className="text-xs text-muted-foreground">Sin salidas recientes en la copia.</p>;
  }

  return (
    <div className="flex flex-col gap-1">
      <p className="text-xs text-muted-foreground">Salidas</p>
      <ul className="flex flex-col gap-1">
        {issues.map((issue) => (
          <li key={issue.id} className="flex justify-between gap-3">
            <span className="tabular">{issue.code}</span>
            <span className="text-xs text-muted-foreground">
              {formatDate(issue.date)} · {DOCUMENT_STATUS_LABELS[issue.status]}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;

  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="tabular truncate">{value}</dd>
    </div>
  );
}
