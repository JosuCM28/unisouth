import {
  MovementRepository,
  type MovementWithRelations,
} from "@/lib/repositories/movement.repository";
import { requirePermission } from "@/lib/core/session";
import { enforceRateLimit, EXPORT_LIMIT } from "@/lib/core/rate-limit";
import {
  toXlsxWithNotice,
  xlsxResponse,
  type XlsxColumn,
} from "@/lib/export/xlsx";
import { movementFiltersFromRequest } from "@/lib/export/movement-filters";
import {
  MOVEMENT_DIRECTION_LABELS,
  MOVEMENT_TYPE_LABELS,
  UNIT_SHORT_LABELS,
} from "@/lib/constants/labels";
import type { Unit } from "@prisma/client";

const COLUMNS: XlsxColumn<MovementWithRelations>[] = [
  { header: "Folio", value: (r) => r.code, width: 18 },
  { header: "Fecha", value: (r) => r.createdAt, kind: "date", width: 14 },
  { header: "Tipo", value: (r) => MOVEMENT_TYPE_LABELS[r.type], width: 24 },
  { header: "Sentido", value: (r) => MOVEMENT_DIRECTION_LABELS[r.direction] },
  { header: "Rollo", value: (r) => r.lot.code, width: 16 },
  { header: "Material", value: (r) => r.material.name, width: 28 },
  { header: "Código material", value: (r) => r.material.code },
  { header: "Tono", value: (r) => r.lot.shade ?? "" },
  {
    header: "Cantidad",
    /* CON SIGNO, tal como está en el kárdex: la columna se suma en Excel y el
       resultado tiene que ser el saldo neto. Exportar valores absolutos
       obligaría a quien lo recibe a saber qué tipos restan y cuáles suman. */
    value: (r) => Number(r.quantity),
    kind: "number",
  },
  { header: "Unidad", value: (r) => UNIT_SHORT_LABELS[r.unit as Unit] },
  { header: "Saldo después", value: (r) => Number(r.balanceAfter), kind: "number" },
  { header: "Documento", value: (r) => r.document?.code ?? "" },
  { header: "Producción", value: (r) => r.productionRun?.code ?? "" },
  { header: "De", value: (r) => r.fromLocation?.code ?? "" },
  { header: "A", value: (r) => r.toLocation?.code ?? "" },
  { header: "Motivo", value: (r) => r.reason ?? "", width: 34 },
  { header: "Capturó", value: (r) => r.userName ?? "" },
];

export async function GET(request: Request) {
  // Recorren tablas completas: sin límite, son un vector de denegación.
  await enforceRateLimit("export:movements", EXPORT_LIMIT);

  await requirePermission("inventory:browse");

  const items = await new MovementRepository().findAllForExport(
    movementFiltersFromRequest(request),
  );

  return xlsxResponse(
    toXlsxWithNotice(items, COLUMNS, "Kárdex"),
    "movimientos",
  );
}
