"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import { NAV_ICONS } from "@/lib/constants/nav-icons";
import type { NavSection } from "@/lib/constants/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

interface MobileMenuProps {
  /** Secciones YA filtradas por permiso en el servidor. */
  sections: NavSection[];
}

/**
 * Menú completo para celular.
 *
 * La barra inferior sólo lleva 4 destinos —los del uso diario— y el sidebar
 * no existe debajo de `md:`. Sin esto, los catálogos, documentos y auditoría
 * quedaban inalcanzables desde el teléfono: había que buscar una computadora
 * para dar de alta un material.
 *
 * Se abre desde el header y se cierra al navegar, para no dejar la hoja
 * encima de la pantalla a la que acaba de llegar el usuario.
 */
export function MobileMenu({ sections }: MobileMenuProps) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="touch-target shrink-0"
          aria-label="Abrir menú"
        >
          <Menu className="size-5" aria-hidden />
        </Button>
      </SheetTrigger>

      {/* Entra por la izquierda, como el sidebar que sustituye. */}
      <SheetContent side="left" className="safe-top w-72 overflow-y-auto p-0">
        <SheetHeader className="border-b border-border">
          <SheetTitle>Menú</SheetTitle>
        </SheetHeader>

        <nav className="p-2" aria-label="Navegación completa">
          {sections.map((section) => (
            <div key={section.label} className="mb-4">
              <p className="px-3 py-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {section.label}
              </p>

              <div className="flex flex-col gap-0.5">
                {section.items.map((item) => {
                  const Icon = NAV_ICONS[item.icon];
                  const isActive = pathname === item.href;

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setOpen(false)}
                      aria-current={isActive ? "page" : undefined}
                      className={cn(
                        "touch-target flex items-center gap-3 rounded px-3 py-2 text-sm transition-colors",
                        isActive
                          ? "bg-primary font-medium text-primary-foreground"
                          : "active:bg-accent",
                      )}
                    >
                      <Icon className="size-4 shrink-0" aria-hidden />
                      <span className="truncate">{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
      </SheetContent>
    </Sheet>
  );
}
