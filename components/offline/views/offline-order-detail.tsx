"use client";

import { DOCUMENT_STATUS_LABELS } from "@/lib/constants/labels";
import type { PendingOrderCaptures } from "@/lib/offline/pending-orders";
import type {
  OfflineCutTag,
  OfflineIssue,
  OfflineOrder,
  OfflineSize,
  OfflineStage,
  OfflineWorkshop,
} from "@/lib/offline/snapshot.types";
import { formatDate, formatQuantity } from "@/lib/utils";
import { OfflineCutDialog } from "@/components/offline/orders/offline-cut-dialog";
import { OfflineOrderIssueDialog } from "@/components/offline/orders/offline-order-issue-dialog";
import { OfflinePendingCaptures } from "@/components/offline/orders/offline-pending-captures";
import { OfflineShipmentDialog } from "@/components/offline/orders/offline-shipment-dialog";

/** Qué botones de captura se le pintan a quien abre la ficha. */
export interface OfflineOrderAbilities {
  /** `cuts:write`: capturar corte. */
  canCut: boolean;
  /** `inventory:write`: mandar a taller y sacar tela. */
  canWrite: boolean;
}

interface Props {
  order: OfflineOrder;
  sizes: Map<string, OfflineSize>;
  tags: Map<string, OfflineCutTag>;
  workshops: OfflineWorkshop[];
  stages: OfflineStage[];
  /** Las salidas de esta orden que vienen en la copia. */
  issues: OfflineIssue[];
  /** Lo que este celular capturó de la orden y todavía no sube. */
  pending: PendingOrderCaptures;
  abilities: OfflineOrderAbilities;
}

/**
 * La ficha de la orden en el piso, sin señal: tallas, avance, salidas y las
 * tres capturas del día —corte, envío a taller y salida de tela—.
 */
export function OfflineOrderDetail(props: Props) {
  const { order, sizes, tags, issues, pending } = props;
  const lines = [...order.lines].sort((a, b) => a.position - b.position);
  const ordered = lines.reduce((total, line) => total + line.orderedQuantity, 0);
  const cut = lines.reduce((total, line) => total + line.cutQuantity, 0);
  const pendingCut = lines.reduce((total, line) => total + (pending.cutByLine.get(line.id) ?? 0), 0);

  return (
    <div className="flex flex-col gap-3 border-t border-border p-3 text-sm">
      <CaptureButtons {...props} />

      <OfflinePendingCaptures items={pending.items} />

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
              <td className="tabular py-1 text-right">
                <CutCell cut={line.cutQuantity} pending={pending.cutByLine.get(line.id) ?? 0} />
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="font-medium">
            <td className="py-1" colSpan={2}>Total</td>
            <td className="tabular py-1 text-right">{formatQuantity(ordered)}</td>
            <td className="tabular py-1 text-right">
              <CutCell cut={cut} pending={pendingCut} />
            </td>
          </tr>
        </tfoot>
      </table>

      <IssueList issues={issues} />
    </div>
  );
}

/**
 * Los botones, según la llave de cada uno: la misma que exige el servidor al
 * subir. Esconderlos es comodidad; la barrera sigue siendo `executeAction`.
 */
function CaptureButtons({ order, sizes, tags, workshops, stages, pending, abilities }: Props) {
  if (!abilities.canCut && !abilities.canWrite) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {abilities.canCut && (
        <OfflineCutDialog order={order} sizes={sizes} tags={tags} pendingCut={pending.cutByLine} />
      )}
      {abilities.canWrite && (
        <>
          <OfflineShipmentDialog
            order={order}
            sizes={sizes}
            tags={tags}
            workshops={workshops}
            stages={stages}
            pendingCut={pending.cutByLine}
            pendingSent={pending.sentBySizeStage}
          />
          <OfflineOrderIssueDialog order={order} />
        </>
      )}
    </div>
  );
}

/**
 * Lo cortado de la copia y, aparte, lo que falta subir. Separado y no sumado
 * en silencio: el número de la copia es el del servidor; el "+40" es de este
 * celular y todavía puede rebotar.
 */
function CutCell({ cut, pending }: { cut: number; pending: number }) {
  if (pending === 0) return <>{formatQuantity(cut)}</>;

  return (
    <>
      {formatQuantity(cut)}{" "}
      <span className="text-xs text-muted-foreground">+{formatQuantity(pending)} por subir</span>
    </>
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
