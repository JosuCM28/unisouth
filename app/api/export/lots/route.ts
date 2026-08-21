import { LotRepository } from "@/lib/repositories/lot.repository";
import { requirePermission } from "@/lib/core/session";
import { enforceRateLimit, EXPORT_LIMIT } from "@/lib/core/rate-limit";
import { csvResponse, toCsv, type CsvColumn } from "@/lib/csv";
import { LOT_STATUS_LABELS, UNIT_SHORT_LABELS } from "@/lib/constants/labels";
import { formatDate } from "@/lib/utils";
import type { Lot, LotStatus, Unit } from "@prisma/client";

type Row = Lot & {
  material: { code: string; name: string };
  location: { code: string } | null;
  client: { name: string } | null;
};

const COLUMNS: CsvColumn<Row>[] = [
  { header: "Folio", value: (r) => r.code },
  { header: "Material", value: (r) => r.material.name },
  { header: "Código material", value: (r) => r.material.code },
  { header: "Cantidad", value: (r) => Number(r.currentQuantity) },
  { header: "Unidad", value: (r) => UNIT_SHORT_LABELS[r.unit as Unit] },
  { header: "Reservado", value: (r) => Number(r.reservedQuantity) },
  { header: "Estado", value: (r) => LOT_STATUS_LABELS[r.status as LotStatus] },
  { header: "Ubicación", value: (r) => r.location?.code ?? "" },
  { header: "Cliente", value: (r) => r.client?.name ?? "Fábrica" },
  { header: "Tono", value: (r) => r.shade ?? "" },
  { header: "Lote proveedor", value: (r) => r.supplierLotNumber ?? "" },
  { header: "Medido", value: (r) => (r.verified ? "Sí" : "No") },
  { header: "Recibido", value: (r) => formatDate(r.receivedAt) },
];

export async function GET() {
  // Recorren tablas completas: sin límite, son un vector de denegación.
  await enforceRateLimit("export:lots", EXPORT_LIMIT);

  await requirePermission("inventory:browse");

  const { items } = await new LotRepository().search({ pageSize: 100 });
  return csvResponse(toCsv(items as Row[], COLUMNS), "inventario");
}
