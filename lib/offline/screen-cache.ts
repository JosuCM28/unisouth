"use client";

/**
 * Deja guardadas en el navegador las pantallas que deben abrir sin señal.
 *
 * El service worker guarda una pantalla sólo cuando se VISITA. Si el
 * auxiliar nunca abrió "Salida sin conexión" con señal, el día que se va el
 * WiFi esa pantalla no existe en su celular. Aquí se guardan a propósito al
 * terminar de bajar la copia, que es justo el momento en que hay señal.
 *
 * Se guarda el HTML y también el JS/CSS que pide: sin ellos la pantalla abre
 * muerta (ver el comentario de STATIC_CACHE en public/sw.js).
 *
 * Los nombres de caché DEBEN coincidir con los de public/sw.js: el service
 * worker no es un módulo y no puede importar estas constantes.
 */
const PAGE_CACHE = "unisouth-v1";
const STATIC_CACHE = "unisouth-static-v1";

/** Las pantallas que trabajan sobre la copia local. */
export const OFFLINE_SCREENS = ["/offline-data", "/issues/offline"];

const ASSET_PATTERN = /(?:src|href)="(\/_next\/static\/[^"]+)"/g;

export async function warmOfflineScreens(): Promise<void> {
  if (typeof caches === "undefined") return;

  await Promise.all(OFFLINE_SCREENS.map((path) => warmScreen(path)));
}

/**
 * Una pantalla y sus archivos. Si falla —sin permiso, sin señal— se ignora:
 * calentar es una ayuda, no algo que deba tumbar la sincronización.
 */
async function warmScreen(path: string): Promise<void> {
  try {
    const response = await fetch(path, { credentials: "same-origin" });

    // Una redirección es el login o "sin permiso": guardar eso como la
    // pantalla mostraría el login sin señal en lugar de la captura.
    if (!response.ok || response.redirected) return;

    const html = await response.clone().text();
    await (await caches.open(PAGE_CACHE)).put(path, response);
    await cacheAssets(html);
  } catch (error) {
    console.warn(`[offline] No se pudo guardar ${path}:`, error);
  }
}

async function cacheAssets(html: string): Promise<void> {
  const found = [...html.matchAll(ASSET_PATTERN)]
    .map((match) => match[1])
    .filter((asset): asset is string => Boolean(asset));
  const assets = [...new Set(found)];
  const cache = await caches.open(STATIC_CACHE);

  // Uno por uno con `add` y no `addAll`: con `addAll` un solo archivo que
  // falle descarta todos los demás.
  await Promise.all(
    assets.map((asset) => cache.add(asset).catch(() => undefined)),
  );
}
