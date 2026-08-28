import { MaterialRepository } from "@/lib/repositories/material.repository";
import { requirePermission } from "@/lib/core/session";
import { enforceRateLimit, EXPORT_LIMIT } from "@/lib/core/rate-limit";
import {
  toXlsxWithNotice,
  xlsxResponse,
  type XlsxColumn,
} from "@/lib/export/xlsx";
import { materialFiltersFromRequest } from "@/lib/export/material-filters";
import { MATERIAL_TYPE_LABELS, UNIT_SHORT_LABELS } from "@/lib/constants/labels";
import { formatFabricSpec } from "@/lib/material-spec";
import type { Material, MaterialType, Unit } from "@prisma/client";

export async function GET(request: Request) {
  // Recorren tablas completas: sin límite, son un vector de denegación.
  await enforceRateLimit("export:materials", EXPORT_LIMIT);

  await requirePermission("inventory:browse");

  const repository = new MaterialRepository();
  // Los MISMOS filtros que la pantalla: antes esta ruta no leía el buscador y
  // bajaba los primeros 100 materiales, sin importar qué se estuviera viendo.
  const items = await repository.findAllForExport(
    materialFiltersFromRequest(request),
  );
  const stock = await repository.getStockByMaterial(items.map((m) => m.id));

  const columns: XlsxColumn<Material>[] = [
    { header: "Código", value: (r) => r.code },
    { header: "Nombre", value: (r) => r.name, width: 30 },
    { header: "Tipo", value: (r) => MATERIAL_TYPE_LABELS[r.type as MaterialType] },
    { header: "Unidad", value: (r) => UNIT_SHORT_LABELS[r.baseUnit as Unit] },
    { header: "Especificación", value: (r) => formatFabricSpec(r) ?? "", width: 24 },
    { header: "Composición", value: (r) => r.composition ?? "", width: 26 },
    { header: "Color", value: (r) => r.colorName ?? "" },
    { header: "Existencia", value: (r) => stock.get(r.id) ?? 0, kind: "number" },
    { header: "Punto de reorden", value: (r) => Number(r.reorderPoint), kind: "number" },
    {
      header: "Bajo mínimo",
      /* La comparación se hace aquí y no se deja al lector: la columna existe
         justo para poder filtrar por ella y ver qué hay que comprar. */
      value: (r) => ((stock.get(r.id) ?? 0) < Number(r.reorderPoint) ? "Sí" : "No"),
    },
    { header: "Requiere tono", value: (r) => (r.requiresShade ? "Sí" : "No") },
    { header: "Activo", value: (r) => (r.active ? "Sí" : "No") },
  ];

  return xlsxResponse(
    toXlsxWithNotice(items, columns, "Materiales"),
    "materiales",
  );
}
