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
        Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Sólo se cachea la navegación GET. Las Server Actions son POST y JAMÁS
  // deben pasar por aquí: reproducir de caché un alta de rollo la duplicaría.
  if (request.method !== "GET") return;
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
        const cached = await caches.match(request);
        if (cached) return cached;

        // Nunca se visitó esta pantalla: al menos la app abre y desde ahí se
        // llega a lo pendiente.
        return caches.match(OFFLINE_URL);
      }),
  );
});
