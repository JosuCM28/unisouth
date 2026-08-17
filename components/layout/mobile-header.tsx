import { visibleSections } from "@/lib/constants/navigation";
import { ROLE_LABELS, roleHasPermission } from "@/lib/constants/roles";
import type { CurrentUser } from "@/lib/core/session";
import { MobileMenu } from "./mobile-menu";
import { SignOutButton } from "./sign-out-button";

interface MobileHeaderProps {
  user: CurrentUser;
}

/**
 * Encabezado sólo de celular. Sticky para que el menú y el botón de salir
 * sigan a mano al recorrer una lista larga de rollos.
 *
 * El menú de la izquierda es la ÚNICA vía a los catálogos y documentos desde
 * el teléfono: la barra inferior sólo lleva los 4 destinos del uso diario.
 */
export function MobileHeader({ user }: MobileHeaderProps) {
  // Se filtra en el servidor: los destinos sin permiso ni se mandan.
  const sections = visibleSections(user.role, roleHasPermission);

  return (
    <header className="safe-top sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-border bg-card px-2 md:hidden">
      <MobileMenu sections={sections} />

      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold tracking-tight">UNISOUTH</p>
        <p className="truncate text-xs text-muted-foreground">
          {user.name} · {ROLE_LABELS[user.role]}
        </p>
      </div>

      <SignOutButton />
    </header>
  );
}
