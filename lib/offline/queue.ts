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
 * Se usa la API nativa, sin librería: son cuatro operaciones sobre un solo
 * almacén y el CLAUDE.md prohíbe sumar dependencias sin acordarlo.
 *
 * ORDEN: la cola es FIFO estricta por `seq`. Importa porque las
 * capturas pueden depender entre sí —un material dado de alta offline y un
 * rollo de ese material capturado después— y mandarlas al revés falla.
 */

const DB_NAME = "unisouth-offline";
const DB_VERSION = 1;
const STORE = "pending";

/** Tipos de captura que se pueden encolar. Ver lib/offline/kinds.ts. */
export type QueueKind =
  | "lot.create"
  | "material.create"
  | "product.create"
  | "client.create"
  | "location.create";

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
}

/**
 * Conexión perezosa y compartida.
 *
 * Abrir IndexedDB es asíncrono y se llama en cada operación; sin esta caché
 * se abriría una conexión por captura.
 */
let connection: Promise<IDBDatabase> | null = null;

function openDatabase(): Promise<IDBDatabase> {
  if (connection) return connection;

  connection = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: "id" });
        // El índice es lo que permite leer en orden de captura sin ordenar
        // en memoria. Va sobre `seq` y no sobre `createdAt` porque dos
        // capturas seguidas comparten milisegundo y el desempate por id
        // rompía el orden. Ver el comentario de `seq`.
        store.createIndex("seq", "seq");
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

  // Si falla la apertura se olvida la promesa rechazada: el siguiente intento
  // vuelve a probar en vez de arrastrar el fallo para siempre.
  connection.catch(() => {
    connection = null;
  });

  return connection;
}

function runTransaction<T>(
  mode: IDBTransactionMode,
  operation: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return openDatabase().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const transaction = db.transaction(STORE, mode);
        const request = operation(transaction.objectStore(STORE));

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      }),
  );
}

/**
 * ¿Se puede usar la cola aquí?
 *
 * En el servidor no existe `indexedDB`, y algunos navegadores lo bloquean en
 * modo privado. Sin esta guarda, el render del servidor reventaría.
 */
export function isQueueAvailable(): boolean {
  return typeof indexedDB !== "undefined";
}

/**
 * Siguiente posición de la fila.
 *
 * Se arranca desde el máximo que ya haya guardado: si no, al recargar la
 * página el contador volvería a cero y las capturas nuevas se colarían
 * ANTES de las que ya estaban esperando.
 */
let nextSeq: Promise<number> | null = null;

async function claimSeq(): Promise<number> {
  if (!nextSeq) {
    nextSeq = listPending().then((items) =>
      items.reduce((max, item) => Math.max(max, item.seq ?? 0), 0),
    );
  }

  const current = await nextSeq;
  const claimed = current + 1;

  // Se guarda ya resuelto para que dos altas seguidas no reciban el mismo
  // número: la segunda espera esta promesa, no otra lectura de la base.
  nextSeq = Promise.resolve(claimed);

  return claimed;
}

export async function enqueue(
  item: Omit<QueuedItem, "id" | "createdAt" | "seq" | "attempts">,
): Promise<QueuedItem> {
  const record: QueuedItem = {
    ...item,
    id: crypto.randomUUID(),
    createdAt: Date.now(),
    seq: await claimSeq(),
    attempts: 0,
  };

  await runTransaction("readwrite", (store) => store.add(record));
  return record;
}

/** Todas las pendientes, de la más vieja a la más nueva. */
export async function listPending(): Promise<QueuedItem[]> {
  if (!isQueueAvailable()) return [];

  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const request = db
      .transaction(STORE, "readonly")
      .objectStore(STORE)
      .index("seq")
      .getAll();

    request.onsuccess = () => resolve(request.result as QueuedItem[]);
    request.onerror = () => reject(request.error);
  });
}

export async function countPending(): Promise<number> {
  if (!isQueueAvailable()) return 0;
  return runTransaction("readonly", (store) => store.count());
}

export async function removeItem(id: string): Promise<void> {
  await runTransaction("readwrite", (store) => store.delete(id));
}

/**
 * Deja constancia de un intento fallido sin sacar la captura de la cola.
 *
 * El contador sirve para dos cosas: mostrarle al usuario que ya se intentó, y
 * distinguir un fallo pasajero de red de una captura que el servidor rechaza
 * una y otra vez.
 */
export async function markAttempt(id: string, error: string): Promise<void> {
  const db = await openDatabase();

  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(STORE, "readwrite");
    const store = transaction.objectStore(STORE);
    const read = store.get(id);

    read.onsuccess = () => {
      const current = read.result as QueuedItem | undefined;
      // Pudo haberse enviado y borrado entre la lectura y esta escritura.
      if (!current) return resolve();

      store.put({ ...current, attempts: current.attempts + 1, lastError: error });
      resolve();
    };

    read.onerror = () => reject(read.error);
  });
}
