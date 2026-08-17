import { requirePermission } from "@/lib/core/session";
import { enforceRateLimit, EXPORT_LIMIT } from "@/lib/core/rate-limit";
import { csvResponse, toCsv, type CsvColumn } from "@/lib/csv";
import { ReceiptRepository } from "@/lib/repositories/receipt.repository";
import { LOT_STATUS_LABELS, UNIT_SHORT_LABELS } from "@/lib/constants/labels";
import { formatDate } from "@/lib/utils";

/**
 * Un renglón del desglose.
 *
 * Las tres vistas —por ayudante, por material y rollo por rollo— caben en la
 * misma tabla porque Excel abre UN archivo. La columna "Sección" permite
 * filtrarlas o armar una tabla dinámica encima.
 *
 * El orden no es casual: primero AYUDANTES, que es la razón por la que se
 * exporta esto —saber a quién se le paga cuánto—, y hasta abajo el detalle
 * rollo por rollo, que es el respaldo de las dos cifras de arriba.
 */
interface ReceiptCsvRow {
  section: string;
  concept: string;
  detail: string;
  color: string;
  lots: string;
  quantity: string;
  unit: string;
}

const COLUMNS: CsvColumn<ReceiptCsvRow>[] = [
  { header: "Sección", value: (row) => row.section },
  { header: "Concepto", value: (row) => row.concept },
  { header: "Detalle", value: (row) => row.detail },
  { header: "Color", value: (row) => row.color },
  { header: "Rollos", value: (row) => row.lots },
  { header: "Cantidad", value: (row) => row.quantity },
  { header: "Unidad", value: (row) => row.unit },
];

interface LotRow {
  code: string;
  unit: string;
  status: string;
  initialQuantity: unknown;
  currentQuantity: unknown;
  shade: string | null;
  colorText: string | null;
  supplierLotNumber: string | null;
  material: { code: string; name: string; composition: string | null };
  location: { code: string } | null;
  helper: { id: string; name: string } | null;
}

/** Acumulador de una agrupación: cuántos rollos y cuánto de cada unidad. */
interface Bucket {
  key: string;
  label: string;
  detail: string;
  lots: number;
  /** Por unidad: mezclar metros con piezas daría una cifra sin significado. */
  byUnit: Map<string, number>;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  await enforceRateLimit("export:receipt", EXPORT_LIMIT);
  await requirePermission("inventory:read");

  const { code } = await params;
  const receipt = await new ReceiptRepository().findByCodeWithLots(
    decodeURIComponent(code),
  );

  if (!receipt) {
    return new Response("Recepción no encontrada", { status: 404 });
  }

  const lots = receipt.lots as unknown as LotRow[];

  const rows: ReceiptCsvRow[] = [
    ...headerRows(receipt, lots.length),
    ...helperRows(lots),
    ...materialRows(lots),
    ...colorRows(lots),
    ...detailRows(lots),
  ];

  return csvResponse(toCsv(rows, COLUMNS), `recepcion-${receipt.code}`);
}

/** El encabezado: de dónde vino la carga. Va arriba como referencia. */
function headerRows(
  receipt: {
    code: string;
    date: Date;
    guideNumber: string | null;
    carrier: { name: string } | null;
    supplier: { name: string } | null;
    client: { name: string } | null;
    origin: string | null;
    recordedBy: { name: string } | null;
  },
  lotCount: number,
): ReceiptCsvRow[] {
  const meta: [string, string][] = [
    ["Folio", receipt.code],
    ["Fecha", formatDate(receipt.date)],
    ["Guía", receipt.guideNumber ?? "—"],
    ["Paquetería", receipt.carrier?.name ?? "—"],
    ["Proveedor", receipt.supplier?.name ?? "—"],
    ["Cliente dueño", receipt.client?.name ?? "De la fábrica"],
    ["Origen", receipt.origin ?? "—"],
    ["Registró", receipt.recordedBy?.name ?? "—"],
    ["Rollos recibidos", String(lotCount)],
  ];

  return meta.map(([concept, detail]) => ({
    section: "Recepción",
    concept,
    detail,
    color: "",
    lots: "",
    quantity: "",
    unit: "",
  }));
}

/**
 * Cuánto bajó cada quien. Es la razón de ser de este archivo.
 *
 * Los rollos sin ayudante se agrupan aparte en vez de omitirse: si faltan 4
 * rollos entre lo que suman las personas y el total de la carga, hay que
 * poder ver que fue porque nadie los capturó, no porque el reporte mienta.
 */
function helperRows(lots: LotRow[]): ReceiptCsvRow[] {
  const buckets = groupBy(lots, (lot) => ({
    key: lot.helper?.id ?? "__sin__",
    label: lot.helper?.name ?? "Sin ayudante asignado",
    detail: "Bajó del camión",
  }));

  return bucketsToRows(buckets, "Ayudantes");
}

function materialRows(lots: LotRow[]): ReceiptCsvRow[] {
  const buckets = groupBy(lots, (lot) => ({
    key: lot.material.code,
    label: lot.material.name,
    detail: lot.material.code,
  }));

  return bucketsToRows(buckets, "Materiales");
}

/**
 * Por color.
 *
 * Se toma el color del rollo y, si no lo trae, se dice explícitamente: un
 * "sin color" agrupado es información —alguien no lo capturó—, mientras que
 * omitir esos rollos haría que las cantidades no cuadren con el total.
 */
function colorRows(lots: LotRow[]): ReceiptCsvRow[] {
  const buckets = groupBy(lots, (lot) => ({
    key: lot.colorText ?? "__sin__",
    label: lot.colorText ?? "Sin color capturado",
    detail: lot.shade ? `Tono ${lot.shade}` : "",
  }));

  return bucketsToRows(buckets, "Colores");
}

/** Rollo por rollo: el respaldo de todo lo de arriba. */
function detailRows(lots: LotRow[]): ReceiptCsvRow[] {
  return lots.map((lot) => ({
    section: "Detalle por rollo",
    concept: lot.code,
    detail: [
      lot.material.name,
      lot.helper ? `bajó ${lot.helper.name}` : "sin ayudante",
      lot.location ? `ubic. ${lot.location.code}` : "sin ubicación",
      lot.supplierLotNumber ? `lote ${lot.supplierLotNumber}` : "",
      LOT_STATUS_LABELS[lot.status as keyof typeof LOT_STATUS_LABELS] ?? lot.status,
    ]
      .filter(Boolean)
      .join(" · "),
    color: lot.colorText ?? "",
    lots: "1",
    quantity: String(Number(lot.initialQuantity)),
    unit: unitLabel(lot.unit),
  }));
}

/** Agrupa los rollos por la clave que devuelva `classify`. */
function groupBy(
  lots: LotRow[],
  classify: (lot: LotRow) => { key: string; label: string; detail: string },
): Bucket[] {
  const buckets = new Map<string, Bucket>();

  for (const lot of lots) {
    const { key, label, detail } = classify(lot);

    const bucket = buckets.get(key) ?? {
      key,
      label,
      detail,
      lots: 0,
      byUnit: new Map<string, number>(),
    };

    bucket.lots += 1;
    const unit = unitLabel(lot.unit);
    bucket.byUnit.set(
      unit,
      (bucket.byUnit.get(unit) ?? 0) + Number(lot.initialQuantity),
    );

    buckets.set(key, bucket);
  }

  // De mayor a menor: quien más bajó aparece primero, que es a quien se le
  // paga más y el primero que se revisa.
  return [...buckets.values()].sort((a, b) => b.lots - a.lots);
}

/**
 * Un renglón por bucket Y unidad.
 *
 * Si un ayudante bajó 300 m de tela y 40 piezas de cierre salen dos
 * renglones, no uno con "340": sumar unidades distintas da un número que no
 * significa nada y que además nadie puede pagar.
 */
function bucketsToRows(buckets: Bucket[], section: string): ReceiptCsvRow[] {
  return buckets.flatMap((bucket) =>
    [...bucket.byUnit.entries()].map(([unit, quantity]) => ({
      section,
      concept: bucket.label,
      detail: bucket.detail,
      color: "",
      lots: String(bucket.lots),
      quantity: String(quantity),
      unit,
    })),
  );
}

function unitLabel(unit: string): string {
  return (
    UNIT_SHORT_LABELS[unit as keyof typeof UNIT_SHORT_LABELS] ?? unit
  );
}
