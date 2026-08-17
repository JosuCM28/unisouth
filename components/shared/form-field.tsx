"use client";

import type { ComponentProps, ReactNode } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

interface FormFieldProps extends ComponentProps<typeof Input> {
  id: string;
  label: string;
  error?: string;
  hint?: string;
  /** Sufijo de unidad ("mm", "oz", "%") pegado al campo. */
  suffix?: string;
}

/**
 * Campo de texto con etiqueta, error y unidad.
 *
 * Concentra el área táctil de 44px y el `aria-invalid` para que no dependan
 * de que quien escriba el siguiente formulario se acuerde de ponerlos.
 */
export function FormField({
  id,
  label,
  error,
  hint,
  suffix,
  className,
  ...props
}: FormFieldProps) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{label}</Label>

      <div className="relative">
        <Input
          id={id}
          aria-invalid={Boolean(error)}
          className={cn("touch-target", suffix && "pr-12", className)}
          {...props}
        />
        {suffix && (
          <span
            className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground"
            aria-hidden
          >
            {suffix}
          </span>
        )}
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}
      {!error && hint && (
        <p className="text-xs text-muted-foreground">{hint}</p>
      )}
    </div>
  );
}

interface FormSelectFieldProps {
  id: string;
  label: string;
  error?: string;
  hint?: string;
  children: ReactNode;
}

/** Envoltura de un Select con la misma etiqueta y error que FormField. */
export function FormSelectField({
  id,
  label,
  error,
  hint,
  children,
}: FormSelectFieldProps) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {error && <p className="text-sm text-destructive">{error}</p>}
      {!error && hint && (
        <p className="text-xs text-muted-foreground">{hint}</p>
      )}
    </div>
  );
}
