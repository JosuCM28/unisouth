"use client";

import { useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

interface FormSectionProps {
  title: string;
  description?: string;
  /** Abierta de entrada. Se usa para la sección de campos obligatorios. */
  defaultOpen?: boolean;
  children: ReactNode;
}

/**
 * Sección plegable de un formulario.
 *
 * Los campos opcionales van agrupados y cerrados: mostrar veinte campos de
 * golpe hace que el auxiliar crea que todos son obligatorios y abandone la
 * captura antes de empezar.
 */
export function FormSection({
  title,
  description,
  defaultOpen = false,
  children,
}: FormSectionProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <Collapsible
      open={open}
      onOpenChange={setOpen}
      className="border-t border-border pt-2 first:border-t-0 first:pt-0"
    >
      <CollapsibleTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          className="touch-target w-full justify-between px-0"
        >
          <span className="text-sm font-medium">{title}</span>
          <ChevronDown
            className={cn("size-4 transition-transform", open && "rotate-180")}
            aria-hidden
          />
        </Button>
      </CollapsibleTrigger>

      <CollapsibleContent className="flex flex-col gap-4 pb-2 pt-1">
        {description && (
          <p className="text-xs text-muted-foreground">{description}</p>
        )}
        {children}
      </CollapsibleContent>
    </Collapsible>
  );
}
