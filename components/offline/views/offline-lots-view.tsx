"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { OfflineLot } from "@/lib/offline/snapshot.types";
import { pendingIssuedByLot } from "@/lib/offline/local-stock";
import { byId, useOfflineTable } from "@/hooks/use-offline-table";
import { useOfflineQueue } from "@/hooks/use-offline-queue";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { OfflineLotCard, type LotCatalogs } from "./offline-lot-card";
import { MAX_RESULTS, matches, normalizeTerm, OfflineSearchField } from "./offline-search-field";
import {
  OfflineLoading, OfflineSnapshotMissing, OfflineSnapshotNotice,
} from "./offline-snapshot-notice";

const ALL_OWNERS = "__all__";
const FACTORY = "__factory__";

/**
 * Inventario rollo por rollo, leído de la copia del equipo.
 *
 * `?material=` llega desde Materiales sin conexión: así "ver los rollos de
 * esta tela" no necesita su propia pantalla.
 */
export function OfflineLotsView() {
  const lots = useOfflineTable("lots");
  const catalogs = useLotCatalogs();
  const { items } = useOfflineQueue();
  const pendingByLot = useMemo(() => pendingIssuedByLot(items), [items]);

  const materialId = useSearchParams().get("material") ?? "";
  const [search, setSearch] = useState("");
  const [owner, setOwner] = useState(ALL_OWNERS);

  const filtered = useMemo(
    () => filterLots(lots.records, catalogs, { search, owner, materialId }),
    [lots.records, catalogs, search, owner, materialId],
  );

  if (!lots.loaded) return <OfflineLoading />;
  if (!lots.meta) return <OfflineSnapshotMissing />;

  const material = materialId ? catalogs.materials.get(materialId) : undefined;

  return (
    <div className="flex flex-col gap-3">
      <OfflineSnapshotNotice meta={lots.meta} />

      {material && (
        <p className="text-sm">
          Rollos de <span className="font-medium">{material.name}</span> ·{" "}
          {/* `<a>` y no `<Link>`: sin red el router de Next no navega; la
              carga completa la contesta el service worker. */}
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
          <a href="/lots/offline" className="text-muted-foreground underline">
            ver todos
          </a>
        </p>
      )}

      <OfflineSearchField
        value={search}
        onChange={setSearch}
        placeholder="Folio, tela o tono"
        label="Buscar rollo"
      />

      <Select value={owner} onValueChange={setOwner}>
        <SelectTrigger className="touch-target w-full" aria-label="Cliente dueño">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL_OWNERS}>Todos los dueños</SelectItem>
          <SelectItem value={FACTORY}>De la fábrica</SelectItem>
          {[...catalogs.clients.values()]
            .sort((a, b) => a.name.localeCompare(b.name, "es-MX"))
            .map((client) => (
              <SelectItem key={client.id} value={client.id}>{client.name}</SelectItem>
            ))}
        </SelectContent>
      </Select>

      <p className="tabular text-xs text-muted-foreground">
        {resultLabel(filtered.length)}
      </p>

      <ul className="flex flex-col gap-2">
        {filtered.slice(0, MAX_RESULTS).map((lot) => (
          <OfflineLotCard
            key={lot.id}
            lot={lot}
            pending={pendingByLot.get(lot.id) ?? 0}
            {...catalogs}
          />
        ))}
      </ul>
    </div>
  );
}

function useLotCatalogs(): LotCatalogs {
  const materials = useOfflineTable("materials");
  const locations = useOfflineTable("locations");
  const clients = useOfflineTable("clients");

  return useMemo(
    () => ({
      materials: byId(materials.records),
      locations: byId(locations.records),
      clients: byId(clients.records),
    }),
    [materials.records, locations.records, clients.records],
  );
}

interface LotFilters {
  search: string;
  owner: string;
  materialId: string;
}

/** Retazos primero y luego lo más viejo: el mismo orden con el que se surte. */
function filterLots(lots: OfflineLot[], catalogs: LotCatalogs, filters: LotFilters): OfflineLot[] {
  const term = normalizeTerm(filters.search);

  return lots
    .filter((lot) => !filters.materialId || lot.materialId === filters.materialId)
    .filter((lot) => ownerMatches(lot, filters.owner))
    .filter((lot) => {
      const material = catalogs.materials.get(lot.materialId);
      return matches(term, [lot.code, lot.shade, material?.code, material?.name, lot.supplierLotNumber]);
    })
    .sort((a, b) => {
      if (a.isRemnant !== b.isRemnant) return a.isRemnant ? -1 : 1;
      return a.receivedAt.localeCompare(b.receivedAt);
    });
}

function ownerMatches(lot: OfflineLot, owner: string): boolean {
  if (owner === ALL_OWNERS) return true;
  if (owner === FACTORY) return lot.clientId === null;
  return lot.clientId === owner;
}

function resultLabel(count: number): string {
  if (count === 0) return "Ningún rollo con esa búsqueda en la copia.";
  if (count > MAX_RESULTS) return `${count} rollos · se muestran ${MAX_RESULTS}, afina la búsqueda`;
  if (count === 1) return "1 rollo";
  return `${count} rollos`;
}
