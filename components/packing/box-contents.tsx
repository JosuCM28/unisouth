"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Undo2 } from "lucide-react";
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
    return <p className="flat-surface p-3 text-sm text-muted-foreground">La caja está vacía. Agrega prenda de abajo.</p>;
  }

  const sorted = [...lines].sort(
    (a, b) => a.stock.product.name.localeCompare(b.stock.product.name) || a.stock.size.order - b.stock.size.order,
  );

  return (
    <section className="flat-surface flex flex-col">
      <h2 className="tabular border-b border-border p-3 text-sm font-semibold">
        En la caja · {formatQuantity(sumPieces(lines))} pzas
      </h2>
      <ul>
        {sorted.map((line) => (
          <li key={line.id} className="flex items-center justify-between gap-3 border-b border-border p-3 last:border-0">
            <div className="min-w-0">
              <p className="truncate text-sm">{line.stock.product.name}</p>
              <p className="tabular text-xs text-muted-foreground">
                {line.stock.size.code} · {line.stock.clientPo ?? "Sin PO"}
              </p>
            </div>
            <span className="tabular shrink-0 text-sm font-medium">{formatQuantity(line.quantity)}</span>
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
