import type { Receipt } from "@prisma/client";
import type {
  ReceiptInput,
  UpdateReceiptInput,
} from "@/lib/validations/receipt.schema";
import type { PrismaExecutor } from "@/lib/prisma";
import { NotFoundError } from "@/lib/core/errors";
import { BaseService } from "./base.service";
import { InventoryService } from "./inventory.service";

export interface ReceiptResult {
  receipt: Receipt;
  lotCodes: string[];
}

export interface ReceiptUpdateResult {
  receipt: Receipt;
  /** Rollos a los que SÍ se les heredó el nuevo dueño. */
  reassignedLotCodes: string[];
  /** Rollos que conservaron su dueño por estar ya en uso. */
  keptLotCodes: string[];
}

/** Campos del encabezado que se auditan al corregir. */
const HEADER_FIELDS = [
  "date",
  "guideNumber",
  "carrierId",
  "origin",
  "supplierId",
  "clientId",
  "invoiceRef",
  "orderRef",
  "packageCount",
  "notes",
] as const;

function pickHeader(receipt: Receipt): Record<string, unknown> {
  return Object.fromEntries(
    HEADER_FIELDS.map((field) => [field, receipt[field]]),
  );
}

/**
 * El dueño de la guía, si TODOS sus rollos son del mismo.
 *
 * `undefined` cuando vienen de dos clientes: una carga compartida no tiene un
 * dueño, y guardar el del primer rollo haría que la tarjeta y el filtro de
 * recepciones afirmaran algo falso. El dato de verdad vive en cada rollo.
 */
function singleOwner(lots: { clientId?: string }[]): string | undefined {
  const owners = new Set(lots.map((lot) => lot.clientId ?? ""));
  if (owners.size !== 1) return undefined;

  // El único dueño, o `undefined` si ese único valor es "de la fábrica".
  const [owner] = [...owners];
  return owner || undefined;
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

  /**
   * Corrige los datos de la carga de una recepción ya guardada.
   *
   * Existe porque el encabezado se captura de prisa, con el camión enfrente:
   * la factura o el número de bultos llegan después, y sin esto la única
   * salida era recapturar la recepción entera.
   *
   * NO toca los rollos ni sus saldos —eso sigue siendo territorio exclusivo
   * de `InventoryService`—, con una sola excepción acotada: el dueño.
   */
  async update(input: UpdateReceiptInput): Promise<ReceiptUpdateResult> {
    return this.transaction(async (tx) => {
      const before = await tx.receipt.findUnique({ where: { id: input.id } });
      if (!before) throw new NotFoundError("la recepción", input.id);

      const receipt = await tx.receipt.update({
        where: { id: input.id },
        data: {
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
        },
      });

      const ownerChanged = before.clientId !== receipt.clientId;
      const { reassignedLotCodes, keptLotCodes } = ownerChanged
        ? await this.propagateOwner(tx, receipt.id, receipt.clientId)
        : { reassignedLotCodes: [], keptLotCodes: [] };

      /* Cambiar el dueño mueve material entre clientes, así que sube a HIGH y
         sale destacado en el tablero de auditoría. Una corrección de factura o
         de bultos no merece ese ruido y se queda en MEDIUM. */
      await this.auditWith(tx).record({
        entity: "Receipt",
        entityId: receipt.id,
        action: "UPDATE",
        reference: receipt.code,
        oldValue: pickHeader(before),
        newValue: pickHeader(receipt),
        sensitivity: ownerChanged ? "HIGH" : "MEDIUM",
        reason: input.reason,
      });

      return { receipt, reassignedLotCodes, keptLotCodes };
    });
  }

  /**
   * Hereda el nuevo dueño a los rollos de la recepción que siguen intactos.
   *
   * "Intacto" = nadie lo ha tocado: conserva su metraje completo y no tiene
   * reservas. Un rollo del que ya se cortó o que está apartado para una orden
   * NO se reasigna: su tela ya se mezcló con la producción de alguien, y
   * cambiarle el dueño a toro pasado falsearía a quién se le surtió.
   *
   * Los que quedan fuera se devuelven para poder decírselo al usuario en vez
   * de dejar la recepción en un estado que no coincide con sus rollos.
   */
  private async propagateOwner(
    tx: PrismaExecutor,
    receiptId: string,
    clientId: string | null | undefined,
  ): Promise<{ reassignedLotCodes: string[]; keptLotCodes: string[] }> {
    const lots = await tx.lot.findMany({
      where: { receiptId },
      select: {
        id: true,
        code: true,
        clientId: true,
        initialQuantity: true,
        currentQuantity: true,
        reservedQuantity: true,
      },
    });

    /* Una guía COMPARTIDA no se toca. Si sus rollos ya están repartidos entre
       dos clientes, bajarles el dueño del encabezado aplastaría de un golpe la
       separación que alguien capturó rollo por rollo —y separar el material por
       dueño es la regla que sostiene todo lo demás—. Se devuelven todos como
       "conservados" para poder decírselo al usuario: aquí el dueño se corrige
       en la ficha de cada rollo. */
    const owners = new Set(lots.map((lot) => lot.clientId ?? ""));
    if (owners.size > 1) {
      return { reassignedLotCodes: [], keptLotCodes: lots.map((l) => l.code) };
    }

    const intact = lots.filter(
      (lot) =>
        lot.currentQuantity.equals(lot.initialQuantity) &&
        lot.reservedQuantity.isZero(),
    );
    const intactIds = new Set(intact.map((lot) => lot.id));

    if (intact.length > 0) {
      await tx.lot.updateMany({
        where: { id: { in: intact.map((lot) => lot.id) } },
        data: { clientId: clientId ?? null },
      });
    }

    return {
      reassignedLotCodes: intact.map((lot) => lot.code),
      keptLotCodes: lots
        .filter((lot) => !intactIds.has(lot.id))
        .map((lot) => lot.code),
    };
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
          // El dueño de la GUÍA se deduce de sus rollos, no se captura.
          clientId: singleOwner(input.lots),
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
            /* El dueño es de ESTE rollo. Antes se heredaba del encabezado, y
               una guía que traía tela de dos clientes quedaba toda a nombre de
               uno: material del cliente equivocado listo para surtirse a la
               producción de otro, que es el error que no se puede cometer. */
            clientId: lotInput.clientId,
            locationId: lotInput.locationId,
            // Quien lo bajó: sostiene el cálculo de su bonificación.
            helperId: lotInput.helperId,
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
