import { Fragment } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";

interface Crumb {
  label: string;
  href?: string;
}

/**
 * Dónde estoy dentro de un pedido: Pedidos › EMB-2026-0008 › Caja 2.
 *
 * Reemplaza al botón "← Pedido" de cada pantalla: con él se regresaba un
 * nivel y para ir a la lista había que picarle dos veces. Aquí cada nivel
 * es un toque. El último es la pantalla actual y no es enlace.
 */
export function PackingBreadcrumb({ items }: { items: Crumb[] }) {
  return (
    <nav aria-label="Ruta" className="-mb-2">
      <ol className="flex flex-wrap items-center gap-1 text-sm text-muted-foreground">
        {items.map((item, index) => (
          <Fragment key={`${item.label}-${index}`}>
            {index > 0 && <ChevronRight className="size-3.5 shrink-0" aria-hidden />}
            <li className="min-w-0">
              <CrumbLabel item={item} />
            </li>
          </Fragment>
        ))}
      </ol>
    </nav>
  );
}

function CrumbLabel({ item }: { item: Crumb }) {
  if (!item.href) {
    return <span aria-current="page" className="tabular truncate font-medium text-foreground">{item.label}</span>;
  }
  return (
    <Link href={item.href}
      className="tabular touch-target inline-flex items-center truncate transition-colors hover:text-foreground">
      {item.label}
    </Link>
  );
}
