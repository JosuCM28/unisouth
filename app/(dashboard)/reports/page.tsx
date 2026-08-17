import { Suspense } from "react";
import type { Metadata } from "next";
import { AlertTriangle, Printer } from "lucide-react";
import { requirePermission } from "@/lib/core/session";
import { ReportService } from "@/lib/services/report.service";
import { formatDate, formatQuantity } from "@/lib/utils";
import { PageHeader } from "@/components/layout/page-header";
import { ExportButton } from "@/components/shared/export-button";
import { BarChart } from "@/components/reports/bar-chart";
import { FlowChart } from "@/components/reports/flow-chart";
import { ProductionRanking } from "@/components/reports/production-ranking";
import { RangeTabs, RANGE_OPTIONS } from "@/components/reports/range-tabs";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata: Metadata = { title: "Reportes" };

interface PageProps {
  searchParams: Promise<{ dias?: string }>;
}

export default async function ReportsPage({ searchParams }: PageProps) {
  await requirePermission("inventory:read");

  const params = await searchParams;
  const days = parseRange(params.dias);

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Reportes"
        description="Cómo va la fábrica"
        action={
          <div className="flex flex-wrap gap-2">
            <ExportButton href={`/api/export/reports?dias=${days}`} label="Excel" />
            <Button asChild variant="outline" className="touch-target">
              <a href={`/print/reports?dias=${days}`} target="_blank" rel="noopener">
                <Printer className="size-4" aria-hidden />
                Imprimir
              </a>
            </Button>
          </div>
        }
      />

      <RangeTabs />

      <Suspense key={days} fallback={<ReportSkeleton />}>
        <ReportSections days={days} />
      </Suspense>
    </div>
  );
}

async function ReportSections({ days }: { days: number }) {
  const report = await new ReportService().getReport(days);

  return (
    <div className="flex flex-col gap-4">
      {/* Las cuatro cifras de arriba: lo que se mira primero al abrir. */}
      <section className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        <Kpi
          label="Salió a producción"
          value={formatQuantity(report.summary.totalConsumed)}
          hint="En el periodo"
        />
        <Kpi
          label="Entró al almacén"
          value={formatQuantity(report.summary.totalReceived)}
          hint="En el periodo"
        />
        <Kpi
          label="Producciones activas"
          value={String(report.summary.activeRuns)}
          hint="Ahora mismo"
        />
        <Kpi
          label="Rollos en bodega"
          value={String(report.summary.lotsInWarehouse)}
          hint="Ocupando lugar"
        />
      </section>

      <Block
        title="Producciones del periodo"
        subtitle="Cuánto material se llevó cada una"
      >
        <ProductionRanking rows={report.ranking} />
      </Block>

      <Block
        title="Consumo por cliente"
        subtitle="De quién era la tela que se usó"
      >
        <BarChart
          data={report.byClient.map((row) => ({
            label: row.clientName,
            value: row.quantity,
          }))}
          emptyLabel="Sin consumo registrado en el periodo."
        />
      </Block>

      <Block
        title="Movimiento del almacén"
        subtitle="Últimos 6 meses, entradas contra salidas"
      >
        <FlowChart data={report.flow} />
      </Block>

      <Block
        title="Focos de atención"
        subtitle="Material que cuesta dinero sin que se note"
      >
        <ul className="flex flex-col gap-2">
          {report.alerts.map((alert) => (
            <li
              key={alert.key}
              className="flex items-start justify-between gap-3 border-b border-border pb-2 last:border-0 last:pb-0"
            >
              <div className="min-w-0">
                <p className="flex items-center gap-1.5 text-sm font-medium">
                  {alert.count > 0 && (
                    <AlertTriangle
                      className="size-3.5 shrink-0 text-state-reserved"
                      aria-hidden
                    />
                  )}
                  {alert.label}
                </p>
                <p className="text-xs text-muted-foreground">{alert.detail}</p>
              </div>
              <span className="tabular shrink-0 text-xl font-semibold">
                {alert.count}
              </span>
            </li>
          ))}
        </ul>
      </Block>

      <p className="tabular text-xs text-muted-foreground">
        Del {formatDate(report.summary.from)} al {formatDate(report.summary.to)}
      </p>
    </div>
  );
}

function Kpi({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="flat-surface p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="tabular mt-1 text-2xl font-semibold leading-none">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}

function Block({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flat-surface p-4">
      <h2 className="text-sm font-semibold uppercase tracking-wide">{title}</h2>
      <p className="mb-3 text-xs text-muted-foreground">{subtitle}</p>
      {children}
    </section>
  );
}

/** El rango viene de la URL: cualquier valor fuera del catálogo se ignora. */
function parseRange(value: string | undefined): number {
  const parsed = Number(value);
  const allowed = RANGE_OPTIONS.some((option) => option.days === parsed);
  return allowed ? parsed : 30;
}

function ReportSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-20 w-full" />
        ))}
      </div>
      <Skeleton className="h-64 w-full" />
      <Skeleton className="h-48 w-full" />
    </div>
  );
}
