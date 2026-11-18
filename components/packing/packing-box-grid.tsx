import Link from "next/link";
import { ChevronRight, Package } from "lucide-react";
import type { PackingBoxRow } from "@/lib/repositories/packing.repository";
import { formatQuantity } from "@/lib/utils";
import { EmptyState } from "@/components/shared/empty-state";
import { RemoveBoxButton } from "./packing-box-buttons";
import { sumPieces } from "./packing-status-badge";

/** Lo que lleva una caja, una prenda por renglón: talla, PO y piezas. */
function boxLines(box: PackingBoxRow) {
  return [...box.lines].sort((a, b) => a.stock.size.order - b.stock.size.order);
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
        <EmptyState icon={Package} title="Sin cajas"
          description={canEdit ? "Dale a Nueva caja y empieza a llenarla." : "Este pedido no tiene cajas."} />
      </div>
    );
  }

  return (
    <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
      {boxes.map((box) => (
        <BoxCard key={box.id} orderId={orderId} box={box} canEdit={canEdit} />
      ))}
    </ul>
  );
}

function BoxCard({ orderId, box, canEdit }: { orderId: string; box: PackingBoxRow; canEdit: boolean }) {
  const pieces = sumPieces(box.lines);
  const lines = boxLines(box);

  return (
    <li className="flat-surface group relative flex flex-col transition-colors hover:bg-muted">
      <Link href={`/packing/${orderId}/cajas/${box.number}`} className="absolute inset-0 z-10"
        aria-label={`Abrir caja ${box.number}`} />
      <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2">
        <div className="flex items-baseline gap-2">
          <span className="text-xs uppercase tracking-wide text-muted-foreground">Caja</span>
          <span className="tabular text-2xl font-semibold leading-none">{box.number}</span>
        </div>
        <div className="flex items-center gap-1">
          <PiecesTag pieces={pieces} />
          {canEdit && pieces === 0 && <RemoveBoxButton boxId={box.id} number={box.number} />}
          <ChevronRight className="size-4 text-muted-foreground" aria-hidden />
        </div>
      </div>
      {lines.length > 0 ? (
        <ul className="flex flex-col px-3 py-2 text-xs">
          {lines.map((line) => (
            <li key={line.id} className="tabular flex items-center justify-between gap-2 py-0.5">
              <span className="min-w-0 truncate">
                <span className="font-medium">{line.stock.size.code}</span>
                <span className="text-muted-foreground"> · {line.stock.clientPo ?? "Sin PO"} · {line.stock.product.name}</span>
              </span>
              <span className="shrink-0 font-medium">{formatQuantity(line.quantity)}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="px-3 py-3 text-xs text-muted-foreground">{canEdit ? "Toca para llenarla" : "Sin prenda"}</p>
      )}
    </li>
  );
}

function PiecesTag({ pieces }: { pieces: number }) {
  if (pieces === 0) {
    return <span className="border border-border px-1.5 py-0.5 text-xs text-muted-foreground">Vacía</span>;
  }
  return <span className="tabular text-sm font-semibold">{formatQuantity(pieces)} pzas</span>;
}
