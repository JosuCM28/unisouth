import { ROLE_LABELS } from "@/lib/constants/roles";
import type { CurrentUser } from "@/lib/core/session";
import { SignOutButton } from "./sign-out-button";

interface UserMenuProps {
  user: CurrentUser;
}

/**
 * Identidad del usuario al pie del sidebar. Server Component: sólo el botón
 * de salir necesita JavaScript.
 */
export function UserMenu({ user }: UserMenuProps) {
  return (
    <div className="flex items-center gap-3 border-t border-sidebar-border p-3">
      <div
        className="flex size-9 shrink-0 items-center justify-center rounded bg-secondary text-xs font-semibold"
        aria-hidden
      >
        {getInitials(user.name)}
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{user.name}</p>
        <p className="truncate text-xs text-muted-foreground">
          {ROLE_LABELS[user.role]}
        </p>
      </div>

      <SignOutButton />
    </div>
  );
}

/** Dos letras: con una sola no se distingue a dos personas del mismo turno. */
function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";

  const first = parts[0]?.[0] ?? "";
  const second = parts.length > 1 ? (parts[1]?.[0] ?? "") : (parts[0]?.[1] ?? "");

  return `${first}${second}`.toUpperCase();
}
