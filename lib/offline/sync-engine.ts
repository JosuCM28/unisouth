"use client";

import { downloadOfflineTableAction } from "@/app/actions/offline.actions";
import type { OfflineTable } from "@/lib/constants/offline-tables";
import { offlineDb, type SyncedRecord } from "./db";
import { warmOfflineScreens } from "./screen-cache";
import type { OfflineTablePayload, OfflineTableMeta } from "./snapshot.types";
import { flushQueue, type FlushReport } from "./submit";

export interface DownloadReport {
  /** Tablas que quedaron guardadas en el equipo. */
  saved: OfflineTable[];
  /** Tablas que el servidor negó, con su motivo. */
  failed: { table: OfflineTable; error: string }[];
  /** Se cayó la red a la mitad: lo que faltó se queda con la copia anterior. */
  stalled: boolean;
}

export interface SyncReport {
  upload: FlushReport;
  download: DownloadReport;
}

/**
 * Sincronizar = primero SUBIR lo pendiente y luego BAJAR la copia.
 *
 * En ese orden a propósito: si se bajara primero, la copia nueva no traería
 * lo que se capturó sin señal —todavía no estaba en el servidor— y por un
 * momento el equipo enseñaría un inventario sin esas capturas.
 *
 * Si la subida se atora por la red, NO se baja nada: sin señal la descarga
 * fallaría igual, y así la copia anterior se queda intacta.
 */
export async function synchronize(
  tables: OfflineTable[],
  onProgress?: (table: OfflineTable) => void,
): Promise<SyncReport> {
  const upload = await flushQueue();

  if (upload.stalled) {
    return { upload, download: { saved: [], failed: [], stalled: true } };
  }

  const download = await downloadSnapshot(tables, onProgress);

  // Con la copia ya abajo, las pantallas que la usan se dejan guardadas para
  // que abran sin señal aunque nunca se hayan visitado en este equipo.
  if (!download.stalled) await warmOfflineScreens();

  return { upload, download };
}

/**
 * Baja las tablas una por una y reemplaza la copia de cada una.
 *
 * Tabla por tabla y no todas en una sola transacción: si la señal se cae al
 * bajar las órdenes, los materiales y rollos que ya llegaron se quedan
 * guardados en vez de perderse con el resto.
 */
export async function downloadSnapshot(
  tables: OfflineTable[],
  onProgress?: (table: OfflineTable) => void,
): Promise<DownloadReport> {
  const report: DownloadReport = { saved: [], failed: [], stalled: false };

  for (const table of tables) {
    onProgress?.(table);

    let result: Awaited<ReturnType<typeof downloadOfflineTableAction>>;
    try {
      result = await downloadOfflineTableAction({ table });
    } catch {
      // La promesa se rechazó: la petición nunca llegó. Seguir intentando
      // las demás tablas sin red sólo haría esperar al usuario.
      report.stalled = true;
      break;
    }

    if (!result.success) {
      report.failed.push({ table, error: result.error });
      continue;
    }

    await replaceTable(result.data as OfflineTablePayload);
    report.saved.push(table);
  }

  return report;
}

/**
 * Cambia la copia de una tabla por la recién bajada.
 *
 * Borrar y escribir van en UNA transacción: si el navegador se cierra a la
 * mitad, la tabla se queda con la copia anterior completa, nunca vacía ni a
 * medias. Se borra antes de escribir porque lo que ya no vino —un rollo que
 * se agotó, una orden que se cerró— tiene que desaparecer del equipo.
 */
async function replaceTable(payload: OfflineTablePayload): Promise<void> {
  const db = offlineDb();
  // Tabla sin tipar a propósito: TS no puede amarrar aquí la tabla con su
  // forma de registro —ambas salen del mismo `payload.table`, pero como
  // unión de las once—. El servidor ya las emparejó en OfflineSnapshotService.
  const target = db.table(payload.table);

  await db.transaction("rw", target, db.meta, async () => {
    await target.clear();
    await target.bulkPut(payload.records);
    await db.meta.put({
      table: payload.table,
      downloadedAt: payload.downloadedAt,
      count: payload.records.length,
    });
  });
}

/**
 * Borra la copia del equipo. NO toca la cola de pendientes.
 *
 * La cola son capturas que todavía no llegan al servidor: borrarlas aquí
 * las perdería para siempre. Eso se descarta una por una, a la vista.
 */
export async function clearSnapshot(): Promise<void> {
  const db = offlineDb();
  const tables = db.snapshotTables();

  await db.transaction("rw", [...tables, db.meta], async () => {
    await Promise.all([...tables, db.meta].map((table) => table.clear()));
  });
}

/** Cuándo se bajó cada tabla y con cuántos registros. */
export async function readSnapshotMeta(): Promise<OfflineTableMeta[]> {
  return offlineDb().meta.toArray();
}

/** Las últimas capturas que subieron, con su folio TMP y el real. */
export async function readRecentSynced(limit = 20): Promise<SyncedRecord[]> {
  return offlineDb().synced.orderBy("syncedAt").reverse().limit(limit).toArray();
}
