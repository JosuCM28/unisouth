"use client";

import { Check } from "lucide-react";
import {
  BOARD_COLORS,
  BOARD_COLOR_DOT,
  type BoardColor,
} from "@/lib/constants/board-colors";
import { cn } from "@/lib/utils";

/**
 * Los seis colores del tablero.
 *
 * Botones sólidos y no un `<input type="color">`: en la bodega el color sirve
 * para agrupar de un vistazo ("lo rojo urge"), y una rueda de 16 millones de
 * tonos haría que cada tarjeta acabara de un color distinto.
 */
export function ColorPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (color: BoardColor) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label="Color">
      {BOARD_COLORS.map((color) => (
        <button
          key={color.key}
          type="button"
          onClick={() => onChange(color.key)}
          aria-label={color.label}
          aria-pressed={value === color.key}
          className={cn(
            "touch-target flex size-11 items-center justify-center rounded border",
            value === color.key ? "border-foreground" : "border-border",
          )}
        >
          <span
            className={cn("flex size-6 items-center justify-center rounded", BOARD_COLOR_DOT[color.key])}
          >
            {value === color.key && (
              <Check className="size-4 text-white" aria-hidden />
            )}
          </span>
        </button>
      ))}
    </div>
  );
}
