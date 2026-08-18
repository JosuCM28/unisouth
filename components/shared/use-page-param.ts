"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

/**
 * Navegación de página atada a la URL.
 *
 * La página vive en la URL y no en `useState` para que el resultado se pueda
 * compartir, sobreviva a un refresh —clave con el WiFi de la bodega— y el
 * botón "atrás" del navegador regrese a la página anterior en vez de salirse
 * de la pantalla.
 *
 * Devuelve el manejador que espera `DataTable` en modo servidor.
 */
export function usePageParam(): {
  onPageChange: (page: number) => void;
  onLoadMore: (currentPage: number) => void;
  onPageSizeChange: (size: number) => void;
} {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function go(page: number, accumulate: boolean) {
    const params = new URLSearchParams(searchParams.toString());

    // La página 1 no se escribe: una URL limpia es la que se comparte.
    if (page <= 1) params.delete("page");
    else params.set("page", String(page));

    /* El acumulado es del celular y se marca en la URL: el servidor no puede
       saber el ancho de la pantalla, y sin la marca un enlace compartido
       traería 300 filas a un escritorio que sólo necesita 50. */
    if (accumulate) params.set("all", "1");
    else params.delete("all");

    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }

  function setPageSize(size: number) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("filas", String(size));
    /* Se vuelve a la primera página: con 100 filas por página, seguir en la 7
       mostraría una lista vacía porque ya no existen tantas páginas. */
    params.delete("page");
    params.delete("all");
    router.push(`${pathname}?${params}`, { scroll: false });
  }

  return {
    onPageChange: (page) => go(page, false),
    // Al cargar más NO se sube al inicio: el pulgar se queda donde estaba.
    onLoadMore: (currentPage) => go(currentPage + 1, true),
    onPageSizeChange: setPageSize,
  };
}
