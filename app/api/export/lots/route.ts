import { LotRepository } from "@/lib/repositories/lot.repository";
import { requirePermission } from "@/lib/core/session";
import { enforceRateLimit, EXPORT_LIMIT } from "@/lib/core/rate-limit";
import {
  toXlsxWithNotice,
  xlsxResponse,
  type XlsxColumn,
} from "@/lib/export/xlsx";
import { lotFiltersFromRequest } from "@/lib/export/lot-filters";
import { LOT_STATUS_LABELS, UNIT_SHORT_LABELS } from "@/lib/constants/labels";
import type { Lot, LotStatus, Unit } from "@prisma/client";

type Row = Lot & {
  material: { code: string; name: string; composition: string | null; colorName: string | null };
  location: { code: string; name: string } | null;
  client: { name: string } | null;
};

/**
 * Las columnas del inventario.
 *
 * Las cantidades van como NÚMERO y no como texto: quien recibe el archivo lo
 * primero que hace es seleccionar la columna para ver el total, y con texto
 * Excel no suma nada. Lo mismo con las fechas, que como texto se ordenan
 * alfabéticamente —y ahí el 10 de enero va antes que el 2 de febrero—.
 */
const COLUMNS: XlsxColumn<Row>[] = [
  { header: "Folio", value: (r) => r.code, width: 16 },
  { header: "Material", value: (r) => r.material.name, width: 30 },
  { header: "Código material", value: (r) => r.material.code },
  { header: "Cantidad", value: (r) => Number(r.currentQuantity), kind: "number" },
  { header: "Unidad", value: (r) => UNIT_SHORT_LABELS[r.unit as Unit] },
  { header: "Reservado", value: (r) => Number(r.reservedQuantity), kind: "number" },
  {
    header: "Disponible",
    /* La resta se hace aquí y no se deja al lector: "disponible = actual −
       reservado" es una regla del negocio, y quien abre el Excel no tiene por
       qué conocerla ni arriesgarse a surtir de más. */
    value: (r) => Number(r.currentQuantity) - Number(r.reservedQuantity),
    kind: "number",
  },
  { header: "Estado", value: (r) => LOT_STATUS_LABELS[r.status as LotStatus] },
  { header: "Ubicación", value: (r) => r.location ? `${r.location.code} · ${r.location.name}` : "", width: 24 },
  { header: "Cliente", value: (r) => r.client?.name ?? "Fábrica", width: 22 },
  { header: "Color", value: (r) => r.colorText ?? r.material.colorName ?? "" },
  { header: "Tono", value: (r) => r.shade ?? "" },
  { header: "Lote proveedor", value: (r) => r.supplierLotNumber ?? "" },
  { header: "Retazo", value: (r) => (r.isRemnant ? "Sí" : "No") },
  { header: "Medido", value: (r) => (r.verified ? "Sí" : "No") },
  { header: "Recibido", value: (r) => r.receivedAt, kind: "date" },
];

export async function GET(request: Request) {
  // Recorren tablas completas: sin límite, son un vector de denegación.
  await enforceRateLimit("export:lots", EXPORT_LIMIT);

  await requirePermission("inventory:browse");

  /* Los MISMOS filtros que la pantalla. Antes esta ruta no leía ninguno y
     bajaba los primeros 100 rollos sin filtrar: quien acotaba por material o
     por cliente recibía un archivo que no era lo que estaba viendo, y no
     tenía forma de notarlo. */
  const rows = (await new LotRepository().findAllForExport(
    lotFiltersFromRequest(request),
  )) as Row[];

  return xlsxResponse(
    toXlsxWithNotice(rows, COLUMNS, "Inventario"),
    "inventario",
  );
}
