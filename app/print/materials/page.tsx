import type { Metadata } from "next";
import { MaterialRepository } from "@/lib/repositories/material.repository";
import { requirePermission } from "@/lib/core/session";
import {
  parseMaterialFilters,
  type MaterialSearchParams,
} from "@/lib/export/material-filters";
import { MATERIAL_TYPE_LABELS, UNIT_SHORT_LABELS } from "@/lib/constants/labels";
import { formatFabricSpec } from "@/lib/material-spec";
import { formatQuantity } from "@/lib/utils";
import { PrintSheet, PrintTable } from "@/components/shared/print-sheet";
import type { MaterialType, Unit } from "@prisma/client";

export const metadata: Metadata = { title: "Materiales impresos" };

interface PageProps {
  searchParams: Promise<MaterialSearchParams>;
}

/** El catálogo filtrado, en papel o PDF. La contraparte del Excel. */
export default async function PrintMaterialsPage({ searchParams }: PageProps) {
  await requirePermission("inventory:browse");

  const params = await searchParams;
  const repository = new MaterialRepository();
  const items = await repository.findAllForExport(parseMaterialFilters(params));
  const stock = await repository.getStockByMaterial(items.map((m) => m.id));

  const rows = items.map((material) => {
    const available = stock.get(material.id) ?? 0;
    const reorder = Number(material.reorderPoint);

    return [
      material.code,
      material.name,
      MATERIAL_TYPE_LABELS[material.type as MaterialType],
      formatFabricSpec(material) ?? "—",
      material.colorName ?? "—",
      formatQuantity(available, {
        unit: UNIT_SHORT_LABELS[material.baseUnit as Unit],
      }),
      // El aviso se calcula aquí: la hoja se lleva a compras, y ahí lo que se
      // busca es exactamente esta columna.
      available < reorder ? "SÍ" : "",
    ];
  });

  return (
    <PrintSheet
      title="Materiales"
      criteria={params.q ? [`búsqueda "${params.q}"`] : ["catálogo completo"]}
      count={`${items.length} ${items.length === 1 ? "material" : "materiales"}`}
    >
      <PrintTable
        head={[
          "Código",
          "Nombre",
          "Tipo",
          "Especificación",
          "Color",
          "Existencia",
          "Bajo mínimo",
        ]}
        rows={rows}
        numeric={[5]}
        empty="Ningún material cumple con ese filtro."
      />
    </PrintSheet>
  );
}
