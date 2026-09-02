import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requirePermission } from "@/lib/core/session";
import { ReceiptRepository } from "@/lib/repositories/receipt.repository";
import { ReceiptReportService } from "@/lib/services/receipt-report.service";
import {
  parsePeriodGroup,
  parseReportRange,
} from "@/lib/constants/receipt-report";
import { PageHeader } from "@/components/layout/page-header";
import { SearchInput } from "@/components/shared/search-input";
import { ExportButton } from "@/components/shared/export-button";
import { ReceiptFilters } from "@/components/receipts/receipt-filters";
import { ReceiptReportRange } from "@/components/receipts/receipt-report-range";
import { ReceiptReportView } from "@/components/receipts/receipt-report-view";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata: Metadata = { title: "Reporte de recepciones" };

interface PageProps {
  searchParams: Promise<{
    q?: string;
    clientId?: string;
    materialId?: string;
    supplierId?: string;
    carrierId?: string;
    desde?: string;
    hasta?: string;
    agrupar?: string;
  }>;
}

export default async function ReceiptReportPage({ searchParams }: PageProps) {
  // La misma puerta que la lista: el reporte enseña lo mismo, agregado.
  await requirePermission("inventory:browse");

  const params = await searchParams;
  const options = await new ReceiptRepository().findFilterOptions();
  const range = parseReportRange(params.desde, params.hasta);

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Reporte de recepciones"
        description="Cuánta tela llegó, en qué periodo y de quién"
        action={
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline" className="touch-target">
              <Link href="/receipts">
                <ArrowLeft className="size-4" aria-hidden />
                Recepciones
              </Link>
            </Button>
            {/* Sin `exact`: arrastra el rango y los filtros de la pantalla,
                para que el archivo sea justo lo que se está viendo. */}
            <ExportButton href="/api/export/receipts/report" label="Excel" />
          </div>
        }
      />

      <ReceiptReportRange
        fromInput={range.fromInput}
        toInput={range.toInput}
        group={parsePeriodGroup(params.agrupar)}
      />

      <SearchInput
        placeholder="Guía, folio, factura, tela, proveedor…"
        className="md:max-w-sm"
      />

      <ReceiptFilters
        showRanges={false}
        clients={options.clients.map((c) => ({ id: c.id, label: c.name }))}
        suppliers={options.suppliers.map((s) => ({ id: s.id, label: s.name }))}
        carriers={options.carriers.map((c) => ({ id: c.id, label: c.name }))}
        materials={options.materials.map((m) => ({
          id: m.id,
          label: m.name,
          hint: m.code,
        }))}
      />

      <Suspense key={JSON.stringify(params)} fallback={<ReportSkeleton />}>
        <ReportSection params={params} />
      </Suspense>
    </div>
  );
}

async function ReportSection({
  params,
}: {
  params: Awaited<PageProps["searchParams"]>;
}) {
  const range = parseReportRange(params.desde, params.hasta);

  const report = await new ReceiptReportService().getReport({
    from: range.from,
    to: range.to,
    group: parsePeriodGroup(params.agrupar),
    search: params.q,
    materialId: params.materialId,
    clientId: params.clientId,
    supplierId: params.supplierId,
    carrierId: params.carrierId,
  });

  return <ReceiptReportView report={report} />;
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
