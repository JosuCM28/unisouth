/**
 * Cola de capturas pendientes, en IndexedDB.
 *
 * Existe porque el almacén tiene WiFi intermitente: el auxiliar da de alta un
 * rollo con la carga en el andén y si en ese instante no hay señal, la captura
 * NO se puede perder. Se guarda aquí y se manda sola cuando vuelve la red.
 *
 * Es IndexedDB y no localStorage por dos razones: localStorage es síncrono
 * (congela la interfaz al escribir) y tiene un techo de ~5 MB compartido con
 * todo lo demás. IndexedDB es asíncrono y aguanta miles de capturas.
 *
 * Vive en la misma base que la copia sin conexión (ver db.ts), y por eso usa
 * Dexie igual que ella. La forma de cada registro y el nombre de la tabla no
 * cambiaron: lo que ya estaba encolado antes de pasar a Dexie se sigue
 * leyendo y mandando igual.
 *
 * ORDEN: la cola es FIFO estricta por `seq`. Importa porque las
 * capturas pueden depender entre sí —un material dado de alta offline y un
 * rollo de ese material capturado después— y mandarlas al revés falla.
 */

import { isOfflineDbAvailable, offlineDb } from "./db";

/** Tipos de captura que se pueden encolar. Ver lib/offline/kinds.ts. */
export type QueueKind =
  | "lot.create"
  | "material.create"
  | "product.create"
  | "client.create"
  | "location.create"
  | "issue.create"
  | "cut.create"
  | "shipment.create";

export interface QueuedItem {
  /** Identificador local. NO es el folio: el folio lo asigna el servidor. */
  id: string;
  kind: QueueKind;
  /** El mismo payload que se le habría pasado a la Server Action. */
  payload: unknown;
  /** Resumen legible para la lista de pendientes ("Mezclilla 12 oz · 50 m"). */
  summary: string;
  createdAt: number;
  /**
   * Posición en la fila. Es lo que ORDENA la cola, no `createdAt`.
   *
   * `Date.now()` sólo tiene resolución de milisegundo: dar de alta un material
   * y enseguida el rollo que lo usa cae en el MISMO milisegundo, y ahí el
   * índice desempataba por el id —un UUID aleatorio—, mandándolos en cualquier
   * orden. El rollo llegaba antes que su material y el servidor lo rechazaba.
   *
   * Este contador es estrictamente creciente aunque el reloj no avance.
   */
  seq: number;
  attempts: number;
  /** Último error de envío, si lo hubo. Se muestra en la lista. */
  lastError?: string;
  /**
   * Folio provisional (`TMP-…`) de lo que en papel necesita un número desde
   * ya: la salida se firma en el andén aunque no haya señal. NO es el folio
   * real; ése lo asigna el servidor al subirla y queda en la tabla `synced`.
   */
  localCode?: string;
  /**
   * La orden a la que pertenece la captura, si es de una. Es lo que deja a la
   * ficha de la orden sin conexión enseñar sus cortes, envíos y salidas que
   * todavía no suben, sin tener que abrir cada payload para adivinarlo.
   */
  orderId?: string;
}

/** ¿Se puede usar la cola aquí? Ver isOfflineDbAvailable. */
export function isQueueAvailable(): boolean {
  return isOfflineDbAvailable();
}

/**
 * Encola una captura con la siguiente posición de la fila.
 *
 * Leer el máximo y escribir el nuevo van en la MISMA transacción de
 * escritura: así dos altas seguidas —o dos pestañas— no pueden tomar el
 * mismo número, y al recargar la página el contador sigue desde lo que ya
 * estaba esperando en vez de volver a cero y colarse antes.
 */
export async function enqueue(
  item: Omit<QueuedItem, "id" | "createdAt" | "seq" | "attempts">,
): Promise<QueuedItem> {
  const db = offlineDb();

  return db.transaction("rw", db.pending, async () => {
    const last = await db.pending.orderBy("seq").last();

    const record: QueuedItem = {
      ...item,
      id: crypto.randomUUID(),
      createdAt: Date.now(),
      seq: (last?.seq ?? 0) + 1,
      attempts: 0,
    };

    await db.pending.add(record);
    return record;
  });
}

/** Todas las pendientes, de la más vieja a la más nueva. */
export async function listPending(): Promise<QueuedItem[]> {
  if (!isQueueAvailable()) return [];
  return offlineDb().pending.orderBy("seq").toArray();
}

export async function countPending(): Promise<number> {
  if (!isQueueAvailable()) return 0;
  return offlineDb().pending.count();
}

export async function removeItem(id: string): Promise<void> {
  await offlineDb().pending.delete(id);
}

/**
 * Deja constancia de un intento fallido sin sacar la captura de la cola.
 *
 * El contador sirve para dos cosas: mostrarle al usuario que ya se intentó, y
 * distinguir un fallo pasajero de red de una captura que el servidor rechaza
 * una y otra vez.
 *
 * Si la captura ya se mandó y se borró entretanto, `modify` no encuentra
 * nada y no hace nada: no se resucita.
 */
export async function markAttempt(id: string, error: string): Promise<void> {
  await offlineDb()
    .pending.where("id")
    .equals(id)
    .modify((item) => {
      item.attempts += 1;
      item.lastError = error;
    });
}
