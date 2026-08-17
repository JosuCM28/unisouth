"use client";

import { Package } from "lucide-react";
import type { Unit } from "@prisma/client";
import { UNIT_SHORT_LABELS } from "@/lib/constants/labels";
import type { MaterialOption } from "@/lib/repositories/material.repository";
import { formatQuantity } from "@/lib/utils";

export interface TotalsRow {
  materialId: string;
  quantity: string;
  unit: Unit | "";
}

interface MaterialTotal {
  key: string;
  materialName: string;
  unitLabel: string;
  quantity: number;
  lots: number;
}

/**
 * Suma de lo capturado, agrupada por material.
 *
 * Sirve para cuadrar contra la factura ANTES de guardar: si el papel dice
 * 5,000 m de mezclilla y aquí van 4,850, falta un rollo por capturar o hay
 * un metraje mal tecleado. Descubrirlo después obliga a un reconteo.
 *
 * Se agrupa por material Y unidad: sumar metros con piezas daría un número
 * que no significa nada.
 */
export function ReceiptTotals({
  rows,
  materials,
}: {
  rows: TotalsRow[];
  materials: MaterialOption[];
}) {
  const totals = computeTotals(rows, materials);

  if (totals.length === 0) return null;

  const totalLots = totals.reduce((sum, item) => sum + item.lots, 0);

  return (
    <section className="flat-surface p-3">
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <h3 className="flex items-center gap-1.5 text-sm font-semibold">
          <Package className="size-4" aria-hidden />
          Va entrando
        </h3>
        <span className="tabular text-xs text-muted-foreground">
          {totalLots} {totalLots === 1 ? "rollo" : "rollos"}
        </span>
      </div>

      <ul className="divide-y divide-border">
        {totals.map((total) => (
          <li
            key={total.key}
            className="flex items-baseline justify-between gap-3 py-2"
          >
            <div className="min-w-0">
              <p className="truncate text-sm">{total.materialName}</p>
              <p className="tabular text-xs text-muted-foreground">
                {total.lots} {total.lots === 1 ? "rollo" : "rollos"}
              </p>
            </div>

            {/* El total va grande: es el número que se compara con la
                factura, de pie y con el papel en la otra mano. */}
            <span className="tabular shrink-0 text-lg font-semibold">
              {formatQuantity(total.quantity, { unit: total.unitLabel })}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * Agrupa y suma.
 *
 * Se ignoran las filas sin material o sin cantidad: mostrar un renglón a
 * medio capturar como si ya contara daría un total falso.
 */
function computeTotals(
  rows: TotalsRow[],
  materials: MaterialOption[],
): MaterialTotal[] {
  const grouped = new Map<string, MaterialTotal>();

  for (const row of rows) {
    if (!row.materialId) continue;

    const quantity = parseQuantity(row.quantity);
    if (quantity === null || quantity <= 0) continue;

    // La clave incluye la unidad: un material capturado en metros y en
    // piezas son dos totales distintos, no uno mezclado.
    const key = `${row.materialId}:${row.unit}`;
    const existing = grouped.get(key);

    if (existing) {
      existing.quantity = round4(existing.quantity + quantity);
      existing.lots += 1;
      continue;
    }

    const material = materials.find((item) => item.id === row.materialId);

    grouped.set(key, {
      key,
      materialName: material?.name ?? "Material desconocido",
      unitLabel: row.unit ? UNIT_SHORT_LABELS[row.unit] : "",
      quantity,
      lots: 1,
    });
  }

  // Mayor primero: el material del que más llega es el que se revisa antes.
  return [...grouped.values()].sort((a, b) => b.quantity - a.quantity);
}

/** Acepta coma decimal: así se escribe en México. */
function parseQuantity(value: string): number | null {
  const trimmed = value.trim().replace(",", ".");
  if (!trimmed) return null;

  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

function round4(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}
