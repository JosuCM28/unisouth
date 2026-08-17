"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * Observa un media query desde el cliente.
 *
 * Se usa para elegir entre Dialog (escritorio) y Sheet inferior (celular).
 * No basta con CSS: son dos componentes distintos, no el mismo con otro
 * estilo, y montar los dos duplicaría los campos del formulario en el DOM.
 *
 * Va con `useSyncExternalStore` y no con `useState` + `useEffect` porque el
 * media query ES un store externo: React se suscribe a él y lee su valor sin
 * provocar el render en cascada que causaba el `setState` dentro del efecto.
 */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const media = window.matchMedia(query);
      media.addEventListener("change", onChange);
      return () => media.removeEventListener("change", onChange);
    },
    [query],
  );

  const getSnapshot = useCallback(
    () => window.matchMedia(query).matches,
    [query],
  );

  // En el servidor no hay `window`. Se asume celular: si se adivinara
  // escritorio, el primer render pintaría un Dialog que al hidratar salta a
  // Sheet, y el usuario vería el parpadeo.
  const getServerSnapshot = useCallback(() => false, []);

  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/** El breakpoint `md` de Tailwind: debajo de 768px manda la interfaz móvil. */
export function useIsDesktop(): boolean {
  return useMediaQuery("(min-width: 768px)");
}
