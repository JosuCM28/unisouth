"use client";

import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface Props {
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

/**
 * Buscador de las entregas del taller.
 *
 * Filtra en el navegador y no en la URL como `SearchInput`: la lista ya llegó
 * completa (tiene tope), así que responde al teclear sin esperar al servidor,
 * aunque la señal se caiga.
 */
export function DeliveryFilter({ value, onChange, className }: Props) {
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
        onChange={(event) => onChange(event.target.value)}
        placeholder="Empresa, orden, prenda o PO…"
        aria-label="Buscar entregas"
        className="touch-target pl-9"
      />
    </div>
  );
}
