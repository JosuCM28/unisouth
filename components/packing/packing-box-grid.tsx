import Link from "next/link";
import { Package } from "lucide-react";
import type { PackingBoxRow } from "@/lib/repositories/packing.repository";
import { formatQuantity } from "@/lib/utils";
import { EmptyState } from "@/components/shared/empty-state";
import { RemoveBoxButton } from "./packing-box-buttons";
import { sumPieces } from "./packing-status-badge";

/** Lo que lleva una caja en una línea: "M 4565 ×20 · G 4565 ×15". */
function boxSummary(box: PackingBoxRow): string {
  return box.lines
    .map((line) => `${line.stock.size.code} ${line.stock.clientPo ?? "Sin PO"} ×${line.quantity}`)
    .join(" · ");
}

/** Las cajas del pedido. Toda la tarjeta entra a llenarla. */
export function PackingBoxGrid({
  orderId,
  boxes,
  canEdit,
}: {
  orderId: string;
  boxes: PackingBoxRow[];
  /** Abierto y con `packing:write`: se pueden quitar las vacías. */
  canEdit: boolean;
}) {
  if (boxes.length === 0) {
    return (
      <div className="flat-surface">
        <EmptyState icon={Package} title="Sin cajas" description="Dale a Nueva caja y empieza a llenarla." />
      </div>
    );
  }

  return (
    <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
      {boxes.map((box) => {
        const pieces = sumPieces(box.lines);
        return (
          <li key={box.id} className="flat-surface relative flex items-start justify-between gap-2 p-3 transition-colors hover:bg-muted">
            <Link href={`/packing/${orderId}/cajas/${box.number}`} className="absolute inset-0 z-10"
              aria-label={`Abrir caja ${box.number}`} />
            <div className="min-w-0">
              <p className="tabular text-sm font-medium">Caja {box.number}</p>
              <p className="tabular text-xs text-muted-foreground">{formatQuantity(pieces)} pzas</p>
              {box.lines.length > 0 && <p className="tabular mt-1 break-words text-xs">{boxSummary(box)}</p>}
            </div>
            {canEdit && pieces === 0 && <RemoveBoxButton boxId={box.id} number={box.number} />}
          </li>
        );
      })}
    </ul>
  );
}
