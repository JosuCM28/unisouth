"use client";

import { useEffect } from "react";

/**
 * Altura mínima de teclado que se considera "abierto".
 *
 * En Android la barra de direcciones al colapsarse cambia el viewport unos
 * 50-60px, y eso NO es un teclado. Se pide un recorte grande para no ocultar
 * la barra inferior cada vez que el usuario scrollea.
 */
const KEYBOARD_MIN_HEIGHT = 120;

/** Aire entre el campo enfocado y el borde superior del teclado. */
const FIELD_MARGIN = 16;

/** Alto del encabezado sticky de celular (h-14). Tapa lo que quede debajo. */
const MOBILE_HEADER_HEIGHT = 56;

const FIELD_SELECTOR =
  "input:not([type=hidden]):not([type=checkbox]):not([type=radio]):not([type=submit]):not([type=button]), textarea, [contenteditable='true']";

/**
 * Hace que el teclado del celular deje de tapar el campo que se está
 * capturando.
 *
 * El navegador móvil NO reflowea la página al abrir el teclado: encoge el
 * *visual viewport* y deja el layout igual, así que el input enfocado puede
 * quedar detrás del teclado sin que ninguna regla de CSS se entere. Esto se
 * monta una sola vez en el layout y arregla TODOS los formularios de la app
 * a la vez, en vez de parchar campo por campo:
 *
 * 1. Publica el recorte del teclado en `--keyboard-inset` y marca
 *    `data-keyboard-open` en el `<html>`. Con eso el CSS esconde la barra
 *    inferior —que con el teclado abierto sólo roba 64px de los pocos que
 *    quedan visibles— y las hojas inferiores se recortan para que su scroll
 *    interno sí alcance el último campo.
 *
 * 2. Sube el campo enfocado a la franja visible. Se hace en el `resize` del
 *    visual viewport y no sólo en el `focus` porque el teclado abre DESPUÉS
 *    del foco: un `scrollIntoView` en el `focus` mide una pantalla que aún no
 *    tiene teclado y el campo vuelve a quedar tapado. Ésa es exactamente la
 *    razón por la que el comportamiento nativo del navegador falla aquí.
 */
export function KeyboardInsets() {
  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;

    const root = document.documentElement;

    /** Cuántos píxeles del layout tapa el teclado en este momento. */
    function keyboardHeight(): number {
      if (!viewport) return 0;
      const hidden =
        window.innerHeight - viewport.height - viewport.offsetTop;
      return hidden > KEYBOARD_MIN_HEIGHT ? Math.round(hidden) : 0;
    }

    function focusedField(): HTMLElement | null {
      const active = document.activeElement;
      if (!(active instanceof HTMLElement)) return null;
      return active.matches(FIELD_SELECTOR) ? active : null;
    }

    /**
     * Sube el campo lo justo para que se vea completo sobre el teclado.
     *
     * Se scrollea el contenedor con overflow más cercano y no siempre la
     * ventana: los formularios viven dentro de hojas y diálogos que scrollean
     * por dentro, y ahí mover la ventana no cambia nada.
     */
    function revealField(field: HTMLElement) {
      const inset = keyboardHeight();
      const rect = field.getBoundingClientRect();

      // Franja realmente visible: debajo del encabezado sticky y encima del
      // teclado.
      const top = MOBILE_HEADER_HEIGHT + FIELD_MARGIN;
      const bottom = window.innerHeight - inset - FIELD_MARGIN;

      if (rect.bottom <= bottom && rect.top >= top) return;

      const scroller = scrollableAncestor(field);
      const delta =
        rect.bottom > bottom
          ? rect.bottom - bottom
          : rect.top - top;

      /* Salto instantáneo, no `smooth`: el teclado entra con su propia
         animación y una de scroll encima llega tarde —el campo se ve subir
         cuando el teclado ya lo tapó— además de marearse en pantalla chica.
         Así se comportan los formularios nativos. */
      if (scroller) {
        scroller.scrollBy({ top: delta, behavior: "auto" });
        return;
      }

      window.scrollBy({ top: delta, behavior: "auto" });
    }

    function scrollableAncestor(node: HTMLElement): HTMLElement | null {
      let parent = node.parentElement;

      while (parent && parent !== document.body) {
        const { overflowY } = getComputedStyle(parent);
        const scrolls = overflowY === "auto" || overflowY === "scroll";
        if (scrolls && parent.scrollHeight > parent.clientHeight) return parent;
        parent = parent.parentElement;
      }

      return null;
    }

    /** Publica el recorte del teclado. No mueve nada por su cuenta. */
    function publishInset() {
      const inset = keyboardHeight();

      root.style.setProperty("--keyboard-inset", `${inset}px`);
      if (inset > 0) {
        root.dataset.keyboardOpen = "true";
      } else {
        delete root.dataset.keyboardOpen;
      }
    }

    /** Cambió el alto visible: casi siempre porque acaba de abrir el teclado. */
    function handleResize() {
      publishInset();

      const field = focusedField();
      if (field) revealField(field);
    }

    /**
     * Al enfocar también se reacomoda, con retraso.
     *
     * Cubre el caso de cambiar de un campo a otro con el teclado YA abierto:
     * ahí el viewport no cambia de tamaño y el `resize` nunca dispara.
     */
    function handleFocusIn(event: FocusEvent) {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      if (!target.matches(FIELD_SELECTOR)) return;

      // El teclado tarda en aparecer; medir antes daría la pantalla completa.
      window.setTimeout(() => {
        if (document.activeElement === target) revealField(target);
      }, 300);
    }

    viewport.addEventListener("resize", handleResize);

    /* El scroll SÓLO republica la medida. Si además reacomodara, el auxiliar
       no podría apartar la vista del campo para consultar el renglón de
       arriba: la pantalla lo regresaría de un tirón en cada arrastre. */
    viewport.addEventListener("scroll", publishInset);
    document.addEventListener("focusin", handleFocusIn);

    handleResize();

    return () => {
      viewport.removeEventListener("resize", handleResize);
      viewport.removeEventListener("scroll", publishInset);
      document.removeEventListener("focusin", handleFocusIn);
      root.style.removeProperty("--keyboard-inset");
      delete root.dataset.keyboardOpen;
    };
  }, []);

  return null;
}
