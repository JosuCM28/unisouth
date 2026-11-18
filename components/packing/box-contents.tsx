"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PackageOpen, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { unpackAction } from "@/app/actions/packing.actions";
import { runAction } from "@/lib/offline/run-action";
import type { PackingBoxLineRow } from "@/lib/repositories/packing.repository";
import { formatQuantity } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { sumPieces } from "./packing-status-badge";

/**
 * Lo que ya lleva la caja. Con permiso y el pedido abierto, cada renglón se
 * puede regresar al inventario completo o en parte.
 */
export function BoxContents({
  boxId,
  lines,
  canEdit,
}: {
  boxId: string;
  lines: PackingBoxLineRow[];
  canEdit: boolean;
}) {
  if (lines.length === 0) {
    return (
      <div className="flat-surface flex items-center gap-3 p-4">
        <PackageOpen className="size-5 shrink-0 text-muted-foreground" aria-hidden />
        <p className="text-sm text-muted-foreground">
          {canEdit ? "La caja está vacía. Agrega prenda del inventario de abajo." : "La caja está vacía."}
        </p>
      </div>
    );
  }

  const sorted = [...lines].sort(
    (a, b) => a.stock.product.name.localeCompare(b.stock.product.name) || a.stock.size.order - b.stock.size.order,
  );

  return (
    <section className="flat-surface flex flex-col">
      <div className="flex items-center justify-between border-b border-border bg-muted px-3 py-2">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">En la caja</h2>
        <span className="tabular text-sm font-semibold">{formatQuantity(sumPieces(lines))} pzas</span>
      </div>
      <ul>
        {sorted.map((line) => (
          <li key={line.id} className="flex items-center justify-between gap-3 border-b border-border p-3 last:border-0">
            <span className="tabular flex size-11 shrink-0 items-center justify-center border border-border text-sm font-semibold">
              {line.stock.size.code}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{line.stock.product.name}</p>
              {/* En un pedido sin cliente cada renglón puede ser de otra empresa. */}
              <p className="tabular truncate text-xs text-muted-foreground">
                {line.stock.clientPo ?? "Sin PO"} · {line.stock.client?.name ?? "Sin cliente"}
              </p>
            </div>
            <span className="tabular shrink-0 text-base font-semibold">{formatQuantity(line.quantity)}</span>
            {canEdit && (
              <UnpackControl key={`${line.id}-${line.quantity}`} boxId={boxId} stockId={line.stock.id} max={line.quantity} />
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

function UnpackControl({ boxId, stockId, max }: { boxId: string; stockId: string; max: number }) {
  const router = useRouter();
  const [quantity, setQuantity] = useState(String(max));
  const [saving, setSaving] = useState(false);

  async function handleClick() {
    setSaving(true);
    const result = await runAction(() => unpackAction({ boxId, stockId, quantity }));
    setSaving(false);
    if (!result.success) {
      toast.error(result.error);
      return;
    }
    router.refresh();
  }

  return (
    <div className="flex shrink-0 items-center gap-1">
      <Input inputMode="numeric" aria-label="Piezas a sacar" value={quantity}
        onChange={(event) => setQuantity(event.target.value)} className="tabular touch-target w-16" />
      <Button variant="outline" size="icon" className="touch-target" disabled={saving}
        aria-label="Regresar al inventario" onClick={handleClick}>
        <Undo2 className="size-4" aria-hidden />
      </Button>
    </div>
  );
}
