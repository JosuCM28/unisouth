import type { Workshop } from "@prisma/client";
import { sumBundlePieces } from "@/lib/bundles";
import { CUT_VERSION_LABELS } from "@/lib/constants/labels";
import type { WorkshopDeliveryState } from "@/lib/constants/workshop-access";
import {
  BusinessRuleError,
  ForbiddenError,
  NotFoundError,
} from "@/lib/core/errors";
import type { PrismaExecutor } from "@/lib/prisma";
import {
  WORKSHOP_DELIVERY_LIMIT,
  WorkshopDeliveryRepository,
  type WorkshopDeliveryDetailRow,
  type WorkshopDeliveryListRow,
} from "@/lib/repositories/workshop-delivery.repository";
import type { WorkshopInput } from "@/lib/validations/garment-shipment.schema";
import { deliveryState } from "@/lib/workshop-delivery";
import { BaseService } from "./base.service";

export interface WorkshopDeliveryRow {
  id: string;
  code: string;
  state: WorkshopDeliveryState;
  orderReference: string;
  clientName: string;
  description: string;
  stageName: string;
  parts: string | null;
  sentAt: Date;
  pieces: number;
  bundles: number;
}

export interface WorkshopDeliveryList {
  workshopName: string;
  rows: WorkshopDeliveryRow[];
  pending: number;
  /** La lista llegó al tope: la pantalla lo dice en vez de callarlo. */
  truncated: boolean;
}

/**
 * Lo cancelado viaja SIN sus datos: "no la podrán ver" se cumple desde aquí, no
 * escondiéndola en la pantalla.
 */
export interface CancelledWorkshopDelivery {
  state: "CANCELLED";
  code: string;
}

export interface ActiveWorkshopDelivery {
  state: "PENDING" | "RECEIVED";
  id: string;
  code: string;
  voucherId: string | null;
  voucherCode: string | null;
  sentAt: Date;
  stageName: string;
  parts: string | null;
  reference: string | null;
  notes: string | null;
  receivedAt: Date | null;
  receivedByName: string | null;
  pieces: number;
  bundles: number;
  lines: {
    id: string;
    sizeCode: string;
    sentQuantity: number;
    bundles: number;
    notes: string | null;
    tag: { name: string; color: string } | null;
  }[];
  order: {
    reference: string;
    clientPo: string | null;
    clientName: string;
    description: string | null;
    dueDate: Date | null;
    notes: string | null;
    fabric: string | null;
    pattern: string | null;
    version: string | null;
    versionNotes: string | null;
    cutNotes: string[];
  };
  cuts: DeliveryCut[];
}

export type WorkshopDeliveryDetail =
  | CancelledWorkshopDelivery
  | ActiveWorkshopDelivery;

interface DeliveryCut {
  id: string;
  number: number;
  label: string | null;
  notes: string | null;
  openedAt: Date;
  /* Vacío a propósito: quién capturó en la mesa no es asunto del taller. */
  openedByName: null;
  groupId: string | null;
  entries: DeliveryCutEntry[];
  /* Vacío: las salidas de la orden a otros destinos tampoco salen de la casa. */
  issues: [];
}

interface DeliveryCutEntry {
  id: string;
  lineId: string;
  sizeId: string;
  sizeCode: string;
  quantity: number;
  bundles: number;
  tagId: string | null;
  createdAt: Date;
  userName: null;
  notes: string | null;
  note: string | null;
  tag: { name: string; color: string } | null;
}

const NO_CLIENT_LABEL = "Fábrica";
const NO_DESCRIPTION_LABEL = "Sin descripción";

/**
 * Lo que un taller externo ve y confirma de lo que se le manda.
 *
 * La regla que manda en todo el archivo: el taller lo decide el ROL de quien
 * entra, nunca un identificador que venga del navegador. Una entrega de otro
 * taller se contesta como si no existiera.
 */
export class WorkshopDeliveryService extends BaseService {
  private readonly repository = new WorkshopDeliveryRepository();

  /** `null` = ese rol todavía no está ligado a ningún taller del catálogo. */
  async listForRole(role: string): Promise<WorkshopDeliveryList | null> {
    const workshop = await this.repository.findWorkshopByRole(role);
    if (!workshop) return null;

    const rows = (await this.repository.findList(workshop)).map(toListRow);

    return {
      workshopName: workshop.name,
      rows,
      pending: rows.filter((row) => row.state === "PENDING").length,
      truncated: rows.length >= WORKSHOP_DELIVERY_LIMIT,
    };
  }

  async detailForRole(
    role: string,
    id: string,
  ): Promise<WorkshopDeliveryDetail | null> {
    const workshop = await this.repository.findWorkshopByRole(role);
    if (!workshop) return null;

    const row = await this.repository.findDetail(workshop, id);
    return row ? toDetail(row) : null;
  }

  /** La reimpresión: sólo su propio vale, y sólo mientras siga vigente. */
  async assertCanPrint(role: string, documentId: string): Promise<void> {
    const workshop = await this.repository.findWorkshopByRole(role);
    const shipment = workshop
      ? await this.repository.findByDocument(workshop, documentId)
      : null;

    if (!shipment || stateOf(shipment) === "CANCELLED") {
      throw new ForbiddenError("No puedes imprimir este vale.");
    }
  }

  /**
   * El taller confirma que le llegó.
   *
   * Sin deshacer para el taller: "ya está allá" es lo que la casa va a dar por
   * cierto, y si se pudiera apagar y prender dejaría de significar algo.
   */
  async confirmReceipt(id: string, role: string): Promise<{ code: string }> {
    return this.transaction(async (tx) => {
      const workshop = await tx.workshop.findFirst({
        where: { accessRole: role, deletedAt: null },
        select: { id: true, name: true, accessSince: true },
      });
      if (!workshop) throw new NotFoundError("la entrega", id);

      const shipment = await tx.garmentShipment.findFirst({
        where: {
          id,
          workshopId: workshop.id,
          createdAt: workshop.accessSince
            ? { gte: workshop.accessSince }
            : undefined,
        },
        select: {
          code: true,
          status: true,
          receivedAt: true,
          document: { select: { status: true } },
        },
      });
      if (!shipment) throw new NotFoundError("la entrega", id);

      this.assertReceivable(shipment);

      await tx.garmentShipment.update({
        where: { id },
        data: { receivedAt: new Date(), receivedById: this.context.userId },
      });

      await this.auditWith(tx).record({
        entity: "GarmentShipment",
        entityId: id,
        action: "UPDATE",
        reference: shipment.code,
        newValue: { recibido: true, taller: workshop.name },
        sensitivity: "LOW",
      });

      return { code: shipment.code };
    });
  }

  private assertReceivable(
    shipment: Parameters<typeof stateOf>[0] & { code: string },
  ) {
    const state = stateOf(shipment);

    if (state === "CANCELLED") {
      throw new BusinessRuleError(
        `La entrega ${shipment.code} fue cancelada.`,
      );
    }
    if (state === "RECEIVED") {
      throw new BusinessRuleError(
        `La entrega ${shipment.code} ya estaba marcada como recibida.`,
      );
    }
  }

  async createWorkshop(input: WorkshopInput): Promise<Workshop> {
    return this.transaction(async (tx) => {
      await this.assertRoleFree(tx, input.accessRole);

      const workshop = await tx.workshop.create({
        data: {
          ...input,
          accessSince: input.accessRole ? new Date() : null,
        },
      });

      if (input.accessRole) {
        await this.auditAccess(tx, workshop, null, input.accessRole);
      }

      return workshop;
    });
  }

  async updateWorkshop(id: string, input: WorkshopInput): Promise<Workshop> {
    return this.transaction(async (tx) => {
      const current = await tx.workshop.findUnique({ where: { id } });
      if (!current) throw new NotFoundError("el taller", id);

      await this.assertRoleFree(tx, input.accessRole, id);

      const accessChanged = current.accessRole !== input.accessRole;

      /* La fecha sólo se mueve si cambió la cuenta: editar el teléfono del
         taller no debe esconderle lo que ya le habían mandado. */
      const workshop = await tx.workshop.update({
        where: { id },
        data: {
          ...input,
          ...(accessChanged && {
            accessSince: input.accessRole ? new Date() : null,
          }),
        },
      });

      if (accessChanged) {
        await this.auditAccess(tx, workshop, current.accessRole, input.accessRole);
      }

      return workshop;
    });
  }

  /** Un rol, un taller: si no, cada uno vería las entregas del otro. */
  private async assertRoleFree(
    tx: PrismaExecutor,
    role: string | null,
    exceptId?: string,
  ) {
    if (!role) return;

    const taken = await tx.workshop.findFirst({
      where: { accessRole: role, id: { not: exceptId } },
      select: { name: true },
    });

    if (taken) {
      throw new BusinessRuleError(
        `Esa cuenta ya está ligada al taller ${taken.name}.`,
      );
    }
  }

  private async auditAccess(
    tx: PrismaExecutor,
    workshop: Workshop,
    previous: string | null,
    next: string | null,
  ) {
    await this.auditWith(tx).record({
      entity: "Workshop",
      entityId: workshop.id,
      action: "UPDATE",
      reference: workshop.name,
      oldValue: { cuenta: previous },
      newValue: { cuenta: next },
      // Decide quién puede ver qué: no es un dato más del catálogo.
      sensitivity: "MEDIUM",
    });
  }
}

function stateOf(shipment: {
  status: WorkshopDeliveryListRow["status"];
  receivedAt: Date | null;
  document: { status: NonNullable<WorkshopDeliveryListRow["document"]>["status"] } | null;
}): WorkshopDeliveryState {
  return deliveryState({
    status: shipment.status,
    documentStatus: shipment.document?.status ?? null,
    receivedAt: shipment.receivedAt,
  });
}

function totals(
  lines: { sentQuantity: number; bundles: number }[],
): { pieces: number; bundles: number } {
  return {
    pieces: sumBundlePieces(
      lines.map((line) => ({
        quantity: line.sentQuantity,
        bundles: line.bundles,
      })),
    ),
    bundles: lines.reduce((sum, line) => sum + line.bundles, 0),
  };
}

function toListRow(row: WorkshopDeliveryListRow): WorkshopDeliveryRow {
  return {
    id: row.id,
    code: row.code,
    state: stateOf(row),
    // El número que el taller conoce: el del papel, no el folio interno.
    orderReference: row.order.reference ?? row.order.code,
    clientName: row.order.client?.name ?? NO_CLIENT_LABEL,
    description: row.order.description ?? NO_DESCRIPTION_LABEL,
    stageName: row.stage.name,
    parts: row.parts,
    sentAt: row.sentAt,
    ...totals(row.lines),
  };
}

function toDetail(row: WorkshopDeliveryDetailRow): WorkshopDeliveryDetail {
  const state = stateOf(row);
  if (state === "CANCELLED") return { state, code: row.code };

  return {
    state,
    id: row.id,
    code: row.code,
    voucherId: row.documentId,
    voucherCode: row.document?.code ?? null,
    sentAt: row.sentAt,
    stageName: row.stage.name,
    parts: row.parts,
    reference: row.reference,
    notes: row.notes,
    receivedAt: row.receivedAt,
    receivedByName: row.receivedBy?.name ?? null,
    ...totals(row.lines),
    lines: row.lines.map((line) => ({
      id: line.id,
      sizeCode: line.size.code,
      sentQuantity: line.sentQuantity,
      bundles: line.bundles,
      notes: line.notes,
      tag: line.cutTag,
    })),
    order: toOrderView(row.order),
    cuts: toCuts(row.order),
  };
}

function toOrderView(
  order: WorkshopDeliveryDetailRow["order"],
): ActiveWorkshopDelivery["order"] {
  return {
    reference: order.reference ?? order.code,
    clientPo: order.clientPo,
    clientName: order.client?.name ?? NO_CLIENT_LABEL,
    description: order.description,
    dueDate: order.dueDate,
    notes: order.notes,
    fabric: fabricOf(order),
    pattern: order.cutPattern,
    version: order.cutVersion ? CUT_VERSION_LABELS[order.cutVersion] : null,
    versionNotes: order.cutVersionNotes,
    cutNotes: order.cutNotes,
  };
}

function fabricOf(order: WorkshopDeliveryDetailRow["order"]): string | null {
  if (order.material) return `${order.material.code} · ${order.material.name}`;
  return order.cutFabricText;
}

function toCuts(order: WorkshopDeliveryDetailRow["order"]): DeliveryCut[] {
  const entries = order.lines.flatMap((line) =>
    line.progress.map((entry) => ({
      batchId: entry.batchId,
      view: {
        id: entry.id,
        lineId: line.id,
        sizeId: line.sizeId,
        sizeCode: line.size.code,
        quantity: entry.quantity,
        bundles: entry.bundles,
        tagId: entry.tagId,
        createdAt: entry.createdAt,
        userName: null,
        notes: entry.notes,
        note: line.notes,
        tag: entry.cutTag ?? line.cutTag,
      } satisfies DeliveryCutEntry,
    })),
  );

  return order.batches
    .map((batch) => ({
      ...batch,
      openedByName: null,
      issues: [] as [],
      entries: entries
        .filter((entry) => entry.batchId === batch.id)
        .map((entry) => entry.view),
    }))
    .filter((cut) => cut.entries.length > 0);
}
