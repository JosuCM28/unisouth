/**
 * Las pantallas que trabajan sobre la copia local y abren sin internet.
 *
 * Se guardan en el navegador al sincronizar (`warmOfflineScreens`) para que
 * existan aunque nunca se hayan visitado con señal.
 *
 * public/sw.js repite estas rutas: el service worker no es un módulo y no
 * puede importarlas. Si cambian aquí, cambian allá.
 */
export const OFFLINE_SCREENS = [
  "/offline-data",
  "/issues/offline",
  "/lots/offline",
  "/materials/offline",
  "/orders/offline",
] as const;

/**
 * A dónde se va SIN SEÑAL quien pide una pantalla que necesita el servidor.
 *
 * Sólo las que tienen gemela sobre la copia. El resto no tiene a dónde ir y
 * se avisa en vez de navegar: navegar sin red hace que Next recargue la
 * página completa y el usuario termina en una copia vieja o en la pantalla
 * genérica de "Sin conexión", que es el "me regresa al inicio".
 */
export const OFFLINE_ALTERNATES: Record<string, string> = {
  "/lots": "/lots/offline",
  "/materials": "/materials/offline",
  "/orders": "/orders/offline",
  "/issues": "/issues/offline",
  "/issues/new": "/issues/offline",
};

/** La versión que abre sin red de esta ruta, o null si no tiene. */
export function offlineRouteFor(pathname: string): string | null {
  if ((OFFLINE_SCREENS as readonly string[]).includes(pathname)) return pathname;
  return OFFLINE_ALTERNATES[pathname] ?? null;
}
