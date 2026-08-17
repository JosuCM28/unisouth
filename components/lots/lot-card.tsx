import Link from "next/link";
import { MapPin, Palette, User } from "lucide-react";
import type { Lot, LotStatus, Material, Unit } from "@prisma/client";
import { LOT_STATUS_LABELS, LOT_STATUS_STYLES, UNIT_SHORT_LABELS } from "@/lib/constants/labels";
import { cn, formatQuantity } from "@/lib/utils";

export interface LotCardData extends Lot {
  material: Pick<Material, "id" | "code" | "name"> & { baseUnit?: Unit };
  location: { code: string; name: string } | null;
  client: { name: string } | null;
}

/**
 * Tarjeta de rollo para celular.
 *
 * El orden de prominencia es el orden en que el auxiliar los busca teniendo
 * el rollo en la mano: primero el folio —que es lo que compara con la
 * etiqueta—, luego qué material es, y a la derecha el metraje, que es el
 * dato por el que abre la app.
 *
 * Toda la tarjeta es un enlace: con guantes no se atina a un botón chico.
 */
export function LotCard({ lot }: { lot: LotCardData }) {
  const unit = UNIT_SHORT_LABELS[lot.unit];
  const available = Number(lot.currentQuantity) - Number(lot.reservedQuantity);
  const hasReserved = Number(lot.reservedQuantity) > 0;

  return (
    <Link
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

        {/* La cantidad va grande y a la derecha: es el dato que se consulta
            de un vistazo, sin acercarse el teléfono a la cara. */}
        <div className="shrink-0 text-right">
          <p className="tabular text-xl font-semibold leading-none">
            {formatQuantity(lot.currentQuantity)}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">{unit}</p>
          {hasReserved && (
            <p className="tabular mt-1 text-xs text-state-reserved">
              {formatQuantity(available)} libre
            </p>
          )}
        </div>
      </div>

      <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
        <StatusChip status={lot.status} />

        {lot.location && (
          <Chip icon={MapPin} label={lot.location.code} tabular />
        )}
        {lot.shade && <Chip icon={Palette} label={lot.shade} tabular />}
        {lot.client && <Chip icon={User} label={lot.client.name} />}

        {!lot.verified && (
          <span className="rounded border border-border px-1.5 py-0.5 text-xs text-muted-foreground">
            Sin medir
          </span>
        )}
      </div>
    </Link>
  );
}

export function StatusChip({ status }: { status: LotStatus }) {
  return (
    <span
      className={cn(
        "rounded px-1.5 py-0.5 text-xs font-medium",
        LOT_STATUS_STYLES[status],
      )}
    >
      {LOT_STATUS_LABELS[status]}
    </span>
  );
}

function Chip({
  icon: Icon,
  label,
  tabular,
}: {
  icon: typeof MapPin;
  label: string;
  tabular?: boolean;
}) {
  return (
    <span className="flex items-center gap-1 rounded border border-border px-1.5 py-0.5 text-xs text-muted-foreground">
      <Icon className="size-3 shrink-0" aria-hidden />
      <span className={cn("truncate", tabular && "tabular")}>{label}</span>
    </span>
  );
}
