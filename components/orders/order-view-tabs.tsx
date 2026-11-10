import Link from "next/link";
import { ORDER_VIEW_LABELS } from "@/lib/constants/labels";
import { ORDER_VIEW_PARAMS, type OrderView } from "@/lib/constants/order-view";
import { cn } from "@/lib/utils";

const VIEWS: OrderView[] = ["orders", "folders"];

interface Props {
  view: OrderView;
  /** Los filtros actuales: cambiar de pestaña no debe tirarlos. */
  params: Record<string, string | undefined>;
}

/**
 * Órdenes sueltas o pedidos.
 *
 * En pestañas y no apiladas: con los pedidos arriba, las órdenes —lo que se
 * abre a diario— quedaban debajo de media pantalla de carpetas.
 */
export function OrderViewTabs({ view, params }: Props) {
  return (
    <nav className="flex border-b border-border" aria-label="Vista">
      {VIEWS.map((item) => (
        <Link
          key={item}
          href={hrefFor(item, params)}
          scroll={false}
          aria-current={item === view ? "page" : undefined}
          className={cn(
            "touch-target flex flex-1 items-center justify-center border-b-2 px-4 text-sm transition-colors sm:flex-none",
            item === view
              ? "border-primary font-medium text-foreground"
              : "border-transparent text-muted-foreground",
          )}
        >
          {ORDER_VIEW_LABELS[item]}
        </Link>
      ))}
    </nav>
  );
}

/**
 * Conserva los filtros y vuelve a la página 1: la página 4 de las órdenes no
 * significa nada en la lista de pedidos.
 */
function hrefFor(
  view: OrderView,
  params: Record<string, string | undefined>,
): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value && key !== "page" && key !== "all" && key !== "vista") {
      query.set(key, value);
    }
  }
  // La vista por omisión no se escribe: la URL limpia abre las órdenes.
  if (view !== "orders") query.set("vista", ORDER_VIEW_PARAMS[view]);

  const search = query.toString();
  return search ? `/orders?${search}` : "/orders";
}
