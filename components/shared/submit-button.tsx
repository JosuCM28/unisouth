"use client";

import type { ComponentProps, ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface SubmitButtonProps extends ComponentProps<typeof Button> {
  isSubmitting?: boolean;
  /** Texto mientras se guarda. Sin él se conserva el original. */
  pendingLabel?: string;
  children: ReactNode;
}

/**
 * Botón de envío con estado de carga.
 *
 * Se deshabilita mientras guarda: en el piso, con WiFi intermitente, el
 * auxiliar vuelve a picarle si no ve respuesta, y sin esto se registraría
 * el mismo corte dos veces.
 */
export function SubmitButton({
  isSubmitting = false,
  pendingLabel,
  children,
  className,
  disabled,
  ...props
}: SubmitButtonProps) {
  return (
    <Button
      type="submit"
      disabled={disabled || isSubmitting}
      className={cn("touch-target", className)}
      {...props}
    >
      {isSubmitting && <Loader2 className="animate-spin" aria-hidden />}
      {isSubmitting && pendingLabel ? pendingLabel : children}
    </Button>
  );
}
