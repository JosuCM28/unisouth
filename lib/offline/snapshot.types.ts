import type {
  CuttingOrderOrigin,
  CuttingOrderStatus,
  DocumentStatus,
  LotStatus,
  MaterialType,
  Unit,
} from "@prisma/client";
import type { OfflineTable } from "@/lib/constants/offline-tables";

/**
 * La forma en que cada tabla vive en el navegador.
 *
 * Son tipos PLANOS a propósito: sin `Decimal` (no cruza al cliente) y con
 * las fechas como texto ISO. IndexedDB guarda `Date` sin problema, pero el
 * texto ordena igual, se compara igual y no cambia de forma al pasar por la
 * respuesta de la Server Action. Una sola representación en todo el camino.
 *
 * Sólo van los campos que sirven para trabajar sin señal. Lo que no se usa
 * en el piso (costos, extras, rastro de quién lo creó) se queda en el
 * servidor: cada campo de más es dato del cliente guardado en un celular.
 */

export interface OfflineMaterial {
  id: string;
  code: string;
  name: string;
  type: MaterialType;
  baseUnit: Unit;
  colorName: string | null;
  widthMm: number | null;
  thicknessMm: number | null;
  weightOz: number | null;
  remnantThreshold: number | null;
  requiresShade: boolean;
}

export interface OfflineSize {
  id: string;
  code: string;
  name: string;
  order: number;
  group: string | null;
}

export interface OfflineCutTag {
  id: string;
  code: string;
  name: string;
  color: string;
  order: number;
}

export interface OfflineWorkshop {
  id: string;
  code: string | null;
  name: string;
}

export interface OfflineLocation {
  id: string;
  code: string;
  name: string;
  warehouseId: string;
}

export interface OfflineClient {
  id: string;
  code: string | null;
  name: string;
}

export interface OfflineSupplier {
  id: string;
  code: string | null;
  name: string;
}

export interface OfflineLot {
  id: string;
  code: string;
  materialId: string;
  clientId: string | null;
  locationId: string | null;
  receiptId: string | null;
  shade: string | null;
  supplierLotNumber: string | null;
  unit: Unit;
  /**
   * El saldo que tenía el rollo AL DESCARGAR. No es el saldo vivo: mientras
   * no haya señal otra persona pudo haberlo cortado. Por eso al sincronizar
   * el servidor vuelve a validar todo con la fila bloqueada.
   */
  currentQuantity: number;
  reservedQuantity: number;
  status: LotStatus;
  isRemnant: boolean;
  isBlocked: boolean;
  receivedAt: string;
}

export interface OfflineReceipt {
  id: string;
  code: string;
  date: string;
  clientId: string | null;
  supplierId: string | null;
  guideNumber: string | null;
  notes: string | null;
}

export interface OfflineIssue {
  id: string;
  code: string;
  date: string;
  status: DocumentStatus;
  clientId: string | null;
  cuttingOrderId: string | null;
  workshopId: string | null;
  concept: string | null;
  reference: string | null;
  receivedBy: string | null;
}

export interface OfflineOrderLine {
  id: string;
  sizeId: string;
  tagId: string | null;
  orderedQuantity: number;
  cutQuantity: number;
  position: number;
}

export interface OfflineOrder {
  id: string;
  code: string;
  status: CuttingOrderStatus;
  origin: CuttingOrderOrigin;
  clientId: string | null;
  materialId: string | null;
  folderId: string | null;
  description: string | null;
  reference: string | null;
  clientPo: string | null;
  orderedAt: string;
  dueDate: string | null;
  /** Las tallas van dentro de la orden: nunca se leen sin ella. */
  lines: OfflineOrderLine[];
}

/** Qué registro guarda cada tabla. Une la llave con su forma. */
export interface OfflineRecordMap {
  materials: OfflineMaterial;
  sizes: OfflineSize;
  cutTags: OfflineCutTag;
  workshops: OfflineWorkshop;
  locations: OfflineLocation;
  clients: OfflineClient;
  suppliers: OfflineSupplier;
  lots: OfflineLot;
  receipts: OfflineReceipt;
  issues: OfflineIssue;
  orders: OfflineOrder;
}

export type OfflineRecord<T extends OfflineTable> = OfflineRecordMap[T];

/** Lo que devuelve la descarga de una tabla. */
export interface OfflineTablePayload<T extends OfflineTable = OfflineTable> {
  table: T;
  records: OfflineRecord<T>[];
  /** Hora del SERVIDOR al leer: es la que se muestra como "copia de las…". */
  downloadedAt: string;
}

/** Cuándo se bajó cada tabla y cuántos registros trajo. */
export interface OfflineTableMeta {
  table: OfflineTable;
  downloadedAt: string;
  count: number;
}
