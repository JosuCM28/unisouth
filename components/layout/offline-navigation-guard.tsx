"use client";

import { useEffect } from "react";
import { toast } from "sonner";
import { offlineRouteFor } from "@/lib/constants/offline-routes";

/**
 * Sin señal, decide a dónde lleva cada toque a un enlace.
 *
 * El problema que resuelve: sin red, la navegación de Next no puede pedirle
 * la pantalla al servidor y, al fallar, recarga la página completa. El
 * service worker contesta con una copia vieja o con "Sin conexión", y el
 * usuario siente que la app lo regresa al inicio cada vez que toca algo
 * —el menú, una tarjeta, "Cargar más"—.
 *
 * Escucha en fase de captura sobre todo el documento para alcanzar también
 * los enlaces dentro de las páginas, no sólo los del menú. Con señal no hace
 * nada: la navegación normal sigue igual.
 */
export function OfflineNavigationGuard() {
  useEffect(() => {
    function onClick(event: MouseEvent) {
      if (navigator.onLine) return;

      const target = internalLinkTarget(event);
      if (!target) return;

      event.preventDefault();
      event.stopPropagation();

      const offlineRoute = offlineRouteFor(target.pathname);
      if (offlineRoute) {
        /* Carga completa a propósito: el router de Next no puede navegar sin
           red, y la carga completa la contesta el service worker con la
           pantalla guardada. Se conserva `?material=` y similares. */
        // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- router.push no navega sin red; ver arriba.
        window.location.assign(`${offlineRoute}${target.search}`);
        return;
      }

      toast.info("Esa pantalla necesita internet", {
        description: "Sin conexión puedes usar Inventario, Materiales, Órdenes y Salidas.",
      });
    }

    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  return null;
}

/**
 * La URL del enlace tocado, si es una navegación interna normal.
 *
 * Se dejan pasar los toques con modificador, las pestañas nuevas y las
 * descargas: no recargan esta página, así que no hay bucle que evitar.
 */
function internalLinkTarget(event: MouseEvent): URL | null {
  if (event.defaultPrevented || event.button !== 0) return null;
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return null;

  const anchor = (event.target as Element | null)?.closest("a[href]");
  if (!(anchor instanceof HTMLAnchorElement)) return null;
  if (anchor.target && anchor.target !== "_self") return null;
  if (anchor.hasAttribute("download")) return null;

  const url = new URL(anchor.href);
  if (url.origin !== window.location.origin) return null;

  // Un ancla dentro de la misma página no navega.
  const samePage = url.pathname === window.location.pathname && url.search === window.location.search;
  if (samePage && url.hash) return null;

  return url;
}
