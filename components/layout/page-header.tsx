import type { ReactNode } from "react";

interface PageHeaderProps {
  title: string;
  description?: string;
  /** Acción principal de la pantalla (normalmente un botón). */
  action?: ReactNode;
}

/** Encabezado de pantalla. La jerarquía la da el borde inferior, no una sombra. */
export function PageHeader({ title, description, action }: PageHeaderProps) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border pb-4">
      <div className="min-w-0">
        <h1 className="text-lg font-semibold tracking-tight">{title}</h1>
        {description && (
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        )}
      </div>

      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
