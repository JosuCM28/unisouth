import type { Workshop } from "@prisma/client";
import { sumBundlePieces } from "@/lib/bundles";
import type { WorkshopDeliveryState } from "@/lib/constants/workshop-access";
import {
  BusinessRuleError,
  ForbiddenError,
  NotFoundError,
} from "@/lib/core/errors";
import type { PrismaExecutor } from "@/lib/prisma";
import {
  shipmentScopeWhere,
  voucherScopeWhere,
  WORKSHOP_DELIVERY_LIMIT,
  WorkshopDeliveryRepository,
  type WorkshopDeliveryDetailRow,
  type WorkshopDeliveryListRow,
  type WorkshopVoucherDetailRow,
  type WorkshopVoucherListRow,
} from "@/lib/repositories/workshop-delivery.repository";
import type { WorkshopInput } from "@/lib/validations/garment-shipment.schema";
import { deliveryState, voucherDeliveryState } from "@/lib/workshop-delivery";
import { WorkshopOutputRepository } from "@/lib/repositories/workshop-output.repository";
import { BaseService } from "./base.service";

export interface WorkshopDeliveryRow {
  id: string;
  code: string;
  state: WorkshopDeliveryState;
  orderReference: string;
  /** La PO del cliente, para que el taller busque con el papel en la mano. */
  clientPo: string | null;
  clientName: string;
  description: string;
  stageName: string;
  parts: string | null;
  sentAt: Date;
  pieces: number;
  bundles: number;
  /** Cuándo salió de verdad de la planta. Vacío = sigue allá. */
  dispatchedAt: Date | null;
  receivedAt: Date | null;
  receivedByName: string | null;
  receivedNotes: string | null;
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
  /** Para reimprimir la hoja. Vacío en un vale que no nació de una orden. */
  orderId: string | null;
  voucherId: string | null;
  voucherCode: string | null;
  sentAt: Date;
  stageName: string;
  parts: string | null;
  reference: string | null;
  notes: string | null;
  dispatchedAt: Date | null;
  receivedAt: Date | null;
  receivedByName: string | null;
  receivedNotes: string | null;
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
    cutNotes: string[];
  };
  cuts: DeliveryCut[];
  /** Un vale capturado sin orden de origen no tiene cortes que enseñar. */
  showCuts: boolean;
  /**
   * Lo que otros talleres dicen haberle mandado de esta misma orden ("De
   * Sitex: 300 frentes bordados"). Sólo informa: no se recibe ni se confirma.
   */
  incoming: IncomingOutput[];
}

export interface IncomingOutput {
  code: string;
  fromWorkshop: string;
  date: Date;
  parts: string | null;
  pieces: number;
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

export const NO_CLIENT_LABEL = "Fábrica";
export const NO_DESCRIPTION_LABEL = "Sin descripción";
/* Un vale no pasa por una etapa del catálogo: el renglón dice qué fue. */
export const VOUCHER_STAGE_LABEL = "Salida de corte";

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

    /* Dos orígenes, una sola lista: al taller no le importa si le llegó por
       "Mandar a taller" o por un vale de salida. */
    const [shipments, vouchers] = await Promise.all([
      this.repository.findList(workshop),
      this.repository.findVoucherList(workshop),
    ]);

    const rows = [
      ...shipments.map(toListRow),
      ...vouchers.map(toVoucherListRow),
    ]
      .sort((a, b) => b.sentAt.getTime() - a.sentAt.getTime())
      .slice(0, WORKSHOP_DELIVERY_LIMIT);

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

    const shipment = await this.repository.findDetail(workshop, id);
    const voucher = shipment
      ? null
      : await this.repository.findVoucherDetail(workshop, id);

    const detail = shipment ? toDetail(shipment) : voucher && toVoucherDetail(voucher);
    if (!detail || detail.state === "CANCELLED" || !detail.orderId) return detail;

    return { ...detail, incoming: await this.incomingFor(workshop.id, detail.orderId) };
  }

  private async incomingFor(workshopId: string, orderId: string): Promise<IncomingOutput[]> {
    const outputs = await new WorkshopOutputRepository().findIncoming(workshopId, orderId);
    return outputs.map((output) => ({
      code: output.code,
      fromWorkshop: output.workshop.name,
      date: output.date,
      parts: output.parts,
      pieces: output.lines.reduce((sum, line) => sum + line.quantity, 0),
    }));
  }

  /**
   * La ficha que se abre desde el tablero. Igual que `detailForRole`, pero
   * sin `null`: la ventana necesita un mensaje que enseñar, y una entrega de
   * otro taller se contesta igual que una que no existe.
   */
  async requireDetailForRole(
    role: string,
    id: string,
  ): Promise<WorkshopDeliveryDetail> {
    const detail = await this.detailForRole(role, id);
    if (!detail) throw new NotFoundError("la entrega");
    return detail;
  }

  /** La reimpresión: sólo su propio vale, y sólo mientras siga vigente. */
  async assertCanPrint(role: string, documentId: string): Promise<void> {
    const workshop = await this.repository.findWorkshopByRole(role);
    const state = workshop
      ? await this.printableState(workshop, documentId)
      : null;

    if (!state || state === "CANCELLED") {
      throw new ForbiddenError("No puedes imprimir este vale.");
    }
  }

  /**
   * La hoja de la orden: sólo si el taller tiene una entrega vigente de ella.
   *
   * Basta una: la orden se le pudo mandar en dos envíos y cancelar uno no le
   * quita lo que el otro sí le dejó.
   */
  async assertCanPrintOrder(role: string, orderId: string): Promise<void> {
    const workshop = await this.repository.findWorkshopByRole(role);
    const deliveries = workshop
      ? await this.repository.findOrderDeliveries(workshop, orderId)
      : null;

    const hasLiveDelivery =
      deliveries !== null &&
      [
        ...deliveries.shipments.map(stateOf),
        ...deliveries.vouchers.map(voucherStateOf),
      ].some((state) => state !== "CANCELLED");

    if (!hasLiveDelivery) {
      throw new ForbiddenError("No puedes imprimir esta orden.");
    }
  }

  private async printableState(
    workshop: { id: string; accessSince: Date | null },
    documentId: string,
  ): Promise<WorkshopDeliveryState | null> {
    const shipment = await this.repository.findByDocument(workshop, documentId);
    if (shipment) return stateOf(shipment);

    const voucher = await this.repository.findVoucherState(workshop, documentId);
    return voucher ? voucherStateOf(voucher) : null;
  }

  /**
   * El taller confirma que le llegó.
   *
   * Sin deshacer para el taller: "ya está allá" es lo que la casa va a dar por
   * cierto, y si se pudiera apagar y prender dejaría de significar algo.
   */
  async confirmReceipt(
    id: string,
    role: string,
    notes?: string,
  ): Promise<{ code: string }> {
    return this.transaction(async (tx) => {
      const workshop = await tx.workshop.findFirst({
        where: { accessRole: role, deletedAt: null },
        select: { id: true, name: true, accessSince: true },
      });
      if (!workshop) throw new NotFoundError("la entrega", id);

      const shipment = await tx.garmentShipment.findFirst({
        where: { id, ...shipmentScopeWhere(workshop) },
        select: {
          code: true,
          status: true,
          dispatchedAt: true,
          receivedAt: true,
          document: { select: { status: true } },
        },
      });

      if (shipment) {
        this.assertReceivable(stateOf(shipment), shipment);
        await tx.garmentShipment.update({
          where: { id },
          data: {
            receivedAt: new Date(),
            receivedById: this.context.userId,
            receivedNotes: notes,
          },
        });
        await this.auditReceipt(tx, "GarmentShipment", id, shipment.code, workshop.name, notes);
        return { code: shipment.code };
      }

      return this.confirmVoucher(tx, id, workshop, notes);
    });
  }

  /** Si no era un envío, tiene que ser una salida de corte de este taller. */
  private async confirmVoucher(
    tx: PrismaExecutor,
    id: string,
    workshop: { id: string; name: string; accessSince: Date | null },
    notes?: string,
  ): Promise<{ code: string }> {
    const voucher = await tx.inventoryDocument.findFirst({
      where: { id, ...voucherScopeWhere(workshop) },
      select: {
        code: true,
        status: true,
        dispatchedAt: true,
        workshopReceivedAt: true,
      },
    });
    if (!voucher) throw new NotFoundError("la entrega", id);

    this.assertReceivable(voucherStateOf(voucher), voucher);

    await tx.inventoryDocument.update({
      where: { id },
      data: {
        workshopReceivedAt: new Date(),
        workshopReceivedById: this.context.userId,
        workshopReceivedNotes: notes,
      },
    });
    await this.auditReceipt(tx, "InventoryDocument", id, voucher.code, workshop.name, notes);

    return { code: voucher.code };
  }

  private assertReceivable(
    state: WorkshopDeliveryState,
    { code, dispatchedAt }: { code: string; dispatchedAt: Date | null },
  ) {
    if (state === "CANCELLED") {
      throw new BusinessRuleError(`La entrega ${code} fue cancelada.`);
    }
    if (state === "RECEIVED") {
      throw new BusinessRuleError(
        `La entrega ${code} ya estaba marcada como recibida.`,
      );
    }
    // No se puede confirmar lo que sigue físicamente en la planta de corte.
    if (!dispatchedAt) {
      throw new BusinessRuleError(
        `La entrega ${code} todavía no sale de la planta de corte.`,
      );
    }
  }

  private async auditReceipt(
    tx: PrismaExecutor,
    entity: string,
    entityId: string,
    code: string,
    workshopName: string,
    notes?: string,
  ) {
    await this.auditWith(tx).record({
      entity,
      entityId,
      action: "UPDATE",
      reference: code,
      newValue: { recibido: true, taller: workshopName, nota: notes ?? null },
      sensitivity: "LOW",
    });
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

  /** Baja lógica: un taller borrado dejaría envíos apuntando a la nada. */
  async removeWorkshop(id: string): Promise<Workshop> {
    return this.db.workshop.update({
      where: { id },
      // Suelta la cuenta: dado de baja no debe seguir apartando ese rol.
      data: {
        active: false,
        deletedAt: new Date(),
        accessRole: null,
        accessSince: null,
      },
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

function voucherStateOf(voucher: {
  status: WorkshopVoucherListRow["status"];
  workshopReceivedAt: Date | null;
}): WorkshopDeliveryState {
  return voucherDeliveryState({
    status: voucher.status,
    receivedAt: voucher.workshopReceivedAt,
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
    clientPo: row.order.clientPo,
    clientName: row.order.client?.name ?? NO_CLIENT_LABEL,
    description: row.order.description ?? NO_DESCRIPTION_LABEL,
    stageName: row.stage.name,
    parts: row.parts,
    sentAt: row.sentAt,
    ...totals(row.lines),
    dispatchedAt: row.dispatchedAt,
    receivedAt: row.receivedAt,
    receivedByName: row.receivedBy?.name ?? null,
    receivedNotes: row.receivedNotes,
  };
}

/** El número que conoce el taller; el folio del vale si no hay otro. */
export function voucherReference(voucher: {
  code: string;
  reference: string | null;
  cuttingOrder: { code: string; reference: string | null } | null;
}): string {
  return (
    voucher.reference ??
    voucher.cuttingOrder?.reference ??
    voucher.cuttingOrder?.code ??
    voucher.code
  );
}

function voucherLineTotals(
  lines: { quantity: number; bundles: number }[],
): { pieces: number; bundles: number } {
  return totals(
    lines.map((line) => ({
      sentQuantity: line.quantity,
      bundles: line.bundles,
    })),
  );
}

function toVoucherListRow(row: WorkshopVoucherListRow): WorkshopDeliveryRow {
  return {
    id: row.id,
    code: row.code,
    state: voucherStateOf(row),
    orderReference: voucherReference(row),
    // Un vale no lleva PO propia: la hereda de la orden de la que salió.
    clientPo: row.cuttingOrder?.clientPo ?? null,
    clientName: row.client?.name ?? NO_CLIENT_LABEL,
    description: row.cutDescription ?? row.concept ?? NO_DESCRIPTION_LABEL,
    stageName: VOUCHER_STAGE_LABEL,
    parts: null,
    sentAt: row.date,
    ...voucherLineTotals(row.cutLines),
    dispatchedAt: row.dispatchedAt,
    receivedAt: row.workshopReceivedAt,
    receivedByName: row.workshopReceivedBy?.name ?? null,
    receivedNotes: row.workshopReceivedNotes,
  };
}

function toVoucherDetail(row: WorkshopVoucherDetailRow): WorkshopDeliveryDetail {
  const state = voucherStateOf(row);
  if (state === "CANCELLED") return { state, code: row.code };

  return {
    state,
    id: row.id,
    code: row.code,
    orderId: row.cuttingOrderId,
    voucherId: row.id,
    voucherCode: row.code,
    sentAt: row.date,
    stageName: VOUCHER_STAGE_LABEL,
    parts: null,
    reference: null,
    notes: row.notes,
    dispatchedAt: row.dispatchedAt,
    receivedAt: row.workshopReceivedAt,
    receivedByName: row.workshopReceivedBy?.name ?? null,
    receivedNotes: row.workshopReceivedNotes,
    ...voucherLineTotals(row.cutLines),
    lines: row.cutLines.map((line) => ({
      id: line.id,
      sizeCode: line.size.code,
      sentQuantity: line.quantity,
      bundles: line.bundles,
      notes: line.notes,
      tag: line.cutTag,
    })),
    order: {
      reference: voucherReference(row),
      clientPo: row.clientPo,
      clientName: row.client?.name ?? NO_CLIENT_LABEL,
      description: row.cutDescription ?? row.concept,
      dueDate: row.cuttingOrder?.dueDate ?? null,
      notes: row.cuttingOrder?.notes ?? null,
      fabric: row.cutFabric
        ? `${row.cutFabric.code} · ${row.cutFabric.name}`
        : row.cutFabricText,
      pattern: row.cutPattern,
      cutNotes: row.cutNotes,
    },
    cuts: row.cuttingOrder ? toCuts(row.cuttingOrder, row.cuttingBatchId) : [],
    showCuts: row.cuttingOrder !== null,
    incoming: [],
  };
}

function toDetail(row: WorkshopDeliveryDetailRow): WorkshopDeliveryDetail {
  const state = stateOf(row);
  if (state === "CANCELLED") return { state, code: row.code };

  return {
    state,
    id: row.id,
    code: row.code,
    orderId: row.orderId,
    voucherId: row.documentId,
    voucherCode: row.document?.code ?? null,
    sentAt: row.sentAt,
    stageName: row.stage.name,
    parts: row.parts,
    reference: row.reference,
    notes: row.notes,
    dispatchedAt: row.dispatchedAt,
    receivedAt: row.receivedAt,
    receivedByName: row.receivedBy?.name ?? null,
    receivedNotes: row.receivedNotes,
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
    cuts: toCuts(row.order, null),
    showCuts: true,
    incoming: [],
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
    cutNotes: order.cutNotes,
  };
}

function fabricOf(order: WorkshopDeliveryDetailRow["order"]): string | null {
  if (order.material) return `${order.material.code} · ${order.material.name}`;
  return order.cutFabricText;
}

/** Con `onlyBatchId`, sólo el corte que se llevó el vale. */
function toCuts(
  order: Pick<WorkshopDeliveryDetailRow["order"], "batches" | "lines">,
  onlyBatchId: string | null,
): DeliveryCut[] {
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
    .filter((batch) => !onlyBatchId || batch.id === onlyBatchId)
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
