"use client";

import { useEffect, useState } from "react";
import { isOfflineDbAvailable, offlineDb } from "@/lib/offline/db";
import type {
  OfflineClient,
  OfflineLocation,
  OfflineLot,
  OfflineMaterial,
} from "@/lib/offline/snapshot.types";

export interface OfflineCatalog {
  clients: OfflineClient[];
  materials: Map<string, OfflineMaterial>;
  locations: Map<string, OfflineLocation>;
  /** ¿Ya terminó la primera lectura? Para no pintar "sin copia" en falso. */
  loaded: boolean;
}

const EMPTY_CATALOG: OfflineCatalog = {
  clients: [],
  materials: new Map(),
  locations: new Map(),
  loaded: false,
};

/**
 * Los catálogos de la copia local que necesita una captura sin señal.
 *
 * Materiales y ubicaciones van como Map por id: cada renglón de rollo los
 * busca para pintar su nombre, y con cientos de rollos en pantalla un
 * `find` por renglón se nota en un celular modesto.
 */
export function useOfflineCatalog(): OfflineCatalog {
  const [catalog, setCatalog] = useState<OfflineCatalog>(EMPTY_CATALOG);

  useEffect(() => {
    let cancelled = false;

    void loadCatalog().then((next) => {
      if (!cancelled) setCatalog(next);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  return catalog;
}

async function loadCatalog(): Promise<OfflineCatalog> {
  if (!isOfflineDbAvailable()) return { ...EMPTY_CATALOG, loaded: true };

  const db = offlineDb();
  const [clients, materials, locations] = await Promise.all([
    db.snapshot("clients").orderBy("name").toArray(),
    db.snapshot("materials").toArray(),
    db.snapshot("locations").toArray(),
  ]);

  return {
    clients,
    materials: new Map(materials.map((material) => [material.id, material])),
    locations: new Map(locations.map((location) => [location.id, location])),
    loaded: true,
  };
}

/**
 * Los rollos de UN cliente, retazos primero y luego lo más viejo.
 *
 * Sólo los del dueño elegido: la tela es del cliente que manda a maquilar y
 * jamás se surte la de uno a la producción de otro. Sin cliente elegido no
 * se ofrece ninguno.
 *
 * Se descartan los bloqueados: el servidor tampoco dejaría surtirlos, y
 * ofrecerlos sólo garantiza un rechazo al volver la señal.
 */
export function useOfflineLotsOf(clientId: string): OfflineLot[] {
  const [state, setState] = useState<{ clientId: string; lots: OfflineLot[] }>({
    clientId: "",
    lots: [],
  });

  useEffect(() => {
    if (!clientId || !isOfflineDbAvailable()) return;
    let cancelled = false;

    void offlineDb()
      .snapshot("lots")
      .where("clientId")
      .equals(clientId)
      .toArray()
      .then((lots) => {
        if (!cancelled) setState({ clientId, lots: sortForIssue(lots) });
      });

    return () => {
      cancelled = true;
    };
  }, [clientId]);

  // Mientras llega la lectura del cliente nuevo no se enseñan los del anterior.
  return state.clientId === clientId ? state.lots : [];
}

function sortForIssue(lots: OfflineLot[]): OfflineLot[] {
  return lots
    .filter((lot) => !lot.isBlocked)
    .sort((a, b) => {
      if (a.isRemnant !== b.isRemnant) return a.isRemnant ? -1 : 1;
      return a.receivedAt.localeCompare(b.receivedAt);
    });
}
