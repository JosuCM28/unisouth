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

      {/* `max-w-full` además de `shrink-0`: sin el tope, un encabezado con
          varias acciones se mide a su ancho natural —`shrink-0` se lo permite—
          y el `flex-wrap` de dentro nunca llega a envolver. La ficha de una
          orden, que lleva ocho botones, sacaba la página 496px de ancho en un
          celular de 375 y todo se barría de lado. */}
      {action && <div className="max-w-full shrink-0">{action}</div>}
    </div>
  );
}
