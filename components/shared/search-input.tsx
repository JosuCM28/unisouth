"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface SearchInputProps {
  placeholder?: string;
  /** Parámetro de la URL donde se escribe el término. */
  paramName?: string;
  className?: string;
}

const DEBOUNCE_MS = 350;

/**
 * Buscador que guarda el término en la URL.
 *
 * Va en la URL y no en un estado local para que el resultado se pueda
 * compartir y sobreviva a un refresh —clave con el WiFi de la bodega—, y
 * para que la lista siga siendo Server Component.
 *
 * `router.replace` en vez de `push`: si cada letra tecleada dejara una
 * entrada en el historial, el botón "atrás" tardaría 12 toques en salir.
 */
export function SearchInput({
  placeholder = "Buscar…",
  paramName = "q",
  className,
}: SearchInputProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [value, setValue] = useState(searchParams.get(paramName) ?? "");

  useEffect(() => {
    // Se espera a que deje de teclear: sin esto se dispara una consulta por
    // cada letra y con conexión lenta se encima el resultado viejo.
    const timeout = setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString());

      if (value.trim()) {
        params.set(paramName, value.trim());
      } else {
        params.delete(paramName);
      }

      // Al cambiar la búsqueda se vuelve a la primera página; si no, se
      // queda en la 4 de un resultado que ahora tiene una sola.
      params.delete("page");

      const query = params.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, {
        scroll: false,
      });
    }, DEBOUNCE_MS);

    return () => clearTimeout(timeout);
    // `searchParams` queda fuera a propósito: se relee dentro del timeout y
    // agregarlo dispararía el efecto en cada navegación.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, paramName, pathname, router]);

  return (
    <div className={cn("relative", className)}>
      <Search
        className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
        aria-hidden
      />
      <Input
        type="search"
        inputMode="search"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className="touch-target pl-9"
      />
    </div>
  );
}
