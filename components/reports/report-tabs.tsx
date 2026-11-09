import Link from "next/link";
import { cn } from "@/lib/utils";

export type ReportView = "cuts" | "detail" | "warehouse";

/** Los valores de la URL. Corte es la vista sin parámetro. */
export const WAREHOUSE_VIEW_PARAM = "almacen";
export const DETAIL_VIEW_PARAM = "detalle";

const TABS: Array<{ view: ReportView; label: string; href: string }> = [
  { view: "cuts", label: "Corte", href: "/reports" },
  {
    view: "detail",
    label: "Detalle",
    href: `/reports?vista=${DETAIL_VIEW_PARAM}`,
  },
  {
    view: "warehouse",
    label: "Almacén",
    href: `/reports?vista=${WAREHOUSE_VIEW_PARAM}`,
  },
];

/** Son enlaces y no estado: la pestaña se comparte junto con la URL. */
export function ReportTabs({ active }: { active: ReportView }) {
  return (
    <nav className="flex border-b border-border" aria-label="Tipo de reporte">
      {TABS.map((tab) => (
        <Link
          key={tab.view}
          href={tab.href}
          aria-current={tab.view === active ? "page" : undefined}
          className={cn(
            "touch-target flex flex-1 items-center justify-center border-b-2 px-4 text-sm transition-colors sm:flex-none",
            tab.view === active
              ? "border-primary font-medium text-foreground"
              : "border-transparent text-muted-foreground",
          )}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
