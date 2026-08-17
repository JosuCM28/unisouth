import { MaterialRepository } from "@/lib/repositories/material.repository";
import { requirePermission } from "@/lib/core/session";
import { enforceRateLimit, EXPORT_LIMIT } from "@/lib/core/rate-limit";
import { csvResponse, toCsv, type CsvColumn } from "@/lib/csv";
import { MATERIAL_TYPE_LABELS, UNIT_SHORT_LABELS } from "@/lib/constants/labels";
import { formatFabricSpec } from "@/lib/material-spec";
import type { Material, MaterialType, Unit } from "@prisma/client";

export async function GET() {
  // Recorren tablas completas: sin límite, son un vector de denegación.
  await enforceRateLimit("export:materials", EXPORT_LIMIT);

  await requirePermission("inventory:read");

  const repository = new MaterialRepository();
  const { items } = await repository.search({ pageSize: 100 });
  const stock = await repository.getStockByMaterial(items.map((m) => m.id));

  const columns: CsvColumn<Material>[] = [
    { header: "Código", value: (r) => r.code },
    { header: "Nombre", value: (r) => r.name },
    { header: "Tipo", value: (r) => MATERIAL_TYPE_LABELS[r.type as MaterialType] },
    { header: "Unidad", value: (r) => UNIT_SHORT_LABELS[r.baseUnit as Unit] },
    { header: "Especificación", value: (r) => formatFabricSpec(r) ?? "" },
    { header: "Composición", value: (r) => r.composition ?? "" },
    { header: "Color", value: (r) => r.colorName ?? "" },
    { header: "Existencia", value: (r) => stock.get(r.id) ?? 0 },
    { header: "Punto de reorden", value: (r) => Number(r.reorderPoint) },
    { header: "Requiere tono", value: (r) => (r.requiresShade ? "Sí" : "No") },
    { header: "Activo", value: (r) => (r.active ? "Sí" : "No") },
  ];

  return csvResponse(toCsv(items, columns), "materiales");
}
