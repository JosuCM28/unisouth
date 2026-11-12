"use client";

import { useEffect, useState } from "react";
import type { OfflineTable } from "@/lib/constants/offline-tables";
import { isOfflineDbAvailable, offlineDb } from "@/lib/offline/db";
import type { OfflineRecordMap, OfflineTableMeta } from "@/lib/offline/snapshot.types";

export interface OfflineTableState<T extends OfflineTable> {
  records: OfflineRecordMap[T][];
  /** Cuándo se bajó y cuántos trajo; undefined si nunca se descargó. */
  meta: OfflineTableMeta | undefined;
  /** ¿Ya terminó la primera lectura? Para no pintar "sin copia" en falso. */
  loaded: boolean;
}

/**
 * Una tabla completa de la copia local.
 *
 * Se lee entera y se filtra en memoria: las pantallas sin conexión buscan
 * por texto libre (folio, tela, tono), que IndexedDB no sabe indexar, y con
 * unos miles de registros filtrar un arreglo es instantáneo.
 */
export function useOfflineTable<T extends OfflineTable>(
  table: T,
): OfflineTableState<T> {
  const [state, setState] = useState<OfflineTableState<T>>({
    records: [],
    meta: undefined,
    loaded: false,
  });

  useEffect(() => {
    let cancelled = false;

    void readTable(table).then((next) => {
      if (!cancelled) setState(next);
    });

    return () => {
      cancelled = true;
    };
  }, [table]);

  return state;
}

async function readTable<T extends OfflineTable>(
  table: T,
): Promise<OfflineTableState<T>> {
  if (!isOfflineDbAvailable()) return { records: [], meta: undefined, loaded: true };

  const db = offlineDb();
  const [records, meta] = await Promise.all([
    db.snapshot(table).toArray(),
    db.meta.get(table),
  ]);

  return { records: records as OfflineRecordMap[T][], meta, loaded: true };
}

/** Un catálogo como Map por id, para pintar nombres sin un `find` por renglón. */
export function byId<R extends { id: string }>(records: R[]): Map<string, R> {
  return new Map(records.map((record) => [record.id, record]));
}
