import { NotFoundError } from "@/lib/core/errors";
import type { PrismaExecutor } from "@/lib/prisma";
import type { PackingListSheetInput } from "@/lib/validations/packing-list-sheet.schema";
import { BaseService } from "./base.service";

/**
 * Guarda el packing list editado de un pedido.
 *
 * Es papelería: no lee ni escribe existencias, cajas ni kárdex. Por eso se
 * puede corregir aunque el pedido ya esté cerrado —el camión ya salió, pero
 * el color mal escrito en la hoja se tiene que poder arreglar— y cada
 * guardado queda en la auditoría con lo que había antes.
 */
export class PackingListSheetService extends BaseService {
  async save(input: PackingListSheetInput): Promise<{ id: string }> {
    return this.transaction(async (tx) => {
      const order = await tx.packingOrder.findUnique({
        where: { id: input.orderId },
        select: { id: true, code: true },
      });
      if (!order) throw new NotFoundError("el pedido de empaque");

      const before = await this.snapshot(tx, input.orderId);
      const sheet = await this.upsertHeader(tx, input);
      await this.replaceBody(tx, sheet.id, input);

      await this.auditWith(tx).record({
        entity: "PackingListSheet", entityId: sheet.id, action: before ? "UPDATE" : "CREATE",
        reference: order.code, oldValue: before, newValue: summarize(input), sensitivity: "LOW",
      });
      return { id: sheet.id };
    });
  }

  private async upsertHeader(tx: PrismaExecutor, input: PackingListSheetInput) {
    const header = {
      formatCode: input.formatCode,
      revision: input.revision,
      client: input.client,
      date: input.date,
      preparedBy: input.preparedBy ?? null,
      reviewedBy: input.reviewedBy ?? null,
      receivedBy: input.receivedBy ?? null,
      notes: input.notes ?? null,
      updatedById: this.context.userId ?? null,
    };
    return tx.packingListSheet.upsert({
      where: { orderId: input.orderId },
      create: { orderId: input.orderId, ...header },
      update: header,
      select: { id: true },
    });
  }

  /**
   * Renglones y cajas se reescriben completos: la hoja es un documento que se
   * guarda entero, como se ve en pantalla. Ir renglón por renglón obligaría a
   * reconciliar altas, bajas y cambios de orden que el usuario ya resolvió.
   */
  private async replaceBody(tx: PrismaExecutor, sheetId: string, input: PackingListSheetInput) {
    await tx.packingListSheetLine.deleteMany({ where: { sheetId } });
    await tx.packingListSheetBox.deleteMany({ where: { sheetId } });

    await tx.packingListSheetLine.createMany({
      data: input.lines.map((line, position) => ({
        sheetId,
        position,
        stockId: line.stockId ?? null,
        orderRef: line.orderRef ?? null,
        destination: line.destination ?? null,
        description: line.description,
        color: line.color ?? null,
        boxNumber: line.boxNumber ?? null,
        size: line.size ?? null,
        quantity: line.quantity,
      })),
    });

    // Una caja sin peso ni medidas no dice nada: no se guarda.
    const boxes = input.boxes.filter((box) => box.weightKg !== undefined || box.dimensions);
    if (boxes.length === 0) return;
    await tx.packingListSheetBox.createMany({
      data: boxes.map((box) => ({
        sheetId,
        boxNumber: box.boxNumber,
        weightKg: box.weightKg ?? null,
        dimensions: box.dimensions ?? null,
      })),
    });
  }

  private async snapshot(tx: PrismaExecutor, orderId: string) {
    const sheet = await tx.packingListSheet.findUnique({
      where: { orderId },
      select: {
        client: true, date: true, preparedBy: true, reviewedBy: true, receivedBy: true,
        lines: { select: { quantity: true } },
      },
    });
    if (!sheet) return null;
    const { lines, ...header } = sheet;
    return { ...header, lines: lines.length, pieces: lines.reduce((sum, line) => sum + line.quantity, 0) };
  }
}

/** Para la auditoría basta el encabezado y los totales, no 300 renglones. */
function summarize(input: PackingListSheetInput) {
  return {
    client: input.client,
    date: input.date,
    preparedBy: input.preparedBy ?? null,
    reviewedBy: input.reviewedBy ?? null,
    receivedBy: input.receivedBy ?? null,
    lines: input.lines.length,
    pieces: input.lines.reduce((sum, line) => sum + line.quantity, 0),
  };
}
