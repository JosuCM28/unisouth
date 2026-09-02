import { requirePermission } from "@/lib/core/session";
import { enforceRateLimit, EXPORT_LIMIT } from "@/lib/core/rate-limit";
import {
  toXlsxWithNotice,
  xlsxResponse,
  type XlsxColumn,
} from "@/lib/export/xlsx";
import {
  ReceiptRepository,
  type ReceiptCardData,
} from "@/lib/repositories/receipt.repository";
import { UNIT_SHORT_LABELS } from "@/lib/constants/labels";
import { fromDateInputValue } from "@/lib/utils";

/**
 * La TABLA de recepciones tal cual se ve en pantalla, en Excel.
 *
 * Una guía por renglón, con el filtro que trae la pantalla. Es el archivo que
 * se manda por correo cuando alguien pregunta "¿qué ha llegado?" y hay que
 * contestar con una lista, no con una cifra.
 *
 * Para las sumas por periodo, tela o cliente está `/api/export/receipts/report`,
 * que es el reporte agregado. Éste no agrupa nada a propósito: quien recibe la
 * lista arma su propia tabla dinámica encima.
 */
const COLUMNS: XlsxColumn<ReceiptCardData>[] = [
  { header: "Folio", value: (r) => r.code, width: 16 },
  { header: "Fecha", value: (r) => r.date, kind: "date" },
  { header: "Guía", value: (r) => r.guideNumber ?? "", width: 18 },
  { header: "Proveedor", value: (r) => r.supplier?.name ?? "", width: 24 },
  { header: "Paquetería", value: (r) => r.carrier?.name ?? "", width: 20 },
  {
    header: "Cliente dueño",
    /* Sale de los ROLLOS y no del encabezado: una guía compartida entre dos
       clientes lo trae vacío arriba a propósito, y leerlo de ahí diría "de la
       fábrica" sobre tela que sí tiene dueño. */
    value: (r) => r.ownerNames.join(" · ") || "De la fábrica",
    width: 26,
  },
  {
    header: "Materiales",
    /* Cada tela CON SU CANTIDAD, no sólo los nombres.

       Antes decía "Gabardina · Mezclilla" junto a un único total, y sobre una
       guía de dos telas eso no contesta cuánto llegó de cada una —que es lo
       que se cuadra contra la factura—. La columna "Cantidad" sigue siendo el
       total de la guía; ésta lo reparte. */
    value: (r) => describeMaterials(r),
    width: 44,
  },
  { header: "Rollos", value: (r) => r.lotCount, kind: "number" },
  {
    header: "Cantidad",
    // Como número: lo primero que hace quien abre el archivo es seleccionar
    // la columna para ver el total, y como texto Excel no suma nada.
    value: (r) => r.totalQuantity,
    kind: "number",
  },
  { header: "Unidad", value: (r) => (r.unit ? UNIT_SHORT_LABELS[r.unit] : "") },
  {
    header: "Otras unidades",
    /* Una guía que trae metros Y kilos no cabe en una sola cifra —sumarlos
       daría un número que no significa nada—, pero tampoco puede perderse.
       La cantidad de arriba es la unidad principal; el resto se escribe aquí
       para que el renglón siga siendo el total real de lo que llegó. */
    value: (r) => describeExtraUnits(r),
    width: 22,
  },
  { header: "Factura", value: (r) => r.invoiceRef ?? "" },
  { header: "Pedido", value: (r) => r.orderRef ?? "" },
  { header: "Origen", value: (r) => r.origin ?? "", width: 20 },
  { header: "Bultos", value: (r) => r.packageCount ?? "", kind: "number" },
  {
    header: "Peso total (kg)",
    value: (r) => (r.totalWeightKg === null ? "" : Number(r.totalWeightKg)),
    kind: "number",
  },
  { header: "Registró", value: (r) => r.recordedBy?.name ?? "", width: 22 },
  { header: "Notas", value: (r) => r.notes ?? "", width: 40 },
];

export async function GET(request: Request) {
  // Recorre la tabla completa: sin límite es un vector de denegación.
  await enforceRateLimit("export:receipts", EXPORT_LIMIT);
  await requirePermission("inventory:browse");

  const params = new URL(request.url).searchParams;

  /* Los MISMOS filtros que la pantalla. Si el archivo trajera la lista
     completa mientras la pantalla muestra un filtro, quien lo recibe no
     tendría forma de notarlo: el Excel se ve igual de correcto. */
  const { items } = await new ReceiptRepository().findAllForExport({
    search: params.get("q") ?? undefined,
    materialId: params.get("materialId") ?? undefined,
    clientId: params.get("clientId") ?? undefined,
    supplierId: params.get("supplierId") ?? undefined,
    carrierId: params.get("carrierId") ?? undefined,
    arrivedWithinDays: parsePositiveInt(params.get("arrivedWithin")),
    // El reporte manda su rango por aquí también: así el mismo filtro sirve
    // para las dos descargas.
    ...parseRange(params.get("desde"), params.get("hasta")),
  });

  return xlsxResponse(
    toXlsxWithNotice(items, COLUMNS, "Recepciones"),
    "recepciones",
  );
}

/** "Gabardina Oviedo 1,200 m · Mezclilla Santa fe 800 m". */
function describeMaterials(receipt: ReceiptCardData): string {
  return receipt.materials
    .map(
      (material) =>
        `${material.name} ${material.quantity.toLocaleString("es-MX")} ${UNIT_SHORT_LABELS[material.unit]}`,
    )
    .join(" · ");
}

/** "1,240 kg · 300 yd": todo lo que no cabe en la cantidad principal. */
function describeExtraUnits(receipt: ReceiptCardData): string {
  return receipt.byUnit
    .slice(1)
    .map(
      (total) =>
        `${total.quantity.toLocaleString("es-MX")} ${UNIT_SHORT_LABELS[total.unit]}`,
    )
    .join(" · ");
}

/** Entero positivo o nada. El valor viene de la URL y puede ser cualquier cosa. */
function parsePositiveInt(value: string | null): number | undefined {
  if (!value) return undefined;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) return undefined;
  return parsed;
}

/**
 * El rango de fechas, sólo si viene completo y con forma de fecha.
 *
 * Se parsea aquí y no con `parseReportRange` a propósito: aquélla RELLENA con
 * el año corrido cuando falta un extremo, que es lo correcto para un reporte
 * —siempre tiene un periodo— pero no para esta lista: sin filtro de fechas en
 * pantalla, el archivo debe traer el histórico completo, no los últimos doce
 * meses recortados en silencio.
 */
function parseRange(
  desde: string | null,
  hasta: string | null,
): { from?: Date; to?: Date } {
  return {
    from: parseDate(desde, "start"),
    to: parseDate(hasta, "end"),
  };
}

function parseDate(
  value: string | null,
  edge: "start" | "end",
): Date | undefined {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  return fromDateInputValue(value, edge);
}
