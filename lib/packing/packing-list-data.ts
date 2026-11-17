import type { PackingOrderDetail } from "@/lib/repositories/packing.repository";
import type { PackingListSheetRow } from "@/lib/repositories/packing-list-sheet.repository";
import type { PackingListSheetInput } from "@/lib/validations/packing-list-sheet.schema";

/**
 * Lo que dice un packing list, venga de donde venga: lo que alguien guardó
 * editado o lo que sale de las cajas tal cual. El Excel, el PDF y la
 * pantalla leen esto y no saben cuál de los dos fue.
 */
export type PackingListData = Omit<PackingListSheetInput, "orderId">;

/** El formato de calidad de la hoja de papel que esto reemplaza. */
export const DEFAULT_FORMAT_CODE = "F12-POP01";
export const DEFAULT_REVISION = "REV:2 20 MAY13";

/**
 * El packing list como sale de las cajas, sin tocar: un renglón por cada
 * prenda de cada caja, en el orden de las cajas.
 *
 * Color y destino van vacíos porque el sistema no los sabe; la descripción
 * es el nombre del producto y la orden, la PO.
 */
export function dataFromOrder(order: PackingOrderDetail, preparedBy: string | null): PackingListData {
  const lines = order.boxes.flatMap((box) =>
    [...box.lines]
      .sort((a, b) =>
        a.stock.product.name.localeCompare(b.stock.product.name) ||
        a.stock.size.order - b.stock.size.order)
      .map((line) => ({
        stockId: line.stock.id,
        orderRef: line.stock.clientPo ?? undefined,
        destination: undefined,
        description: line.stock.product.name,
        color: undefined,
        boxNumber: box.number,
        size: line.stock.size.code,
        quantity: line.quantity,
      })),
  );

  return {
    formatCode: DEFAULT_FORMAT_CODE,
    revision: DEFAULT_REVISION,
    client: defaultClient(order),
    date: order.date,
    preparedBy: preparedBy?.toUpperCase() ?? undefined,
    reviewedBy: undefined,
    receivedBy: undefined,
    notes: undefined,
    lines,
    boxes: [],
  };
}

/** Lo guardado, con los `null` de la base vueltos `undefined` del esquema. */
export function dataFromSheet(sheet: PackingListSheetRow): PackingListData {
  return {
    formatCode: sheet.formatCode,
    revision: sheet.revision,
    client: sheet.client,
    date: sheet.date,
    preparedBy: sheet.preparedBy ?? undefined,
    reviewedBy: sheet.reviewedBy ?? undefined,
    receivedBy: sheet.receivedBy ?? undefined,
    notes: sheet.notes ?? undefined,
    lines: sheet.lines.map((line) => ({
      stockId: line.stockId ?? undefined,
      orderRef: line.orderRef ?? undefined,
      destination: line.destination ?? undefined,
      description: line.description,
      color: line.color ?? undefined,
      boxNumber: line.boxNumber ?? undefined,
      size: line.size ?? undefined,
      quantity: line.quantity,
    })),
    // El Decimal se queda aquí: a la pantalla y al papel viaja como número.
    boxes: sheet.boxes.map((box) => ({
      boxNumber: box.boxNumber,
      weightKg: box.weightKg === null ? undefined : Number(box.weightKg),
      dimensions: box.dimensions ?? undefined,
    })),
  };
}

/**
 * El cliente del encabezado: el del pedido; sin él, los dueños de lo
 * empacado ("TENARIS / TENARIS SHAWCOR"), para que nadie lea un embarque sin
 * dueño cuando sí lo tiene.
 */
function defaultClient(order: PackingOrderDetail): string {
  if (order.client) return order.client.name;
  const owners = new Set(
    order.boxes.flatMap((box) => box.lines.flatMap((line) => (line.stock.client ? [line.stock.client.name] : []))),
  );
  return [...owners].sort((a, b) => a.localeCompare(b)).join(" / ") || "SIN CLIENTE";
}

/** Las piezas que de verdad hay en las cajas, para avisar si la hoja ya no cuadra. */
export function piecesInBoxes(order: PackingOrderDetail): number {
  return order.boxes.reduce((sum, box) => sum + box.lines.reduce((acc, line) => acc + line.quantity, 0), 0);
}
