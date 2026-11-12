import type { Prisma } from "@prisma/client";
import { ForbiddenError } from "@/lib/core/errors";
import {
  canDownloadTable,
  OFFLINE_HISTORY_DAYS,
  type OfflineTable,
} from "@/lib/constants/offline-tables";
import {
  OfflineSnapshotRepository,
  type SnapshotIssueRow,
  type SnapshotLotRow,
  type SnapshotMaterialRow,
  type SnapshotOrderRow,
  type SnapshotReceiptRow,
} from "@/lib/repositories/offline-snapshot.repository";
import type {
  OfflineIssue,
  OfflineLot,
  OfflineMaterial,
  OfflineOrder,
  OfflineReceipt,
  OfflineRecord,
  OfflineTablePayload,
} from "@/lib/offline/snapshot.types";
import { BaseService } from "./base.service";

const DAY_MS = 24 * 60 * 60 * 1000;

/** Un loader por tabla: la llave fija qué forma de registro devuelve. */
type TableLoaders = {
  [T in OfflineTable]: () => Promise<OfflineRecord<T>[]>;
};

/**
 * Arma la copia que el navegador guarda para trabajar sin internet.
 *
 * Es SÓLO lectura: no mueve saldos ni deja movimientos. Por eso no abre
 * transacción —cada tabla se lee por separado y se descarga por separado—
 * y no deja rastro en la auditoría: bajarse la copia es lo mismo que abrir
 * la pantalla de inventario, y eso tampoco se audita.
 */
export class OfflineSnapshotService extends BaseService {
  private readonly repository = new OfflineSnapshotRepository(this.db);

  /**
   * Una tabla, ya aplanada para el cliente.
   *
   * El permiso se revisa AQUÍ aunque la action ya exigió `offline:manage`:
   * esa llave dice "puede usar la copia", no "puede ver todas las tablas".
   * Sin esta revisión, cualquiera con la copia se bajaría las órdenes o los
   * rollos aunque su pantalla en línea se los niegue.
   */
  async downloadTable<T extends OfflineTable>(
    table: T,
    role: string,
  ): Promise<OfflineTablePayload<T>> {
    if (!canDownloadTable(role, table)) {
      throw new ForbiddenError(
        "Tu rol no puede guardar esta tabla en el equipo.",
      );
    }

    const loaders = this.loaders();
    const records = await loaders[table]();

    return { table, records, downloadedAt: new Date().toISOString() };
  }

  private loaders(): TableLoaders {
    const since = new Date(Date.now() - OFFLINE_HISTORY_DAYS * DAY_MS);
    const repo = this.repository;

    return {
      materials: async () => (await repo.materials()).map(toMaterial),
      sizes: () => repo.sizes(),
      cutTags: () => repo.cutTags(),
      workshops: () => repo.workshops(),
      locations: () => repo.locations(),
      clients: () => repo.clients(),
      suppliers: () => repo.suppliers(),
      lots: async () => (await repo.lots()).map(toLot),
      receipts: async () => (await repo.receiptsSince(since)).map(toReceipt),
      issues: async () => (await repo.issuesSince(since)).map(toIssue),
      orders: async () => (await repo.openOrders()).map(toOrder),
    };
  }
}

/* ── Aplanado ──────────────────────────────────────────────────────────────
   El Decimal de Prisma no cruza al cliente y la fecha viaja como ISO. Se hace
   a mano y no con toPlainObject() porque éste deja las fechas como Date, y
   la copia local las quiere como texto (ver snapshot.types.ts). */

function decimal(value: Prisma.Decimal): number;
function decimal(value: Prisma.Decimal | null): number | null;
function decimal(value: Prisma.Decimal | null): number | null {
  if (value === null) return null;
  return value.toNumber();
}

function iso(value: Date | null): string | null {
  if (value === null) return null;
  return value.toISOString();
}

function toMaterial(row: SnapshotMaterialRow): OfflineMaterial {
  return {
    ...row,
    thicknessMm: decimal(row.thicknessMm),
    weightOz: decimal(row.weightOz),
    remnantThreshold: decimal(row.remnantThreshold),
  };
}

function toLot(row: SnapshotLotRow): OfflineLot {
  return {
    ...row,
    currentQuantity: decimal(row.currentQuantity),
    reservedQuantity: decimal(row.reservedQuantity),
    receivedAt: row.receivedAt.toISOString(),
  };
}

function toReceipt(row: SnapshotReceiptRow): OfflineReceipt {
  return { ...row, date: row.date.toISOString() };
}

function toIssue(row: SnapshotIssueRow): OfflineIssue {
  return { ...row, date: row.date.toISOString() };
}

function toOrder(row: SnapshotOrderRow): OfflineOrder {
  return {
    ...row,
    orderedAt: row.orderedAt.toISOString(),
    dueDate: iso(row.dueDate),
  };
}
