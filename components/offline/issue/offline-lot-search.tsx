"use client";

import { useMemo, useState } from "react";
import { Plus, Search } from "lucide-react";
import { UNIT_SHORT_LABELS } from "@/lib/constants/labels";
import { estimatedAvailable } from "@/lib/offline/local-stock";
import type {
  OfflineLocation,
  OfflineLot,
  OfflineMaterial,
} from "@/lib/offline/snapshot.types";
import { formatQuantity } from "@/lib/utils";
import { Input } from "@/components/ui/input";

/**
 * Tope de resultados en pantalla. Un cliente puede tener cientos de rollos;
 * pintarlos todos en un celular sin señal es lento y nadie los recorre: se
 * escribe el folio o la tela y se afina.
 */
const MAX_RESULTS = 30;

interface OfflineLotSearchProps {
  lots: OfflineLot[];
  materials: Map<string, OfflineMaterial>;
  locations: Map<string, OfflineLocation>;
  pendingByLot: Map<string, number>;
  /** Rollos que ya están en la salida: no se ofrecen dos veces. */
  selectedIds: Set<string>;
  onAdd: (lot: OfflineLot) => void;
}

/**
 * Buscador de rollos sobre la copia local.
 *
 * Busca por folio, tela y tono. El folio también llega de una pistola
 * lectora, que "teclea" el contenido del QR: por eso se acepta la URL
 * completa del QR y se recorta al folio.
 */
export function OfflineLotSearch(props: OfflineLotSearchProps) {
  const [search, setSearch] = useState("");
  const results = useMatchingLots(props, search);

  return (
    <div className="flex flex-col gap-2">
      <div className="relative">
        <Search
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <Input
          inputMode="search"
          placeholder="Folio, tela o tono"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className="touch-target pl-9"
          aria-label="Buscar rollo"
        />
      </div>

      <ul className="flat-surface divide-y divide-border">
        {results.map((lot) => (
          <LotOption key={lot.id} lot={lot} {...props} />
        ))}

        {results.length === 0 && (
          <li className="px-3 py-6 text-center text-sm text-muted-foreground">
            No hay rollos de este cliente con esa búsqueda en la copia.
          </li>
        )}
      </ul>
    </div>
  );
}

function useMatchingLots(
  { lots, materials, selectedIds }: OfflineLotSearchProps,
  search: string,
): OfflineLot[] {
  return useMemo(() => {
    const term = normalizeTerm(search);

    return lots
      .filter((lot) => !selectedIds.has(lot.id))
      .filter((lot) => !term || haystack(lot, materials).includes(term))
      .slice(0, MAX_RESULTS);
  }, [lots, materials, selectedIds, search]);
}

/** Lo que escupe la pistola es la URL del QR: se queda sólo el folio. */
function normalizeTerm(raw: string): string {
  const fromQr = raw.match(/\/r\/([^/?#]+)/i);
  return (fromQr?.[1] ?? raw).trim().toUpperCase();
}

function haystack(lot: OfflineLot, materials: Map<string, OfflineMaterial>): string {
  const material = materials.get(lot.materialId);
  return [lot.code, material?.code, material?.name, lot.shade]
    .filter(Boolean)
    .join(" ")
    .toUpperCase();
}

function LotOption({
  lot,
  materials,
  locations,
  pendingByLot,
  onAdd,
}: OfflineLotSearchProps & { lot: OfflineLot }) {
  const material = materials.get(lot.materialId);
  const location = lot.locationId ? locations.get(lot.locationId) : undefined;
  const available = estimatedAvailable(lot, pendingByLot);
  const exhausted = available <= 0;

  return (
    <li>
      <button
        type="button"
        disabled={exhausted}
        onClick={() => onAdd(lot)}
        className="touch-target flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left transition-colors hover:bg-muted disabled:opacity-50"
      >
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-sm font-medium">
            <span className="tabular">{lot.code}</span>
            {lot.isRemnant && (
              <span className="rounded-[4px] bg-state-remnant px-1.5 text-xs text-state-remnant-foreground">
                Retazo
              </span>
            )}
          </p>
          <p className="truncate text-xs text-muted-foreground">
            {[material?.name, lot.shade && `Tono ${lot.shade}`, location?.code]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>

        <span className="tabular flex shrink-0 items-center gap-1 text-sm">
          {formatQuantity(available, { unit: UNIT_SHORT_LABELS[lot.unit] })}
          {!exhausted && <Plus className="size-4" aria-hidden />}
        </span>
      </button>
    </li>
  );
}
