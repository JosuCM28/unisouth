"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import {
  LOT_STATUS_LABELS,
  LOT_STATUS_STYLES,
  UNIT_SHORT_LABELS,
} from "@/lib/constants/labels";
import type {
  OfflineClient,
  OfflineLocation,
  OfflineLot,
  OfflineMaterial,
} from "@/lib/offline/snapshot.types";
import { cn, formatDate, formatQuantity } from "@/lib/utils";

export interface LotCatalogs {
  materials: Map<string, OfflineMaterial>;
  locations: Map<string, OfflineLocation>;
  clients: Map<string, OfflineClient>;
}

interface Props extends LotCatalogs {
  lot: OfflineLot;
  /** Lo capturado sin señal que todavía no sube, ya restado del saldo. */
  pending: number;
}

/**
 * Un rollo de la copia. Se despliega en sitio en vez de abrir su ficha:
 * sin red no hay a dónde navegar, y lo que se consulta en el piso cabe aquí.
 */
export function OfflineLotCard({ lot, pending, materials, locations, clients }: Props) {
  const [open, setOpen] = useState(false);
  const material = materials.get(lot.materialId);
  const location = lot.locationId ? locations.get(lot.locationId) : undefined;
  const unit = UNIT_SHORT_LABELS[lot.unit];
  const available = lot.currentQuantity - lot.reservedQuantity - pending;

  return (
    <li className="flat-surface">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="touch-target flex w-full items-start justify-between gap-3 p-3 text-left transition-colors hover:bg-muted"
      >
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-1.5 text-sm font-medium">
            <span className="tabular">{lot.code}</span>
            <span className={cn("rounded-[4px] px-1.5 text-xs", LOT_STATUS_STYLES[lot.status])}>
              {LOT_STATUS_LABELS[lot.status]}
            </span>
          </p>
          <p className="truncate text-sm">{material?.name ?? "Material desconocido"}</p>
          <p className="truncate text-xs text-muted-foreground">
            {[lot.shade && `Tono ${lot.shade}`, location?.code, ownerName(lot, clients)]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>

        <span className="flex shrink-0 items-center gap-1">
          <span className="tabular text-sm font-semibold">
            {formatQuantity(lot.currentQuantity, { unit })}
          </span>
          <ChevronDown
            className={cn("size-4 transition-transform", open && "rotate-180")}
            aria-hidden
          />
        </span>
      </button>

      {open && (
        <dl className="grid grid-cols-2 gap-x-3 gap-y-2 border-t border-border p-3 text-sm">
          <Detail label="Disponible" value={formatQuantity(available, { unit })} tabular />
          <Detail label="Reservado" value={formatQuantity(lot.reservedQuantity, { unit })} tabular />
          {pending > 0 && (
            <Detail label="Por subir" value={formatQuantity(pending, { unit })} tabular />
          )}
          <Detail label="Material" value={material?.code} tabular />
          <Detail label="Ubicación" value={location ? `${location.code} · ${location.name}` : null} />
          <Detail label="Lote proveedor" value={lot.supplierLotNumber} tabular />
          <Detail label="Recibido" value={formatDate(lot.receivedAt)} tabular />
          <Detail label="Bloqueado" value={lot.isBlocked ? "Sí" : null} />
        </dl>
      )}
    </li>
  );
}

function ownerName(lot: OfflineLot, clients: Map<string, OfflineClient>): string {
  if (!lot.clientId) return "De la fábrica";
  return clients.get(lot.clientId)?.name ?? "Cliente";
}

function Detail({
  label,
  value,
  tabular,
}: {
  label: string;
  value: string | null | undefined;
  tabular?: boolean;
}) {
  if (!value) return null;

  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className={cn("truncate", tabular && "tabular")}>{value}</dd>
    </div>
  );
}
