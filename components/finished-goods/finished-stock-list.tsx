import type { ReactNode } from "react";
import type { FinishedStockRow } from "@/lib/repositories/finished-goods.repository";
import { formatQuantity } from "@/lib/utils";

export const NO_PO_LABEL = "Sin PO";
export const NO_CATEGORY_LABEL = "Sin tipo";

interface ProductGroup {
  productId: string;
  name: string;
  code: string;
  category: string;
  total: number;
  rows: FinishedStockRow[];
}

/**
 * El inventario agrupado por producto, con un renglón por talla, cliente y
 * PO. Tarjetas que se leen igual en el celular que en el escritorio: la
 * tabla de cuatro columnas cabe en ambos sin scroll de lado.
 *
 * Las acciones de cada renglón llegan por `renderActions` porque dependen
 * de la llave de quien mira (ajustar sólo si puede).
 */
export function FinishedStockList({
  rows,
  renderActions,
}: {
  rows: FinishedStockRow[];
  renderActions: (row: FinishedStockRow) => ReactNode;
}) {
  return (
    <ul className="flex flex-col gap-3">
      {groupByProduct(rows).map((group) => (
        <li key={group.productId} className="flat-surface flex flex-col">
          <div className="flex items-start justify-between gap-3 border-b border-border p-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{group.name}</p>
              <p className="tabular text-xs text-muted-foreground">{group.category} · {group.code}</p>
            </div>
            <p className="tabular shrink-0 text-sm font-medium">{formatQuantity(group.total)} pzas</p>
          </div>

          <div className="grid grid-cols-[3rem_1fr_auto_auto] items-center gap-x-3 px-3 py-1 text-xs text-muted-foreground">
            <span>Talla</span>
            <span>PO · cliente</span>
            <span className="text-right">Pzas</span>
            <span className="sr-only">Acciones</span>
          </div>
          <ul>
            {group.rows.map((row) => (
              <li key={row.id}
                className="grid grid-cols-[3rem_1fr_auto_auto] items-center gap-x-3 border-t border-border px-3 py-1">
                <span className="tabular text-sm font-medium">{row.size.code}</span>
                <span className="min-w-0">
                  <span className="tabular block truncate text-sm">{row.clientPo ?? NO_PO_LABEL}</span>
                  <span className="block truncate text-xs text-muted-foreground">{row.client?.name ?? "Sin cliente"}</span>
                </span>
                <span className="tabular text-right text-sm">{formatQuantity(row.quantity)}</span>
                <span className="flex gap-1">{renderActions(row)}</span>
              </li>
            ))}
          </ul>
        </li>
      ))}
    </ul>
  );
}

function groupByProduct(rows: FinishedStockRow[]): ProductGroup[] {
  const groups = new Map<string, ProductGroup>();
  for (const row of rows) {
    const group = groups.get(row.product.id) ?? {
      productId: row.product.id,
      name: row.product.name,
      code: row.product.code,
      category: row.product.garmentCategory?.name ?? NO_CATEGORY_LABEL,
      total: 0,
      rows: [],
    };
    group.total += row.quantity;
    group.rows.push(row);
    groups.set(row.product.id, group);
  }
  return [...groups.values()];
}
