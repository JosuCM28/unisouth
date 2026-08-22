"use client";

import { useEffect } from "react";

/**
 * Registra el service worker.
 *
 * No pinta nada: sólo existe para que la app abra sin internet. Va en el
 * layout raíz porque debe registrarse una sola vez por sesión, no en cada
 * pantalla.
 *
 * En desarrollo NO se registra: el service worker cachearía las pantallas y
 * los cambios de código dejarían de verse hasta limpiar la caché a mano.
 */
export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;

    // Tras `load` para no competir por ancho de banda con la primera pintura.
    function register() {
      navigator.serviceWorker.register("/sw.js").catch((error) => {
        // Que falle el registro no debe tumbar la app: sin él se pierde el
        // poder abrirla sin red, pero la cola de capturas sigue funcionando.
        console.error("[sw] No se pudo registrar:", error);
      });
    }

    if (document.readyState === "complete") {
      register();
      return;
    }

    window.addEventListener("load", register);
    return () => window.removeEventListener("load", register);
  }, []);

  return null;
}
