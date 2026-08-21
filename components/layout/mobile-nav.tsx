"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_ICONS } from "@/lib/constants/nav-icons";
import { MOBILE_BAR_ITEMS } from "@/lib/constants/navigation";
import { cn } from "@/lib/utils";

/**
 * Barra inferior fija: la navegación principal del piso de bodega.
 *
 * Va abajo porque se usa con el pulgar de una sola mano, y son exactamente
 * 4 destinos porque con más el dedo ya no atina.
 */
export function MobileNav() {
  const pathname = usePathname();

  return (
    <nav
      // Con el teclado abierto quedan ~250px útiles y esta barra se lleva 64.
      // El CSS la esconde mientras dure la captura; ver globals.css.
      data-mobile-nav
      className="safe-bottom fixed inset-x-0 bottom-0 z-40 grid grid-cols-4 border-t border-border bg-card md:hidden"
      aria-label="Navegación principal"
    >
      {MOBILE_BAR_ITEMS.map((item) => {
        const Icon = NAV_ICONS[item.icon];
        const isActive = isRouteActive(pathname, item.href);

        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "touch-target flex flex-col items-center justify-center gap-1 py-2 text-xs transition-colors",
              isActive
                ? "font-medium text-primary"
                : "text-muted-foreground",
            )}
          >
            <Icon className="size-5 shrink-0" aria-hidden />
            <span className="truncate px-1">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

/**
 * /lots/scan es su propio destino de la barra: no debe encender también
 * "Inventario" al mismo tiempo.
 */
function isRouteActive(pathname: string, href: string): boolean {
  if (pathname === href) return true;
  if (!pathname.startsWith(`${href}/`)) return false;

  return !MOBILE_BAR_ITEMS.some(
    (item) => item.href !== href && pathname.startsWith(item.href),
  );
}
