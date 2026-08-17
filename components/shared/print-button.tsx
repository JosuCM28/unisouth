"use client";

import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Botón de imprimir. `print:hidden` lo saca de la hoja: no tiene sentido
 * imprimir el botón de imprimir.
 */
export function PrintButton() {
  return (
    <div className="mb-4 flex justify-end print:hidden">
      <Button type="button" onClick={() => window.print()} className="touch-target">
        <Printer className="size-4" aria-hidden />
        Imprimir
      </Button>
    </div>
  );
}
