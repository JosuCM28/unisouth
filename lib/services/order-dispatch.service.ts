import { sumBundlePieces } from "@/lib/bundles";
import { cutBatchLabel } from "@/lib/constants/labels";
import { BusinessRuleError, NotFoundError } from "@/lib/core/errors";
import type { PrismaExecutor } from "@/lib/prisma";
import {
  OrderDispatchRepository,
  orderVoucherWhere,
  type DispatchShipmentRow,
  type DispatchVoucherRow,
} from "@/lib/repositories/order-dispatch.repository";
import type {
  DispatchKind,
  MarkOrderDispatchedInput,
} from "@/lib/validations/order-dispatch.schema";
import { BaseService } from "./base.service";

export interface DispatchOption {
  kind: DispatchKind;
  id: string;
  code: string;
  title: string;
  detail: string | null;
  pieces: number;
  bundles: number;
  dispatchedAt: Date | null;
  dispatchedByName: string | null;
  /** Por qué no se puede marcar todavía. Vacío = se puede. */
  blockedReason: string | null;
}

const VOUCHER_STAGE_LABEL = "Salida de corte";
const NO_DESTINATION_LABEL = "sin taller";

/**
 * Marca lo que de verdad salió de la planta de corte.
 *
 * Capturar un envío y que el corte se vaya son dos momentos distintos: entre
 * uno y otro el corte sigue aquí, esperando a que vengan por él.
 */
export class OrderDispatchService extends BaseService {
  private readonly repository = new OrderDispatchRepository();

  async optionsFor(orderId: string): Promise<DispatchOption[]> {
    const [shipments, vouchers] = await Promise.all([
      this.repository.findShipments(orderId),
      this.repository.findVouchers(orderId),
    ]);

    return [...shipments.map(toShipmentOption), ...vouchers.map(toVoucherOption)];
  }

  /** Todo o nada: media selección marcada no diría qué se subió al camión. */
  async markDispatched(
    input: MarkOrderDispatchedInput,
  ): Promise<{ count: number }> {
    return this.transaction(async (tx) => {
      for (const item of input.items) {
        if (item.kind === "shipment") {
          await this.dispatchShipment(tx, input.orderId, item.id);
        } else {
          await this.dispatchVoucher(tx, input.orderId, item.id);
        }
      }

      return { count: input.items.length };
    });
  }

  private async dispatchShipment(
    tx: PrismaExecutor,
    orderId: string,
    id: string,
  ) {
    const shipment = await tx.garmentShipment.findFirst({
      where: { id, orderId },
      select: {
        code: true,
        status: true,
        dispatchedAt: true,
        document: { select: { status: true } },
      },
    });
    if (!shipment) throw new NotFoundError("el envío", id);

    const cancelled =
      shipment.status === "CANCELLED" ||
      shipment.document?.status === "CANCELLED";

    if (cancelled) {
      throw new BusinessRuleError(`El envío ${shipment.code} está cancelado.`);
    }
    this.assertNotDispatched(shipment);

    await tx.garmentShipment.update({
      where: { id },
      data: { dispatchedAt: new Date(), dispatchedById: this.context.userId },
    });
    await this.auditDispatch(tx, "GarmentShipment", id, shipment.code);
  }

  private async dispatchVoucher(
    tx: PrismaExecutor,
    orderId: string,
    id: string,
  ) {
    const voucher = await tx.inventoryDocument.findFirst({
      where: { id, ...orderVoucherWhere(orderId) },
      select: { code: true, status: true, dispatchedAt: true },
    });
    if (!voucher) throw new NotFoundError("el vale", id);

    /* Un borrador todavía se puede corregir o cancelar: decir que ya salió
       daría por entregado un papel que aún no existe del todo. */
    if (voucher.status !== "APPLIED") {
      throw new BusinessRuleError(
        `El vale ${voucher.code} no está aplicado. Aplícalo antes de enviarlo.`,
      );
    }
    this.assertNotDispatched(voucher);

    await tx.inventoryDocument.update({
      where: { id },
      data: { dispatchedAt: new Date(), dispatchedById: this.context.userId },
    });
    await this.auditDispatch(tx, "InventoryDocument", id, voucher.code);
  }

  /** Marcarlo dos veces le cambiaría la fecha a algo que ya salió. */
  private assertNotDispatched(row: {
    code: string;
    dispatchedAt: Date | null;
  }) {
    if (row.dispatchedAt) {
      throw new BusinessRuleError(`${row.code} ya estaba marcado como enviado.`);
    }
  }

  private async auditDispatch(
    tx: PrismaExecutor,
    entity: string,
    entityId: string,
    code: string,
  ) {
    await this.auditWith(tx).record({
      entity,
      entityId,
      action: "UPDATE",
      reference: code,
      newValue: { enviado: true },
      sensitivity: "LOW",
    });
  }
}

function toShipmentOption(row: DispatchShipmentRow): DispatchOption {
  return {
    kind: "shipment",
    id: row.id,
    code: row.code,
    title: `${row.stage.name} · ${row.workshop.name}`,
    detail: null,
    pieces: sumBundlePieces(
      row.lines.map((line) => ({
        quantity: line.sentQuantity,
        bundles: line.bundles,
      })),
    ),
    bundles: row.lines.reduce((sum, line) => sum + line.bundles, 0),
    dispatchedAt: row.dispatchedAt,
    dispatchedByName: row.dispatchedBy?.name ?? null,
    blockedReason: null,
  };
}

function toVoucherOption(row: DispatchVoucherRow): DispatchOption {
  const destination =
    row.workshop?.name ?? row.receivedBy ?? NO_DESTINATION_LABEL;

  return {
    kind: "voucher",
    id: row.id,
    code: row.code,
    title: `${VOUCHER_STAGE_LABEL} · ${destination}`,
    detail: row.cuttingBatch
      ? cutBatchLabel(row.cuttingBatch.number, row.cuttingBatch.label)
      : null,
    pieces: sumBundlePieces(row.cutLines),
    bundles: row.cutLines.reduce((sum, line) => sum + line.bundles, 0),
    dispatchedAt: row.dispatchedAt,
    dispatchedByName: row.dispatchedBy?.name ?? null,
    blockedReason: row.status === "APPLIED" ? null : "Aplícala primero",
  };
}
