"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";

/** Mapa columna → visible. Sólo guarda lo que el usuario decidió a mano. */
export type ColumnVisibility = Record<string, boolean>;

/** Aviso entre pestañas Y dentro de la misma: `storage` sólo cruza pestañas. */
const CHANGE_EVENT = "column-visibility-change";

function subscribe(onChange: () => void): () => void {
  window.addEventListener("storage", onChange);
  window.addEventListener(CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(CHANGE_EVENT, onChange);
  };
}

/* Modo privado o almacenamiento bloqueado lanzan al leer: ahí la tabla
   simplemente arranca con las columnas por omisión. */
function readRaw(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function parse(raw: string | null): ColumnVisibility {
  if (!raw) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    if (parsed && typeof parsed === "object") return parsed as ColumnVisibility;
  } catch {
    // Basura en el almacenamiento: se ignora y se vuelve a los valores base.
  }
  return {};
}

/**
 * Qué columnas de una tabla se ven, recordado por navegador.
 *
 * En `localStorage` y no en la base: es una comodidad de quien mira, no un
 * dato del negocio, y cada quien acomoda su pantalla distinto. Se guarda sólo
 * lo que se tocó y lo demás cae a `defaults`, así que una columna nueva que
 * nazca escondida —como la PO del cliente— no aparece sola en la pantalla de
 * alguien que ya había acomodado las suyas.
 */
export function useColumnVisibility(
  storageKey: string,
  defaults: ColumnVisibility,
) {
  const key = `columns:${storageKey}`;
  /* Se suscribe a la cadena cruda y no al objeto: una cadena se compara por
     valor, y así React no ve un "cambio" en cada render. En el servidor no
     hay almacenamiento y se pinta lo base. */
  const raw = useSyncExternalStore(
    subscribe,
    () => readRaw(key),
    () => null,
  );

  const visibility = useMemo(
    () => ({ ...defaults, ...parse(raw) }),
    [defaults, raw],
  );

  const setVisible = useCallback(
    (columnId: string, visible: boolean) => {
      const next = { ...parse(readRaw(key)), [columnId]: visible };
      try {
        window.localStorage.setItem(key, JSON.stringify(next));
      } catch {
        // Sin almacenamiento el cambio no se recuerda, pero tampoco truena.
      }
      window.dispatchEvent(new Event(CHANGE_EVENT));
    },
    [key],
  );

  return { visibility, setVisible };
}
