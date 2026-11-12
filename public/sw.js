/**
 * Service worker de Unisouth.
 *
 * Su único trabajo es que la app ABRA sin internet. La cola de capturas vive
 * en IndexedDB y no depende de esto; sin service worker, recargar la pantalla
 * en un punto muerto del almacén dejaba una página de error del navegador y
 * la cola quedaba inalcanzable hasta volver a tener señal.
 *
 * Estrategia: la red primero, y sólo si falla se sirve la copia guardada.
 * Es al revés de lo habitual a propósito — el inventario cambia todo el día y
 * servir de caché un saldo viejo teniendo señal sería peor que tardar.
 */

const CACHE = "unisouth-v1";
const OFFLINE_URL = "/offline";

/**
 * Los archivos de código de la app (JS y CSS de `/_next/static/`).
 *
 * Sin ellos, la pantalla guardada abre sin internet pero MUERTA: el HTML
 * llega y los botones no responden, porque el JavaScript que los mueve no se
 * pudo bajar. Y la copia sin conexión vive en IndexedDB, que sólo se lee con
 * ese JavaScript.
 *
 * Aquí sí es caché primero, al revés que las pantallas: cada archivo de
 * `/_next/static/` lleva un hash en el nombre y nunca cambia de contenido.
 * Un deploy nuevo trae nombres nuevos, así que servirlo de caché nunca da
 * una versión vieja.
 */
// Los dos nombres se repiten en lib/offline/screen-cache.ts: si cambian
// aquí, cambian allá, o la app guardaría pantallas donde nadie las busca.
const STATIC_CACHE = "unisouth-static-v1";
const STATIC_PREFIX = "/_next/static/";
const KEPT_CACHES = [CACHE, STATIC_CACHE];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll([OFFLINE_URL])),
  );
  // Entra en vigor sin esperar a que se cierren las pestañas viejas.
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => !KEPT_CACHES.includes(key))
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Sólo se cachea la navegación GET. Las Server Actions son POST y JAMÁS
  // deben pasar por aquí: reproducir de caché un alta de rollo la duplicaría.
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin === self.location.origin && url.pathname.startsWith(STATIC_PREFIX)) {
    event.respondWith(serveStatic(request));
    return;
  }

  if (request.mode !== "navigate") return;

  event.respondWith(
    fetch(request)
      .then((response) => {
        // Se guarda copia de lo que sí cargó, para poder mostrarlo sin red.
        const copy = response.clone();
        caches.open(CACHE).then((cache) => cache.put(request, copy));
        return response;
      })
      .catch(async () => {
        // Primero la gemela que trabaja sobre la copia: una pantalla del
        // servidor guardada de otro día enseña saldos viejos y, al tocar
        // cualquier cosa, vuelve a intentar la red y recarga en bucle.
        const offlineScreen = offlineScreenFor(url.pathname);
        if (offlineScreen) {
          // ignoreSearch: `/lots/offline?material=…` se guardó sin el filtro.
          const screen = await caches.match(offlineScreen, { ignoreSearch: true });
          if (screen) return screen;
        }

        const cached = await caches.match(request);
        if (cached) return cached;

        // Nunca se visitó esta pantalla: al menos la app abre y desde ahí se
        // llega a lo pendiente.
        return caches.match(OFFLINE_URL);
      }),
  );
});

/**
 * Las pantallas que abren sin red y a cuál se manda cada pantalla del
 * servidor que tiene gemela. Se repiten de lib/constants/offline-routes.ts:
 * el service worker no es un módulo y no puede importarlas.
 */
const OFFLINE_SCREENS = [
  "/offline-data",
  "/issues/offline",
  "/lots/offline",
  "/materials/offline",
  "/orders/offline",
];
const OFFLINE_ALTERNATES = {
  "/lots": "/lots/offline",
  "/materials": "/materials/offline",
  "/orders": "/orders/offline",
  "/issues": "/issues/offline",
  "/issues/new": "/issues/offline",
};

function offlineScreenFor(pathname) {
  if (OFFLINE_SCREENS.includes(pathname)) return pathname;
  return OFFLINE_ALTERNATES[pathname] ?? null;
}

/**
 * Caché primero para el código de la app. Sólo se guarda lo que llegó bien:
 * un 404 guardado aquí dejaría la pantalla rota para siempre en ese equipo.
 */
async function serveStatic(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  const response = await fetch(request);
  if (response.ok) {
    const copy = response.clone();
    caches.open(STATIC_CACHE).then((cache) => cache.put(request, copy));
  }
  return response;
}
