import type { PileLotRow, ShadeTotal } from "@/lib/pile-sheet-data";
import type { MaterialInventoryReport } from "@/lib/material-inventory-report";
import {
  LOT_STATUS_LABELS,
  MATERIAL_TYPE_LABELS,
  UNIT_SHORT_LABELS,
} from "@/lib/constants/labels";
import { formatFabricSpec } from "@/lib/material-spec";
import {
  documentSheetXml,
  tableSheetXml,
  type SheetRow,
  type XlsxColumn,
} from "./xlsx";
import { toXlsxWorkbook } from "./xlsx-workbook";

/**
 * El inventario de un material en un libro de DOS pestañas.
 *
 * "Por tono" es la que se consulta antes de cortar —cuánta tela hay de cada
 * partida de tintura—; "Rollos" es el detalle para buscar una pieza. Van
 * separadas para que quien filtra o reordena la lista de rollos no desarme
 * el resumen.
 */
export function buildMaterialInventoryWorkbook(
  report: MaterialInventoryReport,
): Buffer {
  return toXlsxWorkbook([
    { name: "Por tono", xml: summarySheet(report) },
    { name: "Rollos", xml: tableSheetXml(report.data.lots, LOT_COLUMNS) },
  ]);
}

/** Ancho de las columnas del resumen. La primera lleva las etiquetas. */
const SUMMARY_WIDTHS = [22, 14, 16, 10, 40];

function summarySheet({ data, criteria }: MaterialInventoryReport): string {
  const { material, totals } = data;
  const unit = UNIT_SHORT_LABELS[totals.unit];

  /* Un archivo recortado se avisa arriba y no se calla: quien lo recibe por
     correo no tiene forma de saber que le faltan rollos. */
  const notice: SheetRow[] = data.truncated
    ? [
        [
          {
            value: `⚠ Se listan ${data.lots.length} de ${totals.lots} rollos. Acota el filtro para ver el resto.`,
            style: "label",
            mergeTo: 5,
          },
        ],
        [],
      ]
    : [];

  const rows: SheetRow[] = [
    [{ value: `Inventario · ${material.name}`, style: "title", mergeTo: 5 }],
    [],
    [{ value: "Código", style: "label" }, { value: material.code }],
    [{ value: "Tipo", style: "label" }, { value: MATERIAL_TYPE_LABELS[material.type] }],
    ...specRows(data),
    [{ value: "Filtro", style: "label" }, { value: criteria.join(" · ") }],
    [{ value: "Generado", style: "label" }, { value: new Date(), kind: "datetime" }],
    [],
    [
      { value: "Existencia", style: "label" },
      { value: totals.quantity, kind: "number" },
      { value: unit },
    ],
    [{ value: "Rollos", style: "label" }, { value: totals.lots, kind: "number" }],
    [{ value: "Retazos", style: "label" }, { value: totals.remnants, kind: "number" }],
    [],
    ...notice,
    ...shadeRows(data.shades, totals, unit, material.requiresShade),
  ];

  return documentSheetXml(rows, SUMMARY_WIDTHS);
}

/** Las especificaciones que estén capturadas; las vacías no se escriben. */
function specRows({ material }: MaterialInventoryReport["data"]): SheetRow[] {
  const specs: [string, string | null][] = [
    ["Composición", material.composition],
    ["Color", material.colorName],
    ["Ancho", material.widthMm ? `${material.widthMm} mm` : null],
    // Grosor u onzas, el que esté lleno: mezclilla en oz, tela plana en mm.
    ["Especificación", formatFabricSpec(material)],
  ];

  return specs
    .filter((spec): spec is [string, string] => Boolean(spec[1]))
    .map(([label, value]) => [{ value: label, style: "label" }, { value }]);
}

function shadeRows(
  shades: ShadeTotal[],
  totals: MaterialInventoryReport["data"]["totals"],
  unit: string,
  requiresShade: boolean,
): SheetRow[] {
  const title = requiresShade
    ? "Por tono · no mezclar tonos en un tendido"
    : "Por tono";

  return [
    [{ value: title, style: "section", mergeTo: 5 }],
    [
      { value: "Tono", style: "tableHeader" },
      { value: "Rollos", style: "tableHeaderRight" },
      { value: "Cantidad", style: "tableHeaderRight" },
      { value: "Unidad", style: "tableHeader" },
    ],
    ...shades.map((shade): SheetRow => [
      { value: shade.shade },
      { value: shade.lots, kind: "number" },
      { value: shade.quantity, kind: "number" },
      { value: unit },
    ]),
    /* El total sale de la suma de los tonos listados y no del agregado de la
       pila: así cuadra con las filas de arriba aun si el archivo se topó. */
    [
      { value: "Total", style: "total" },
      { value: sum(shades, (s) => s.lots), kind: "number", style: "totalNumber" },
      { value: sum(shades, (s) => s.quantity), kind: "number", style: "totalNumber" },
      { value: unit, style: "total" },
    ],
  ];
}

function sum<T>(items: T[], pick: (item: T) => number): number {
  return items.reduce((total, item) => total + pick(item), 0);
}

const LOT_COLUMNS: XlsxColumn<PileLotRow>[] = [
  { header: "Folio", value: (r) => r.code, width: 16 },
  { header: "Tono", value: (r) => r.shade ?? "Sin tono", width: 14 },
  { header: "Color", value: (r) => r.colorText ?? "", width: 16 },
  { header: "Lote proveedor", value: (r) => r.supplierLotNumber ?? "", width: 16 },
  { header: "Ubicación", value: (r) => r.locationName ?? "", width: 24 },
  { header: "Cliente dueño", value: (r) => r.clientName ?? "De la fábrica", width: 22 },
  { header: "Estado", value: (r) => LOT_STATUS_LABELS[r.status] },
  { header: "Retazo", value: (r) => (r.isRemnant ? "Sí" : "No") },
  { header: "Cantidad", value: (r) => r.currentQuantity, kind: "number" },
  { header: "Unidad", value: (r) => UNIT_SHORT_LABELS[r.unit] },
  { header: "Recibido", value: (r) => r.receivedAt, kind: "date" },
  { header: "Verificado", value: (r) => (r.verified ? "Sí" : "No") },
];
