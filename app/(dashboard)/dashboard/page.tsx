import { Suspense } from "react";
import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { KpiGrid } from "@/components/dashboard/kpi-grid";
import { KpiGridSkeleton } from "@/components/dashboard/kpi-grid-skeleton";
import { RecentMovements } from "@/components/dashboard/recent-movements";
import { StockByClient } from "@/components/dashboard/stock-by-client";
import { Skeleton } from "@/components/ui/skeleton";
import { DashboardService } from "@/lib/services/dashboard.service";

export const metadata: Metadata = {
  title: "Tablero",
};

export default function DashboardPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Tablero"
        description="Estado del almacén de un vistazo"
      />

      {/* Cada bloque con su propio Suspense: los KPIs son 8 consultas cortas
          y pintan de inmediato, sin esperar a las listas de abajo. */}
      <Suspense fallback={<KpiGridSkeleton />}>
        <KpiSection />
      </Suspense>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="flat-surface p-4">
          <h2 className="mb-3 text-sm font-semibold">Existencias por cliente</h2>
          <Suspense fallback={<ListSkeleton rows={4} />}>
            <StockSection />
          </Suspense>
        </section>

        <section className="flat-surface p-4">
          <h2 className="mb-3 text-sm font-semibold">Últimos movimientos</h2>
          <Suspense fallback={<ListSkeleton rows={5} />}>
            <MovementsSection />
          </Suspense>
        </section>
      </div>
    </div>
  );
}

async function KpiSection() {
  const kpis = await new DashboardService().getKpis();
  return <KpiGrid kpis={kpis} />;
}

async function StockSection() {
  const data = await new DashboardService().getStockByClient();
  return <StockByClient data={data} />;
}

async function MovementsSection() {
  const movements = await new DashboardService().getRecentMovements(8);
  return <RecentMovements movements={movements} />;
}

function ListSkeleton({ rows }: { rows: number }) {
  return (
    <div className="flex flex-col gap-3">
      {Array.from({ length: rows }).map((_, index) => (
        <Skeleton key={index} className="h-10 w-full" />
      ))}
    </div>
  );
}
