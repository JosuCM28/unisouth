"use client";

import { useEffect } from "react";

/** Alto y ancho útiles de una carta/A4 con el margen de 1.5cm de `@page`. */
const USABLE_HEIGHT_CM = 26.7;
const USABLE_WIDTH_CM = 18;
const PX_PER_CM = 96 / 2.54;

/**
 * Por debajo de esto la hoja ya no se lee de pie, con mala luz y a un brazo de
 * distancia. Antes que imprimir un vale ilegible, se deja pasar a dos hojas.
 */
const MIN_SCALE = 0.62;

interface Props {
  /** Id del contenedor a escalar. Debe llevar la clase `print-sheet`. */
  targetId: string;
}

/**
 * Encoge la hoja lo justo para que quepa en UNA página al imprimir.
 *
 * El vale es de alto variable: tres tallas y sin rollos ocupa media hoja,
 * dieciocho tallas con diez rollos se pasa de largo. Un tamaño de letra fijo
 * no puede servir a los dos casos —el que le queda bien al vale largo deja el
 * corto ridículamente pequeño—, así que la escala se calcula midiendo el
 * contenido real contra el alto útil del papel.
 *
 * Se mide con el ancho de impresión forzado y no con el de la pantalla: el
 * mismo texto ocupa distinto número de renglones en 18 cm que en la ventana
 * del navegador, y medir en pantalla daba una escala que no correspondía a lo
 * que salía por la impresora.
 *
 * Sólo achica, nunca agranda: un vale corto se imprime a tamaño natural, que
 * es lo que se lee mejor.
 */
export function FitToPage({ targetId }: Props) {
  useEffect(() => {
    const target = document.getElementById(targetId);
    if (!target) return;

    function fit() {
      if (!target) return;

      /* Se mide con la escala anterior anulada: si no, la segunda medición
         leería el alto ya encogido y la hoja se iría achicando en cada
         impresión hasta desaparecer. */
      target.style.setProperty("--print-scale", "1");

      const previousWidth = target.style.width;
      const previousMaxWidth = target.style.maxWidth;

      target.style.width = `${USABLE_WIDTH_CM * PX_PER_CM}px`;
      target.style.maxWidth = `${USABLE_WIDTH_CM * PX_PER_CM}px`;

      /* Lo que no se imprime tampoco cuenta para el alto: en pantalla el botón
         de imprimir ocupa un centímetro que en el papel no existe, y medirlo
         hacía encoger la hoja de más. Se esconde durante la medición y se
         devuelve enseguida, sin que dé tiempo a pintarse.

         Los dos puntos van escapados: en CSS `.print:hidden` sería una
         pseudoclase inexistente, no la clase de Tailwind. */
      const hidden = [
        ...target.querySelectorAll<HTMLElement>(".print\\:hidden"),
      ];
      for (const element of hidden) element.style.display = "none";

      const height = target.getBoundingClientRect().height;

      for (const element of hidden) element.style.display = "";
      target.style.width = previousWidth;
      target.style.maxWidth = previousMaxWidth;

      if (height <= 0) return;

      const needed = (USABLE_HEIGHT_CM * PX_PER_CM) / height;
      const scale = Math.min(1, Math.max(MIN_SCALE, needed));

      target.style.setProperty("--print-scale", String(scale));
    }

    fit();

    /* Se vuelve a medir justo antes de imprimir: entre la carga y el momento
       en que alguien le da a imprimir pueden haber terminado de cargar las
       fuentes, y con otra fuente el contenido ocupa otro alto. */
    window.addEventListener("beforeprint", fit);
    return () => window.removeEventListener("beforeprint", fit);
  }, [targetId]);

  return null;
}
