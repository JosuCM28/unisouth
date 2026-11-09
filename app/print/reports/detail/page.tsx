import type { Metadata } from "next";
import { requirePermission } from "@/lib/core/session";
import { parseCutDetailGroup, resolveReportPeriod } from "@/lib/report-period";
import { CutDetailService } from "@/lib/services/cut-detail.service";
import { CutDetailPrint } from "@/components/reports/cut-detail-print";
import { PrintButton } from "@/components/shared/print-button";

export const metadata: Metadata = { title: "Detalle de corte" };

interface PageProps {
  searchParams: Promise<{
    mes?: string;
    desde?: string;
    hasta?: string;
    agrupar?: string;
  }>;
}

export default async function PrintCutDetailPage({ searchParams }: PageProps) {
  await requirePermission("reporting:read");

  const params = await searchParams;
  const report = await new CutDetailService().getReport(
    resolveReportPeriod(params),
    parseCutDetailGroup(params.agrupar),
  );

  return (
    <main className="mx-auto w-full max-w-3xl">
      <div className="p-4 print:hidden">
        <PrintButton />
      </div>
      <CutDetailPrint report={report} />
    </main>
  );
}
