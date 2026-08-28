import type { Metadata } from "next";
import { LotRepository } from "@/lib/repositories/lot.repository";
import { requirePermission } from "@/lib/core/session";
import { parseLotFilters, type LotSearchParams } from "@/lib/export/lot-filters";
import { describeLotFilters } from "@/lib/export/filter-labels";
import { LOT_STATUS_LABELS, UNIT_SHORT_LABELS } from "@/lib/constants/labels";
import { formatDate, formatQuantity } from "@/lib/utils";
import { PrintSheet, PrintTable } from "@/components/shared/print-sheet";
import type { Lot, LotStatus, Unit } from "@prisma/client";

export const metadata: Metadata = { title: "Inventario impreso" };

interface PageProps {
  searchParams: Promise<LotSearchParams>;
}

type Row = Lot & {
  material: { code: string; name: string; colorName: string | null };
  location: { code: string; name: string } | null;
  client: { name: string } | null;
};

/**
 * El inventario filtrado, en una hoja para llevar al piso o mandar en PDF.
 *
 * Es la contraparte en papel del Excel: mismos filtros, mismas filas. Se llega
 * desde el inventario con la URL tal cual, así que lo que se imprime es
 * exactamente lo que se está viendo —que es justo lo que fallaba antes—.
 */
export default async function PrintInventoryPage({ searchParams }: PageProps) {
  await requirePermission("inventory:browse");

  const params = await searchParams;
  const filters = parseLotFilters(params);
  const lots = (await new LotRepository().findAllForExport(filters)) as Row[];

  /* El total se suma por UNIDAD y no en un solo número: sumar metros con
     kilos y piezas daría una cifra que no significa nada. */
  const totals = new Map<string, number>();
  for (const lot of lots) {
    const unit = UNIT_SHORT_LABELS[lot.unit as Unit];
    totals.set(unit, (totals.get(unit) ?? 0) + Number(lot.currentQuantity));
  }

  const rows = lots.map((lot) => [
    lot.code,
    `${lot.material.code} · ${lot.material.name}`,
    lot.colorText ?? lot.material.colorName ?? "—",
    lot.shade ?? "—",
    lot.location ? lot.location.code : "—",
    lot.client?.name ?? "Fábrica",
    LOT_STATUS_LABELS[lot.status as LotStatus],
    formatQuantity(lot.currentQuantity, {
      unit: UNIT_SHORT_LABELS[lot.unit as Unit],
    }),
    formatDate(lot.receivedAt),
  ]);

  return (
    <PrintSheet
      title="Inventario"
      criteria={describeLotFilters(params)}
      count={`${lots.length} ${lots.length === 1 ? "rollo" : "rollos"}`}
    >
      <PrintTable
        head={[
          "Folio",
          "Material",
          "Color",
          "Tono",
          "Ubic.",
          "Cliente",
          "Estado",
          "Cantidad",
          "Recibido",
        ]}
        rows={rows}
        numeric={[7]}
        empty="Ningún rollo cumple con ese filtro."
      />

      {totals.size > 0 && (
        <section className="mt-4 break-inside-avoid border-t-2 border-black pt-2">
          <h2 className="text-xs font-bold uppercase">Total por unidad</h2>
          <ul className="mt-1 flex flex-wrap gap-x-6 gap-y-1 text-xs">
            {[...totals.entries()].map(([unit, quantity]) => (
              <li key={unit} className="tabular">
                <span className="font-semibold">{formatQuantity(quantity)}</span>{" "}
                {unit}
              </li>
            ))}
          </ul>
        </section>
      )}
    </PrintSheet>
  );
}
