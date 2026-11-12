"use client";

import { useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";
import { MATERIAL_TYPE_LABELS, UNIT_SHORT_LABELS } from "@/lib/constants/labels";
import type { OfflineLot, OfflineMaterial } from "@/lib/offline/snapshot.types";
import { cn, formatQuantity } from "@/lib/utils";
import { useOfflineTable } from "@/hooks/use-offline-table";
import { Button } from "@/components/ui/button";
import { MAX_RESULTS, matches, normalizeTerm, OfflineSearchField } from "./offline-search-field";
import {
  OfflineLoading, OfflineSnapshotMissing, OfflineSnapshotNotice,
} from "./offline-snapshot-notice";

/** Lo que hay de un tono. Se agrupa porque mezclar tonos arruina el tendido. */
interface ShadeStock {
  shade: string;
  lots: number;
  quantity: number;
}

interface MaterialStock {
  material: OfflineMaterial;
  lots: number;
  quantity: number;
  remnants: number;
  shades: ShadeStock[];
}

/** Materiales con lo que hay en bodega según la copia del equipo. */
export function OfflineMaterialsView() {
  const materials = useOfflineTable("materials");
  const lots = useOfflineTable("lots");
  const [search, setSearch] = useState("");

  const stock = useMemo(
    () => buildStock(materials.records, lots.records),
    [materials.records, lots.records],
  );
  const filtered = useMemo(() => {
    const term = normalizeTerm(search);
    return stock.filter((row) =>
      matches(term, [row.material.code, row.material.name, row.material.colorName]),
    );
  }, [stock, search]);

  if (!materials.loaded || !lots.loaded) return <OfflineLoading />;
  if (!materials.meta) return <OfflineSnapshotMissing />;

  return (
    <div className="flex flex-col gap-3">
      <OfflineSnapshotNotice meta={lots.meta ?? materials.meta} />

      <OfflineSearchField
        value={search}
        onChange={setSearch}
        placeholder="Código, nombre o color"
        label="Buscar material"
      />

      <ul className="flex flex-col gap-2">
        {filtered.slice(0, MAX_RESULTS).map((row) => (
          <MaterialRow key={row.material.id} row={row} />
        ))}
        {filtered.length === 0 && (
          <li className="px-3 py-6 text-center text-sm text-muted-foreground">
            Ningún material con esa búsqueda en la copia.
          </li>
        )}
      </ul>
    </div>
  );
}

function MaterialRow({ row }: { row: MaterialStock }) {
  const [open, setOpen] = useState(false);
  const unit = UNIT_SHORT_LABELS[row.material.baseUnit];

  return (
    <li className="flat-surface">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="touch-target flex w-full items-start justify-between gap-3 p-3 text-left transition-colors hover:bg-muted"
      >
        <div className="min-w-0">
          <p className="tabular text-sm font-medium">{row.material.code}</p>
          <p className="truncate text-sm">{row.material.name}</p>
          <p className="text-xs text-muted-foreground">
            {MATERIAL_TYPE_LABELS[row.material.type]}
            {row.material.colorName && ` · ${row.material.colorName}`}
          </p>
        </div>
        <span className="flex shrink-0 items-center gap-1 text-right">
          <span>
            <span className="tabular block text-sm font-semibold">
              {formatQuantity(row.quantity, { unit })}
            </span>
            <span className="tabular block text-xs text-muted-foreground">
              {rollsLabel(row)}
            </span>
          </span>
          <ChevronDown className={cn("size-4 transition-transform", open && "rotate-180")} aria-hidden />
        </span>
      </button>

      {open && <MaterialDetail row={row} unit={unit} />}
    </li>
  );
}

function MaterialDetail({ row, unit }: { row: MaterialStock; unit: string }) {
  return (
    <div className="flex flex-col gap-3 border-t border-border p-3">
      {row.shades.length > 0 && (
        <ul className="flex flex-col gap-1 text-sm">
          {row.shades.map((shade) => (
            <li key={shade.shade} className="flex justify-between gap-3">
              <span>{shade.shade}</span>
              <span className="tabular text-muted-foreground">
                {shade.lots} · {formatQuantity(shade.quantity, { unit })}
              </span>
            </li>
          ))}
        </ul>
      )}
      {/* `<a>` y no `<Link>`: sin red el router de Next falla, y una carga
          completa sí la contesta el service worker con la copia guardada. */}
      <Button asChild variant="outline" className="touch-target">
        <a href={`/lots/offline?material=${row.material.id}`}>Ver rollos</a>
      </Button>
    </div>
  );
}

/**
 * Suma los rollos por material y por tono.
 *
 * Sólo cuentan los que tienen saldo: un material agotado que sale con "0 m"
 * arriba de la lista estorba más de lo que informa. Los que no tienen rollos
 * van al final, porque igual se busca su código.
 */
function buildStock(materials: OfflineMaterial[], lots: OfflineLot[]): MaterialStock[] {
  const byMaterial = new Map<string, OfflineLot[]>();
  for (const lot of lots) {
    if (lot.currentQuantity <= 0) continue;
    const list = byMaterial.get(lot.materialId) ?? [];
    list.push(lot);
    byMaterial.set(lot.materialId, list);
  }

  return materials
    .map((material) => summarize(material, byMaterial.get(material.id) ?? []))
    .sort((a, b) => {
      if ((a.lots > 0) !== (b.lots > 0)) return a.lots > 0 ? -1 : 1;
      return a.material.name.localeCompare(b.material.name, "es-MX");
    });
}

function summarize(material: OfflineMaterial, lots: OfflineLot[]): MaterialStock {
  const shades = new Map<string, ShadeStock>();
  for (const lot of lots) {
    const key = lot.shade ?? "Sin tono";
    const entry = shades.get(key) ?? { shade: key, lots: 0, quantity: 0 };
    entry.lots += 1;
    entry.quantity += lot.currentQuantity;
    shades.set(key, entry);
  }

  return {
    material,
    lots: lots.length,
    quantity: lots.reduce((total, lot) => total + lot.currentQuantity, 0),
    remnants: lots.filter((lot) => lot.isRemnant).length,
    shades: [...shades.values()].sort((a, b) => a.shade.localeCompare(b.shade, "es-MX")),
  };
}

function rollsLabel(row: MaterialStock): string {
  const rolls = row.lots === 1 ? "1 rollo" : `${row.lots} rollos`;
  if (row.remnants === 0) return rolls;
  return `${rolls} · ${row.remnants} retazo(s)`;
}
