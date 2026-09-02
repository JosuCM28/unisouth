import { requirePermission } from "@/lib/core/session";
import { enforceRateLimit, EXPORT_LIMIT } from "@/lib/core/rate-limit";
import {
  toXlsxWithNotice,
  xlsxResponse,
  type XlsxColumn,
} from "@/lib/export/xlsx";
import { ReceiptRepository } from "@/lib/repositories/receipt.repository";
import {
  ReceiptReportService,
  type ReceiptReportData,
} from "@/lib/services/receipt-report.service";
import type { ReportGroupRow } from "@/lib/repositories/receipt.repository";
import {
  parsePeriodGroup,
  parseReportRange,
  PERIOD_GROUPS,
  type PeriodGroup,
} from "@/lib/constants/receipt-report";
import { UNIT_SHORT_LABELS } from "@/lib/constants/labels";
import { formatDate } from "@/lib/utils";

/**
 * Un renglón del reporte global de recepciones.
 *
 * Los seis cortes —periodo, tela, cliente, proveedor, paquetería y el detalle
 * guía por guía— tienen formas distintas y Excel abre UNA tabla. Se aplanan en
 * un listado con columna "Sección" para poder filtrarla o armar una tabla
 * dinámica encima, igual que el reporte general de la fábrica.
 *
 * Las cantidades van como NÚMERO. Como texto, quien recibe el archivo tiene
 * que convertir la columna a mano antes de poder sumarla, que es justo lo
 * primero que va a intentar hacer.
 */
interface ReportRow {
  section: string;
  concept: string;
  /** Sólo en el detalle. Es la columna por la que se pivotea una guía mixta. */
  material: string;
  detail: string;
  date: Date | "";
  receipts: number | "";
  lots: number | "";
  quantity: number | "";
  unit: string;
}

const COLUMNS: XlsxColumn<ReportRow>[] = [
  { header: "Sección", value: (row) => row.section, width: 24 },
  { header: "Concepto", value: (row) => row.concept, width: 30 },
  { header: "Material", value: (row) => row.material, width: 30 },
  { header: "Detalle", value: (row) => row.detail, width: 34 },
  { header: "Fecha", value: (row) => row.date, kind: "date" },
  { header: "Guías", value: (row) => row.receipts, kind: "number" },
  { header: "Rollos", value: (row) => row.lots, kind: "number" },
  { header: "Cantidad", value: (row) => row.quantity, kind: "number" },
  { header: "Unidad", value: (row) => row.unit },
];

export async function GET(request: Request) {
  // Recorre el histórico completo: sin límite es un vector de denegación.
  await enforceRateLimit("export:receipts", EXPORT_LIMIT);
  await requirePermission("inventory:browse");

  const params = new URL(request.url).searchParams;
  const range = parseReportRange(params.get("desde"), params.get("hasta"));
  const group = parsePeriodGroup(params.get("agrupar"));

  const filters = {
    search: params.get("q") ?? undefined,
    materialId: params.get("materialId") ?? undefined,
    clientId: params.get("clientId") ?? undefined,
    supplierId: params.get("supplierId") ?? undefined,
    carrierId: params.get("carrierId") ?? undefined,
  };

  const [report, applied] = await Promise.all([
    new ReceiptReportService().getReport({ ...filters, ...range, group }),
    describeFilters(filters),
  ]);

  const rows: ReportRow[] = [
    ...headerRows(report, range, group, applied),
    ...summaryRows(report),
    ...groupRows(report.periods, "Por periodo"),
    ...groupRows(report.byMaterial, "Por tela"),
    ...groupRows(report.byClient, "Por cliente dueño"),
    ...groupRows(report.bySupplier, "Por proveedor"),
    ...groupRows(report.byCarrier, "Por paquetería"),
    ...detailRows(report),
  ];

  return xlsxResponse(
    toXlsxWithNotice(rows, COLUMNS, "Recepciones"),
    "reporte-recepciones",
  );
}

/**
 * Qué periodo y con qué filtros se sacó el archivo.
 *
 * Va hasta arriba y no se omite nunca: un Excel filtrado se ve exactamente
 * igual que uno completo, y quien lo recibe por correo no tiene la pantalla
 * enfrente para saber que sólo trae la gabardina de un cliente.
 */
function headerRows(
  report: ReceiptReportData,
  range: { from: Date; to: Date },
  group: PeriodGroup,
  applied: string[],
): ReportRow[] {
  const groupLabel =
    PERIOD_GROUPS.find((option) => option.key === group)?.label ?? group;

  const meta: [string, string][] = [
    ["Del", formatDate(range.from)],
    ["Al", formatDate(range.to)],
    ["Agrupado por", groupLabel],
    ["Filtros", applied.length > 0 ? applied.join(" · ") : "Sin filtros"],
    ["Se cuenta", "Lo que entró (metraje de alta), no el saldo de hoy"],
    // Se dice porque no es evidente: quien pivotee por "Material" sin acotar
    // la sección obtendría ceros en los cortes agregados y creería que faltan
    // datos, cuando ahí la tela va en la columna "Concepto".
    [
      "Columna Material",
      "Sólo en «Detalle por recepción». En los cortes agregados la tela va en «Concepto».",
    ],
  ];

  if (report.truncated) {
    meta.push([
      "AVISO",
      "El rango trae más recepciones de las que cabe procesar: las cifras están INCOMPLETAS. Acota las fechas o filtra por tela.",
    ]);
  }

  return meta.map(([concept, detail]) => blank({
    section: "Reporte",
    concept,
    detail,
  }));
}

function summaryRows(report: ReceiptReportData): ReportRow[] {
  const { summary } = report;

  return [
    blank({
      section: "Resumen",
      concept: "Recepciones",
      receipts: summary.receipts,
      lots: summary.lots,
    }),
    blank({
      section: "Resumen",
      concept: "Telas distintas",
      lots: summary.materials,
      detail: `De ${summary.clients} dueños`,
    }),
    // Un renglón por unidad: sumar metros con piezas daría una cifra que no
    // significa nada y que además nadie puede comprar.
    ...summary.byUnit.map((total) =>
      blank({
        section: "Resumen",
        concept: "Total recibido",
        lots: total.lots,
        quantity: total.quantity,
        unit: UNIT_SHORT_LABELS[total.unit],
      }),
    ),
  ];
}

/** Un corte cualquiera: un renglón por grupo Y unidad. */
function groupRows(rows: ReportGroupRow[], section: string): ReportRow[] {
  return rows.flatMap((row) => {
    if (row.byUnit.length === 0) {
      // El periodo vacío SÍ sale, con cero: que un mes no aparezca haría ver
      // el año como si hubiera llegado material parejo todo el tiempo.
      return [blank({ section, concept: row.label, detail: row.hint, lots: 0, quantity: 0 })];
    }

    return row.byUnit.map((total) =>
      blank({
        section,
        concept: row.label,
        detail: row.hint,
        receipts: row.receipts ?? "",
        lots: total.lots,
        quantity: total.quantity,
        unit: UNIT_SHORT_LABELS[total.unit],
      }),
    );
  });
}

/**
 * Guía por guía Y TELA POR TELA: el respaldo de todas las cifras de arriba.
 *
 * Un renglón por (recepción, tela, unidad) y no uno por recepción. Con una
 * guía que trajo gabardina y mezclilla, el renglón único decía el total
 * sumado y no cuánto fue de cada una —que es lo que se compara contra la
 * factura—. Así además la hoja se puede pivotear por la columna "Material"
 * sin salirse de esta sección.
 *
 * Las cantidades siguen cuadrando: sumar los renglones de una guía da su
 * total, y sumar los de una unidad da el del resumen.
 */
function detailRows(report: ReceiptReportData): ReportRow[] {
  return report.detail.flatMap((receipt) => {
    const detail = [
      receipt.guideNumber ? `guía ${receipt.guideNumber}` : "sin guía",
      receipt.supplier?.name ?? "sin proveedor",
      receipt.carrier?.name ?? "sin paquetería",
      // El dueño sale de los ROLLOS: en una guía compartida el encabezado va
      // vacío a propósito y leerlo de ahí diría "de la fábrica" sobre tela
      // que sí tiene dueño.
      receipt.ownerNames.join(" y ") || "De la fábrica",
    ]
      .filter(Boolean)
      .join(" · ");

    // Una guía sin rollos es un encabezado huérfano —casi siempre una captura
    // que se interrumpió—. Sale igual, con cero: omitirla la escondería.
    if (receipt.materials.length === 0) {
      return [blank({
        section: "Detalle por recepción",
        concept: receipt.code,
        detail,
        date: receipt.date,
        receipts: 1,
        lots: 0,
      })];
    }

    return receipt.materials.map((material, index) =>
      blank({
        section: "Detalle por recepción",
        concept: receipt.code,
        material: `${material.name}${material.code ? ` (${material.code})` : ""}`,
        detail,
        date: receipt.date,
        // Sólo en el primer renglón: una guía con dos telas ocupa dos líneas,
        // y contarla en las dos haría que la columna sume el doble de guías
        // de las que llegaron.
        receipts: index === 0 ? 1 : "",
        lots: material.lots,
        quantity: material.quantity,
        unit: UNIT_SHORT_LABELS[material.unit],
      }),
    );
  });
}

/** Un renglón con todo vacío salvo lo que se le pase. */
function blank(row: Partial<ReportRow>): ReportRow {
  return {
    section: "",
    concept: "",
    material: "",
    detail: "",
    date: "",
    receipts: "",
    lots: "",
    quantity: "",
    unit: "",
    ...row,
  };
}

/**
 * Los filtros aplicados, con NOMBRE y no con id.
 *
 * Un "clientId=clx8f2…" en la cabecera del archivo no le dice nada a quien lo
 * abre. Cuesta una consulta a los catálogos y es lo que hace legible el
 * encabezado.
 */
async function describeFilters(filters: {
  search?: string;
  materialId?: string;
  clientId?: string;
  supplierId?: string;
  carrierId?: string;
}): Promise<string[]> {
  const hasAny = Object.values(filters).some(Boolean);
  if (!hasAny) return [];

  const applied: string[] = [];
  if (filters.search) applied.push(`Búsqueda "${filters.search}"`);

  const options = await new ReceiptRepository().findFilterOptions();
  const name = (list: { id: string; name: string }[], id?: string) =>
    id ? (list.find((item) => item.id === id)?.name ?? id) : undefined;

  const labels: [string, string | undefined][] = [
    ["Tela", name(options.materials, filters.materialId)],
    ["Cliente dueño", name(options.clients, filters.clientId)],
    ["Proveedor", name(options.suppliers, filters.supplierId)],
    ["Paquetería", name(options.carriers, filters.carrierId)],
  ];

  for (const [label, value] of labels) {
    if (value) applied.push(`${label}: ${value}`);
  }

  return applied;
}
