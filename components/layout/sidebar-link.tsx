"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_ICONS, type NavIconName } from "@/lib/constants/nav-icons";
import { cn } from "@/lib/utils";

interface SidebarLinkProps {
  href: string;
  label: string;
  icon: NavIconName;
}

/**
 * ÚNICA parte cliente del sidebar.
 *
 * Se aísla aquí para que la lista completa —con su filtrado por permisos—
 * siga siendo Server Component. Lo único que necesita el navegador es saber
 * qué ruta está abierta, y eso sólo lo sabe usePathname.
 */
export function SidebarLink({ href, label, icon }: SidebarLinkProps) {
  const pathname = usePathname();
  const Icon = NAV_ICONS[icon];

  // Coincidencia por prefijo para que /lots/R-2026-1 siga marcando "Inventario",
  // pero /lots no se quede activo estando en /lots/scan.
  const isActive =
    pathname === href ||
    (pathname.startsWith(`${href}/`) && !hasSiblingMatch(pathname, href));

  return (
    <Link
      href={href}
      aria-current={isActive ? "page" : undefined}
      className={cn(
        "touch-target flex items-center gap-3 rounded px-3 py-2 text-sm transition-colors",
        "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
        // El ámbar sólo marca el destino activo. Es el único acento del sistema.
        isActive &&
          "bg-sidebar-primary font-medium text-sidebar-primary-foreground hover:bg-sidebar-primary hover:text-sidebar-primary-foreground",
      )}
    >
      <Icon className="size-4 shrink-0" aria-hidden />
      <span className="truncate">{label}</span>
    </Link>
  );
}

/** /lots/scan es su propio destino, así que no debe activar también /lots. */
function hasSiblingMatch(pathname: string, href: string): boolean {
  return pathname === `${href}/scan`;
}
