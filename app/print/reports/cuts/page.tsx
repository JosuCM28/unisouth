import type { Metadata } from "next";
import { requirePermission } from "@/lib/core/session";
import { resolveReportPeriod } from "@/lib/report-period";
import { CutReportService } from "@/lib/services/cut-report.service";
import { CutReportPrint } from "@/components/reports/cut-report-print";
import { PrintButton } from "@/components/shared/print-button";

export const metadata: Metadata = { title: "Reporte de corte" };

interface PageProps {
  searchParams: Promise<{ mes?: string; desde?: string; hasta?: string }>;
}

export default async function PrintCutReportPage({ searchParams }: PageProps) {
  await requirePermission("reporting:read");

  const period = resolveReportPeriod(await searchParams);
  const report = await new CutReportService().getReport(period);

  return (
    <main className="mx-auto w-full max-w-3xl">
      <div className="p-4 print:hidden">
        <PrintButton />
      </div>
      <CutReportPrint report={report} />
    </main>
  );
}
