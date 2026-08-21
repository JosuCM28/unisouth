"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_ICONS } from "@/lib/constants/nav-icons";
import { MOBILE_BAR_ITEMS } from "@/lib/constants/navigation";
import { roleHasPermission } from "@/lib/constants/roles";
import { cn } from "@/lib/utils";

/**
 * Barra inferior fija: la navegación principal del piso de bodega.
 *
 * Va abajo porque se usa con el pulgar de una sola mano, y son como mucho
 * 4 destinos porque con más el dedo ya no atina.
 *
 * Se filtra por rol igual que el sidebar: Dirección no puede entrar al
 * tablero ni al inventario, y una barra con dos botones que sólo llevan a un
 * error de permiso es peor que una barra corta.
 */
export function MobileNav({ role }: { role: string }) {
  const pathname = usePathname();

  const items = MOBILE_BAR_ITEMS.filter((item) =>
    roleHasPermission(role, item.permission),
  );

  // Sin destinos permitidos no se pinta la barra: dejaría una franja vacía
  // ocupando el pulgar para nada.
  if (items.length === 0) return null;

  return (
    <nav
      // Con el teclado abierto quedan ~250px útiles y esta barra se lleva 64.
      // El CSS la esconde mientras dure la captura; ver globals.css.
      data-mobile-nav
      style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}
      className="safe-bottom fixed inset-x-0 bottom-0 z-40 grid border-t border-border bg-card md:hidden"
      aria-label="Navegación principal"
    >
      {items.map((item) => {
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
