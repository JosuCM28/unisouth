import { visibleSections } from "@/lib/constants/navigation";
import { roleHasPermission } from "@/lib/constants/roles";
import type { CurrentUser } from "@/lib/core/session";
import { SidebarLink } from "./sidebar-link";
import { UserMenu } from "./user-menu";

interface AppSidebarProps {
  user: CurrentUser;
}

/**
 * Navegación de escritorio. SERVER Component.
 *
 * El filtrado por permisos ocurre aquí, en el servidor: los destinos que el
 * usuario no puede abrir ni siquiera se mandan al navegador. Ocultar con CSS
 * dejaría los enlaces en el HTML a la vista de cualquiera.
 *
 * Ojo: esconder el enlace es comodidad visual, no seguridad. La barrera real
 * es requirePermission() en el servidor.
 */
export function AppSidebar({ user }: AppSidebarProps) {
  const sections = visibleSections(user.role, roleHasPermission);

  return (
    // En celular no existe: ahí manda la barra inferior.
    <aside className="hidden w-60 shrink-0 flex-col border-r border-sidebar-border bg-sidebar md:flex">
      <div className="flex h-14 items-center border-b border-sidebar-border px-4">
        <span className="text-sm font-semibold tracking-tight">UNISOUTH</span>
      </div>

      <nav className="flex-1 overflow-y-auto p-2" aria-label="Navegación principal">
        {sections.map((section) => (
          <div key={section.label} className="mb-4">
            <p className="px-3 py-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {section.label}
            </p>
            <div className="flex flex-col gap-0.5">
              {section.items.map((item) => (
                <SidebarLink
                  key={item.href}
                  href={item.href}
                  label={item.label}
                  icon={item.icon}
                />
              ))}
            </div>
          </div>
        ))}
      </nav>

      <UserMenu user={user} />
    </aside>
  );
}
