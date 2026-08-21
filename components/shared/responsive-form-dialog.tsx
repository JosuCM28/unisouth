"use client";

import type { ReactNode } from "react";
import { useIsDesktop } from "@/hooks/use-media-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

interface ResponsiveFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  trigger: ReactNode;
  children: ReactNode;
}

/**
 * Diálogo en escritorio, hoja inferior en celular.
 *
 * Son dos componentes distintos, no el mismo con otro estilo: en el piso la
 * hoja sube desde abajo, al alcance del pulgar. Montar ambos y ocultar uno
 * con CSS duplicaría los inputs en el DOM.
 */
export function ResponsiveFormDialog({
  open,
  onOpenChange,
  title,
  description,
  trigger,
  children,
}: ResponsiveFormDialogProps) {
  const isDesktop = useIsDesktop();

  if (isDesktop) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogTrigger asChild>{trigger}</DialogTrigger>
        <DialogContent className="keyboard-aware-dialog max-h-[85dvh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            {description && (
              <DialogDescription>{description}</DialogDescription>
            )}
          </DialogHeader>
          {children}
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetTrigger asChild>{trigger}</SheetTrigger>
      {/* `dvh` y no `vh`: con la barra del navegador visible, `vh` mide de más
          y la hoja se sale por abajo. La clase la usa globals.css para subirla
          por encima del teclado. */}
      <SheetContent
        side="bottom"
        className="keyboard-aware-sheet safe-bottom max-h-[90dvh] overflow-y-auto"
      >
        <SheetHeader>
          <SheetTitle>{title}</SheetTitle>
          {description && <SheetDescription>{description}</SheetDescription>}
        </SheetHeader>
        <div className="keyboard-inset-scroll px-4">{children}</div>
      </SheetContent>
    </Sheet>
  );
}
