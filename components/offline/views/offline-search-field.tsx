"use client";

import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";

interface Props {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  label: string;
}

/** El buscador de las vistas sin conexión: grande, con teclado de búsqueda. */
export function OfflineSearchField({ value, onChange, placeholder, label }: Props) {
  return (
    <div className="relative">
      <Search
        className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
        aria-hidden
      />
      <Input
        inputMode="search"
        placeholder={placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="touch-target pl-9"
        aria-label={label}
      />
    </div>
  );
}

/**
 * Lo que se busca, en mayúsculas y sin la URL del QR.
 *
 * La pistola lectora "teclea" la URL completa del QR (`…/r/R-2026-00841`):
 * se recorta al folio para que escanear funcione igual que escribirlo.
 */
export function normalizeTerm(raw: string): string {
  const fromQr = raw.match(/\/r\/([^/?#]+)/i);
  return (fromQr?.[1] ?? raw).trim().toUpperCase();
}

/** ¿El texto armado con los campos del registro contiene lo buscado? */
export function matches(term: string, fields: (string | null | undefined)[]): boolean {
  if (!term) return true;
  return fields.filter(Boolean).join(" ").toUpperCase().includes(term);
}

/**
 * Tope de renglones en pantalla. Pintar miles de tarjetas en un celular sin
 * señal es lento y nadie las recorre: se escribe y se afina.
 */
export const MAX_RESULTS = 60;
