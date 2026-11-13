import type { Lot, Prisma } from "@prisma/client";
import {
  BaseRepository,
  type PrismaDelegate,
} from "@/lib/core/base-repository";

/**
 * Los rollos que ya no están en la bodega.
 *
 * Copiarlos al celular sólo ocuparía espacio: no se pueden surtir, y su
 * historial se consulta con señal desde la ficha.
 */
const GONE_LOT_STATUSES = ["DEPLETED", "WRITTEN_OFF", "RETURNED"] as const;

/** Lo vivo de un catálogo con baja lógica. */
const ACTIVE = { active: true, deletedAt: null } as const;

const MATERIAL_SELECT = {
  id: true,
  code: true,
  name: true,
  type: true,
  baseUnit: true,
  colorName: true,
  widthMm: true,
  thicknessMm: true,
  weightOz: true,
  remnantThreshold: true,
  requiresShade: true,
} satisfies Prisma.MaterialSelect;

const LOT_SELECT = {
  id: true,
  code: true,
  materialId: true,
  clientId: true,
  locationId: true,
  receiptId: true,
  shade: true,
  supplierLotNumber: true,
  unit: true,
  currentQuantity: true,
  reservedQuantity: true,
  status: true,
  isRemnant: true,
  isBlocked: true,
  receivedAt: true,
} satisfies Prisma.LotSelect;

const RECEIPT_SELECT = {
  id: true,
  code: true,
  date: true,
  clientId: true,
  supplierId: true,
  guideNumber: true,
  notes: true,
} satisfies Prisma.ReceiptSelect;

const ISSUE_SELECT = {
  id: true,
  code: true,
  date: true,
  status: true,
  clientId: true,
  cuttingOrderId: true,
  workshopId: true,
  concept: true,
  reference: true,
  receivedBy: true,
} satisfies Prisma.InventoryDocumentSelect;

const ORDER_SELECT = {
  id: true,
  code: true,
  status: true,
  origin: true,
  clientId: true,
  materialId: true,
  folderId: true,
  description: true,
  reference: true,
  clientPo: true,
  orderedAt: true,
  dueDate: true,
  lines: {
    select: {
      id: true,
      sizeId: true,
      tagId: true,
      orderedQuantity: true,
      cutQuantity: true,
      position: true,
      notes: true,
    },
    orderBy: { position: "asc" },
  },
  /* Lo ya mandado a taller, para que el envío sin señal diga "ya van 40" igual
     que en línea. Los cancelados no cuentan: esas piezas nunca salieron. */
  shipments: {
    where: { status: { not: "CANCELLED" } },
    select: {
      stageId: true,
      lines: { select: { sizeId: true, sentQuantity: true, bundles: true } },
    },
  },
} satisfies Prisma.CuttingOrderSelect;

export type SnapshotMaterialRow = Prisma.MaterialGetPayload<{ select: typeof MATERIAL_SELECT }>;
export type SnapshotLotRow = Prisma.LotGetPayload<{ select: typeof LOT_SELECT }>;
export type SnapshotReceiptRow = Prisma.ReceiptGetPayload<{ select: typeof RECEIPT_SELECT }>;
export type SnapshotIssueRow = Prisma.InventoryDocumentGetPayload<{ select: typeof ISSUE_SELECT }>;
export type SnapshotOrderRow = Prisma.CuttingOrderGetPayload<{ select: typeof ORDER_SELECT }>;

/**
 * Lectura de lo que se copia al navegador para trabajar sin internet.
 *
 * Sólo lee y filtra. Qué tabla le toca a quién y cómo se aplana para el
 * cliente lo decide `OfflineSnapshotService`.
 *
 * Toca varios modelos porque la copia es, por definición, una foto de
 * varias tablas; el delegado base apunta a `lot` sólo para cumplir con la
 * jerarquía, nadie usa aquí los métodos genéricos.
 */
export class OfflineSnapshotRepository extends BaseRepository<Lot, never, never> {
  protected override readonly usesSoftDelete = false;

  protected get delegate(): PrismaDelegate {
    return this.db.lot;
  }

  protected get entityName(): string {
    return "la copia sin conexión";
  }

  materials() {
    return this.db.material.findMany({
      where: ACTIVE,
      select: MATERIAL_SELECT,
      orderBy: { code: "asc" },
    });
  }

  sizes() {
    return this.db.size.findMany({
      where: { active: true },
      select: { id: true, code: true, name: true, order: true, group: true },
      orderBy: [{ group: "asc" }, { order: "asc" }],
    });
  }

  cutTags() {
    return this.db.cutTagOption.findMany({
      where: ACTIVE,
      select: { id: true, code: true, name: true, color: true, order: true },
      orderBy: { order: "asc" },
    });
  }

  workshops() {
    return this.db.workshop.findMany({
      where: ACTIVE,
      select: { id: true, code: true, name: true },
      orderBy: { name: "asc" },
    });
  }

  stages() {
    return this.db.processStage.findMany({
      where: ACTIVE,
      select: { id: true, code: true, name: true, position: true },
      orderBy: { position: "asc" },
    });
  }

  locations() {
    return this.db.location.findMany({
      where: ACTIVE,
      select: { id: true, code: true, name: true, warehouseId: true },
      orderBy: [{ order: "asc" }, { code: "asc" }],
    });
  }

  clients() {
    return this.db.client.findMany({
      where: ACTIVE,
      select: { id: true, code: true, name: true },
      orderBy: { name: "asc" },
    });
  }

  suppliers() {
    return this.db.supplier.findMany({
      where: ACTIVE,
      select: { id: true, code: true, name: true },
      orderBy: { name: "asc" },
    });
  }

  /** Mismo orden que al surtir: retazos primero, luego lo más viejo. */
  lots() {
    return this.db.lot.findMany({
      where: { status: { notIn: [...GONE_LOT_STATUSES] } },
      select: LOT_SELECT,
      orderBy: [{ isRemnant: "desc" }, { receivedAt: "asc" }],
    });
  }

  receiptsSince(since: Date) {
    return this.db.receipt.findMany({
      where: { date: { gte: since } },
      select: RECEIPT_SELECT,
      orderBy: { date: "desc" },
    });
  }

  /**
   * Salidas recientes, y además TODO borrador sin importar su fecha: un
   * borrador viejo es trabajo pendiente, justo lo que se quiere tener a la
   * mano sin señal.
   */
  issuesSince(since: Date) {
    return this.db.inventoryDocument.findMany({
      where: {
        type: "ISSUE",
        OR: [{ date: { gte: since } }, { status: "DRAFT" }],
      },
      select: ISSUE_SELECT,
      orderBy: { date: "desc" },
    });
  }

  /**
   * Las órdenes que siguen vivas en el concentrado de la casa.
   *
   * `addedAt` con fecha = ya es de la casa. Una orden de la otra planta sin
   * agregar no se trabaja aquí, así que no tiene por qué viajar al celular.
   */
  openOrders() {
    return this.db.cuttingOrder.findMany({
      where: {
        status: { in: ["OPEN", "IN_PROGRESS"] },
        addedAt: { not: null },
      },
      select: ORDER_SELECT,
      orderBy: { orderedAt: "desc" },
    });
  }
}
