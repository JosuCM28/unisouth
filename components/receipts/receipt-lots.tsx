import Link from "next/link";
import { Boxes, MapPin, Palette } from "lucide-react";
import type { LotStatus, Unit } from "@prisma/client";
import { UNIT_SHORT_LABELS } from "@/lib/constants/labels";
import { formatQuantity } from "@/lib/utils";
import { StatusChip } from "@/components/lots/lot-card";
import { EmptyState } from "@/components/shared/empty-state";

/** Lo que esta vista necesita de cada rollo. */
export interface ReceiptLotRow {
  id: string;
  code: string;
  unit: Unit;
  status: LotStatus;
  currentQuantity: number;
  initialQuantity: number;
  shade: string | null;
  supplierLotNumber: string | null;
  colorText: string | null;
  material: { name: string; code: string };
  location: { code: string } | null;
  helper: { name: string } | null;
}

/**
 * Los rollos que trajo una recepción.
 *
 * Se muestran `initialQuantity` y `currentQuantity` juntos a propósito: la
 * pregunta "¿qué llegó ese día?" se contesta con lo que ENTRÓ, pero quien
 * abre la pantalla casi siempre quiere saber también qué queda de aquello.
 */
export function ReceiptLots({ lots }: { lots: ReceiptLotRow[] }) {
  if (lots.length === 0) {
    return (
      <div className="flat-surface">
        <EmptyState
          icon={Boxes}
          title="Sin rollos"
          description="Esta recepción no tiene rollos capturados."
        />
      </div>
    );
  }

  const totalsByUnit = sumByUnit(lots);

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide">
          Rollos recibidos
        </h2>
        <p className="tabular text-sm text-muted-foreground">
          {lots.length} {lots.length === 1 ? "rollo" : "rollos"}
          {totalsByUnit.length > 0 && ` · ${totalsByUnit.join(" · ")}`}
        </p>
      </div>

      <div className="flex flex-col gap-2">
        {lots.map((lot) => (
          <Link
            key={lot.id}
            href={`/lots/${lot.code}`}
            className="flat-surface block p-3 transition-colors active:bg-accent"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="tabular text-base font-semibold leading-tight">
                  {lot.code}
                </p>
                <p className="mt-0.5 truncate text-sm">{lot.material.name}</p>
                {lot.colorText && (
                  <p className="truncate text-xs text-muted-foreground">
                    {lot.colorText}
                  </p>
                )}
              </div>

              <div className="shrink-0 text-right">
                <p className="tabular text-xl font-semibold leading-none">
                  {formatQuantity(lot.initialQuantity)}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {UNIT_SHORT_LABELS[lot.unit]} recibidos
                </p>
                {/* Sólo si ya se consumió algo: si nadie lo ha tocado, decir
                    "quedan 300 de 300" es ruido. */}
                {lot.currentQuantity !== lot.initialQuantity && (
                  <p className="tabular mt-1 text-xs text-muted-foreground">
                    quedan {formatQuantity(lot.currentQuantity)}
                  </p>
                )}
              </div>
            </div>

            <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
              <StatusChip status={lot.status} />
              {lot.location && <Chip icon={MapPin} label={lot.location.code} />}
              {lot.shade && <Chip icon={Palette} label={lot.shade} />}
              {lot.supplierLotNumber && (
                <span className="rounded border border-border px-1.5 py-0.5 text-xs text-muted-foreground">
                  <span className="tabular">{lot.supplierLotNumber}</span>
                </span>
              )}
              {lot.helper && (
                <span className="rounded border border-border px-1.5 py-0.5 text-xs text-muted-foreground">
                  Bajó {lot.helper.name}
                </span>
              )}
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}

function Chip({
  icon: Icon,
  label,
}: {
  icon: typeof MapPin;
  label: string;
}) {
  return (
    <span className="flex items-center gap-1 rounded border border-border px-1.5 py-0.5 text-xs text-muted-foreground">
      <Icon className="size-3 shrink-0" aria-hidden />
      <span className="tabular truncate">{label}</span>
    </span>
  );
}

/**
 * Totales por unidad.
 *
 * Se separan por unidad y no se suman en un solo número porque mezclar
 * metros con piezas da una cifra que no significa nada: 300 m de tela más
 * 400 cierres no son 700 de algo.
 */
function sumByUnit(lots: ReceiptLotRow[]): string[] {
  const totals = new Map<Unit, number>();

  for (const lot of lots) {
    totals.set(lot.unit, (totals.get(lot.unit) ?? 0) + lot.initialQuantity);
  }

  return [...totals.entries()].map(([unit, total]) =>
    formatQuantity(total, { unit: UNIT_SHORT_LABELS[unit] }),
  );
}
