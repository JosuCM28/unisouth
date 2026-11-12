import Dexie, { type Table } from "dexie";
import { OFFLINE_TABLES, type OfflineTable } from "@/lib/constants/offline-tables";
import type { QueuedItem } from "./queue";
import type { OfflineRecordMap, OfflineTableMeta } from "./snapshot.types";

/**
 * La base del navegador: la copia para trabajar sin internet y la cola de
 * capturas pendientes, en el MISMO IndexedDB.
 *
 * Se llama igual que la cola de antes (`unisouth-offline`) a propósito. Esa
 * base ya existe en los celulares con capturas esperando; si ésta tuviera
 * otro nombre, la cola vieja quedaría huérfana y esas capturas nunca se
 * mandarían. Dexie abre la base existente, ve que `pending` ya está con el
 * mismo índice y sólo agrega las tablas nuevas.
 *
 * Dexie y no la API nativa: con una docena de tablas e índices, la API cruda
 * se volvía el mismo envoltorio de promesas repetido en cada archivo.
 */
const DB_NAME = "unisouth-offline";

/**
 * Índices de cada tabla de la copia. La primera columna es la llave.
 *
 * Sólo se indexa por lo que se va a BUSCAR sin señal: el folio que se teclea
 * o se escanea, y los ids por los que se agrupa (dueño, material, estado).
 * Cada índice de más cuesta tiempo en cada descarga.
 */
const SNAPSHOT_INDEXES: Record<OfflineTable, string> = {
  materials: "id, code, name",
  sizes: "id, code, order",
  cutTags: "id, code, order",
  workshops: "id, name",
  locations: "id, code",
  clients: "id, name",
  suppliers: "id, name",
  lots: "id, code, materialId, clientId, locationId, status",
  receipts: "id, code, date",
  issues: "id, code, status, date, cuttingOrderId",
  orders: "id, code, status, clientId",
};

/**
 * Una captura offline que ya llegó al servidor.
 *
 * Existe para contestar "¿qué folio le tocó a la salida TMP-3F9A2C que
 * firmé en el andén?". Al subirse, la captura sale de la cola y sin esta
 * tabla ese puente se perdería: el vale en papel dice TMP y el sistema OUT.
 */
export interface SyncedRecord {
  /** El mismo id que tenía en la cola. */
  id: string;
  kind: QueuedItem["kind"];
  localCode: string;
  serverCode: string;
  summary: string;
  /** Epoch ms, como `createdAt` de la cola: ordena sin parsear fechas. */
  syncedAt: number;
}

type SnapshotTables = {
  [T in OfflineTable]: Table<OfflineRecordMap[T], string>;
};

export class OfflineDatabase extends Dexie {
  pending!: Table<QueuedItem, string>;
  meta!: Table<OfflineTableMeta, OfflineTable>;
  synced!: Table<SyncedRecord, string>;

  constructor() {
    super(DB_NAME);

    /* Versión 1 de Dexie = la cola nativa de antes (IDB v1), tal cual.
       Se declara para que Dexie sepa de dónde parte al subir a la 2. */
    this.version(1).stores({ pending: "id, seq" });

    this.version(2).stores({
      pending: "id, seq",
      meta: "table",
      ...SNAPSHOT_INDEXES,
    });

    // Fase 2: el puente entre el folio TMP del celular y el real.
    this.version(3).stores({ synced: "id, syncedAt" });
  }

  /** Una tabla de la copia por su llave, con su tipo correcto. */
  snapshot<T extends OfflineTable>(table: T): SnapshotTables[T] {
    return this.table(table) as SnapshotTables[T];
  }

  /** Todas las tablas de la copia, para borrarlas o contarlas juntas. */
  snapshotTables(): Table[] {
    return OFFLINE_TABLES.map((table) => this.table(table));
  }
}

/**
 * Instancia única y perezosa.
 *
 * Perezosa porque este módulo también se evalúa al renderizar en el
 * servidor, donde no existe IndexedDB: se construye hasta el primer uso
 * real, que siempre es en el navegador.
 */
let instance: OfflineDatabase | null = null;

export function offlineDb(): OfflineDatabase {
  if (!instance) instance = new OfflineDatabase();
  return instance;
}

/**
 * ¿Se puede usar la base aquí?
 *
 * En el servidor no existe `indexedDB`, y algunos navegadores lo bloquean en
 * modo privado. Sin esta guarda, el render del servidor reventaría.
 */
export function isOfflineDbAvailable(): boolean {
  return typeof indexedDB !== "undefined";
}
