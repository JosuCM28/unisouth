import type { Receipt } from "@prisma/client";
import type { ReceiptInput } from "@/lib/validations/receipt.schema";
import { BaseService } from "./base.service";
import { InventoryService } from "./inventory.service";

export interface ReceiptResult {
  receipt: Receipt;
  lotCodes: string[];
}

/**
 * Recepción de mercancía: la carga que llega en el camión.
 *
 * Da de alta N rollos de golpe y los cuelga todos de la misma recepción, para
 * que después se pueda rastrear "todo lo que vino en esa guía".
 */
export class ReceiptService extends BaseService {
  private get inventory(): InventoryService {
    return new InventoryService(this.context);
  }

  async create(input: ReceiptInput): Promise<ReceiptResult> {
    return this.transaction(async (tx) => {
      const sequences = this.sequencesWith(tx);
      const code = await sequences.next("RECEIPT", "REC", 4);

      const receipt = await tx.receipt.create({
        data: {
          code,
          date: input.date,
          guideNumber: input.guideNumber,
          carrierId: input.carrierId,
          origin: input.origin,
          supplierId: input.supplierId,
          clientId: input.clientId,
          invoiceRef: input.invoiceRef,
          orderRef: input.orderRef,
          packageCount: input.packageCount,
          notes: input.notes,
          recordedById: this.context.userId,
        },
      });

      const lotCodes: string[] = [];

      for (const lotInput of input.lots) {
        const lotCode = await sequences.next("LOT", "R", 5);

        const lot = await tx.lot.create({
          data: {
            code: lotCode,
            materialId: lotInput.materialId,
            receiptId: receipt.id,
            // El dueño se hereda del encabezado: toda la carga de una guía
            // suele ser del mismo cliente.
            clientId: input.clientId,
            locationId: lotInput.locationId,
            unit: lotInput.unit,
            initialQuantity: lotInput.quantity,
            // Nace en cero: el saldo lo pone el movimiento, nunca una
            // escritura directa.
            currentQuantity: 0,
            shade: lotInput.shade,
            supplierLotNumber: lotInput.supplierLotNumber,
            colorText: lotInput.colorText,
            actualWidthMm: lotInput.actualWidthMm,
            measurementSource: lotInput.measurementSource,
            receivedAt: input.date,
            comment: lotInput.comment,
            createdById: this.context.userId,
          },
        });

        await this.inventory.applyMovementWithin(tx, {
          lotId: lot.id,
          type: "RECEIPT_INITIAL",
          quantity: lotInput.quantity,
          toLocationId: lotInput.locationId,
          reason: `Recepción ${code}`,
        });

        lotCodes.push(lotCode);
      }

      await this.auditWith(tx).record({
        entity: "Receipt",
        entityId: receipt.id,
        action: "CREATE",
        reference: code,
        newValue: { code, guideNumber: input.guideNumber, lots: lotCodes.length },
        sensitivity: "MEDIUM",
      });

      return { receipt, lotCodes };
    });
  }
}
