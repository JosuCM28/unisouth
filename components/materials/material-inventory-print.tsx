import type { PileSheetData } from "@/lib/pile-sheet-data";
import {
  LOT_STATUS_LABELS,
  MATERIAL_TYPE_LABELS,
  UNIT_SHORT_LABELS,
} from "@/lib/constants/labels";
import { formatFabricSpec } from "@/lib/material-spec";
import { formatDate, formatQuantity } from "@/lib/utils";
import { PrintTable } from "@/components/shared/print-sheet";

/**
 * Cuerpo de la hoja de inventario de un material: ficha corta, resumen por
 * tono y el detalle rollo por rollo.
 *
 * El resumen va ANTES del detalle porque es lo que se busca al recibir la
 * hoja —"¿alcanza este tono para el pedido?"—; los rollos son para cuando
 * hay que ir a buscar una pieza.
 */
export function MaterialInventoryPrint({ data }: { data: PileSheetData }) {
  const { material, totals } = data;
  const unit = UNIT_SHORT_LABELS[totals.unit];

  return (
    <>
      <p className="mt-3 text-xs">{specLine(data)}</p>

      <p className="tabular mt-2 text-lg font-bold">
        {formatQuantity(totals.quantity, { unit })}
        <span className="ml-2 text-xs font-normal">
          {totals.lots} {totals.lots === 1 ? "rollo" : "rollos"}
          {totals.remnants > 0 && ` · ${totals.remnants} retazo(s)`}
        </span>
      </p>

      <h2 className="mt-5 text-sm font-bold">
        Por tono
        {material.requiresShade && (
          <span className="ml-2 text-xs font-normal">no mezclar tonos en un tendido</span>
        )}
      </h2>
      <PrintTable
        head={["Tono", "Rollos", "Cantidad"]}
        rows={shadeRows(data, unit)}
        numeric={[1, 2]}
        empty="Sin existencia."
      />

      <h2 className="mt-6 text-sm font-bold">Rollos</h2>
      {data.truncated && (
        <p className="mt-1 text-xs font-semibold">
          Se listan {data.lots.length} de {totals.lots} rollos. Acota el filtro
          para ver el resto.
        </p>
      )}
      <PrintTable
        head={["Folio", "Tono", "Ubicación", "Dueño", "Estado", "Recibido", "Cantidad"]}
        rows={data.lots.map((lot) => [
          lot.code,
          lot.shade ?? "Sin tono",
          lot.locationName ?? "—",
          lot.clientName ?? "De la fábrica",
          lotStatus(lot.status, lot.isRemnant),
          formatDate(lot.receivedAt),
          formatQuantity(lot.currentQuantity, { unit: UNIT_SHORT_LABELS[lot.unit] }),
        ])}
        numeric={[6]}
        empty="Ningún rollo cumple con ese filtro."
      />
    </>
  );
}

/** Tipo y especificaciones capturadas, en un renglón. Las vacías se omiten. */
function specLine({ material }: PileSheetData): string {
  return [
    MATERIAL_TYPE_LABELS[material.type],
    material.composition,
    material.colorName,
    material.widthMm ? `${material.widthMm} mm de ancho` : null,
    formatFabricSpec(material),
  ]
    .filter(Boolean)
    .join(" · ");
}

/** Los tonos y, al pie, el total que cuadra con ellos. */
function shadeRows({ shades }: PileSheetData, unit: string): string[][] {
  if (shades.length === 0) return [];

  const lots = shades.reduce((total, shade) => total + shade.lots, 0);
  const quantity = shades.reduce((total, shade) => total + shade.quantity, 0);

  return [
    ...shades.map((shade) => [
      shade.shade,
      String(shade.lots),
      formatQuantity(shade.quantity, { unit }),
    ]),
    ["TOTAL", String(lots), formatQuantity(quantity, { unit })],
  ];
}

/* Un retazo se dice aunque su estado sea otro: es lo primero que se surte. */
function lotStatus(status: PileSheetData["lots"][number]["status"], isRemnant: boolean) {
  const label = LOT_STATUS_LABELS[status];
  if (isRemnant && status !== "REMNANT") return `${label} · retazo`;
  return label;
}
