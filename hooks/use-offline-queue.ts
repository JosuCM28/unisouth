"use client";

import { useCallback, useState, useSyncExternalStore } from "react";
import { listPending, type QueuedItem } from "@/lib/offline/queue";
import { flushQueue } from "@/lib/offline/submit";

/**
 * Puente entre IndexedDB —que no notifica cambios— y React.
 *
 * La cola vive fuera de React, así que se lee con useSyncExternalStore y no
 * con un `useState` dentro de un efecto: es la vía que React 19 ofrece para
 * estado externo, y evita el render en cascada al montar.
 *
 * Como IndexedDB no avisa por sí solo, este módulo mantiene una copia en
 * memoria (`snapshot`) que se refresca a mano y notifica a los suscriptores.
 */

let snapshot: QueuedItem[] = [];
const listeners = new Set<() => void>();

/** El mismo arreglo cuando está vacía: useSyncExternalStore compara por identidad. */
const EMPTY: QueuedItem[] = [];

function subscribe(listener: () => void): () => void {
  listeners.add(listener);

  // El primer suscriptor dispara la lectura inicial de la cola.
  if (listeners.size === 1) void refreshSnapshot();

  return () => listeners.delete(listener);
}

function getSnapshot(): QueuedItem[] {
  return snapshot;
}

/** En el servidor no hay IndexedDB: la cola siempre se ve vacía. */
function getServerSnapshot(): QueuedItem[] {
  return EMPTY;
}

/**
 * Relee la cola y avisa a quien la esté mostrando.
 *
 * Se llama desde los formularios al encolar y después de cada sincronización.
 */
export async function refreshSnapshot(): Promise<void> {
  const items = await listPending();

  // Se conserva la MISMA referencia cuando está vacía: si no, cada lectura
  // devolvería un arreglo nuevo y useSyncExternalStore renderizaría en bucle.
  snapshot = items.length === 0 ? EMPTY : items;

  for (const listener of listeners) listener();
}

/** Lo llaman los formularios tras encolar una captura. */
export function notifyQueueChanged(): void {
  void refreshSnapshot();
}

function subscribeToConnection(onChange: () => void): () => void {
  window.addEventListener("online", onChange);
  window.addEventListener("offline", onChange);

  return () => {
    window.removeEventListener("online", onChange);
    window.removeEventListener("offline", onChange);
  };
}

/**
 * Reenvío automático al recuperar la señal.
 *
 * Se registra UNA vez a nivel de módulo, no dentro del hook: si viviera en un
 * efecto, cada componente que muestre el contador registraría su propio
 * escucha y la cola se vaciaría en paralelo desde varios lados, perdiendo el
 * orden FIFO que sostiene las dependencias entre capturas.
 *
 * `isFlushing` es el candado que evita que un rebote de WiFi —offline/online
 * dos veces en un segundo— dispare dos barridos encimados.
 */
let isFlushing = false;

async function runFlush(): Promise<void> {
  if (isFlushing) return;

  isFlushing = true;
  try {
    // flushQueue lee la cola de IndexedDB, que es la verdad. NO se consulta
    // `snapshot` para decidir si hay algo que mandar: es una copia en memoria
    // que puede ir atrasada, y con ella el botón de reintentar no haría nada
    // si la cola creció desde otra pestaña.
    await flushQueue();
    await refreshSnapshot();
  } finally {
    isFlushing = false;
  }
}

if (typeof window !== "undefined") {
  window.addEventListener("online", () => void runFlush());
}

interface OfflineQueueState {
  pending: number;
  items: QueuedItem[];
  online: boolean;
  syncing: boolean;
  /** Reintento manual, para el botón de la hoja de pendientes. */
  sync: () => Promise<void>;
  refresh: () => Promise<void>;
}

export function useOfflineQueue(): OfflineQueueState {
  const [syncing, setSyncing] = useState(false);

  const items = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  // El valor del servidor es `true` a propósito: suponer que hay red evita
  // que la franja parpadee "sin conexión" durante la hidratación.
  const online = useSyncExternalStore(
    subscribeToConnection,
    () => navigator.onLine,
    () => true,
  );

  /** Reintento a mano. Comparte candado con el automático: nunca dos a la vez. */
  const sync = useCallback(async () => {
    setSyncing(true);
    try {
      await runFlush();
    } finally {
      setSyncing(false);
    }
  }, []);

  return {
    pending: items.length,
    items,
    online,
    syncing,
    sync,
    refresh: refreshSnapshot,
  };
}
