import { Suspense } from "react";
import { FileText } from "lucide-react";
import {
  CUT_DETAIL_GROUP_PARAMS,
  listReportMonths,
  type CutDetailGroup,
  type ReportPeriod,
} from "@/lib/report-period";
import { todayInputValue } from "@/lib/utils";
import { PageHeader } from "@/components/layout/page-header";
import { ExportButton } from "@/components/shared/export-button";
import { Button } from "@/components/ui/button";
import { CutDetailSections } from "./cut-detail-sections";
import { CutReportSections } from "./cut-report-sections";
import { GroupPicker } from "./group-picker";
import { PeriodPicker } from "./period-picker";
import { RangeTabs } from "./range-tabs";
import { ReportSkeleton } from "./report-block";
import { DETAIL_VIEW_PARAM, ReportTabs } from "./report-tabs";
import { WarehouseReportSections } from "./warehouse-report-sections";

export function CutReportScreen({ period }: { period: ReportPeriod }) {
  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Reportes"
        description="Cómo va la fábrica"
        action={
          <ExportActions
            excelHref={`/api/export/cut-summary?${period.query}`}
            pdfHref={`/print/reports/cuts?${period.query}`}
          />
        }
      />
      <ReportTabs active="cuts" />
      <PeriodPicker
        key={period.query}
        period={period}
        months={listReportMonths()}
        maxDate={todayInputValue()}
      />
      <Suspense key={period.query} fallback={<ReportSkeleton />}>
        <CutReportSections period={period} />
      </Suspense>
    </div>
  );
}

export function CutDetailScreen({
  period,
  group,
}: {
  period: ReportPeriod;
  group: CutDetailGroup;
}) {
  const groupParam = `agrupar=${CUT_DETAIL_GROUP_PARAMS[group]}`;

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Reportes"
        description="Lo que se cortó, por día, semana o mes"
        action={
          <ExportActions
            excelHref={`/api/export/cut-detail?${groupParam}&${period.query}`}
            pdfHref={`/print/reports/detail?${groupParam}&${period.query}`}
          />
        }
      />
      <ReportTabs active="detail" />
      <GroupPicker active={group} period={period} />
      <PeriodPicker
        key={period.query}
        period={period}
        months={listReportMonths()}
        maxDate={todayInputValue()}
        baseQuery={`vista=${DETAIL_VIEW_PARAM}&${groupParam}`}
      />
      <Suspense key={`${group}-${period.query}`} fallback={<ReportSkeleton />}>
        <CutDetailSections period={period} group={group} />
      </Suspense>
    </div>
  );
}

export function WarehouseReportScreen({ days }: { days: number }) {
  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Reportes"
        description="Cómo va la fábrica"
        action={
          <ExportActions
            excelHref={`/api/export/reports?dias=${days}`}
            pdfHref={`/print/reports?dias=${days}`}
          />
        }
      />
      <ReportTabs active="warehouse" />
      <RangeTabs />
      <Suspense key={days} fallback={<ReportSkeleton />}>
        <WarehouseReportSections days={days} />
      </Suspense>
    </div>
  );
}

function ExportActions({
  excelHref,
  pdfHref,
}: {
  excelHref: string;
  pdfHref: string;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      <ExportButton href={excelHref} label="Excel" exact />
      {/* Se llama PDF y no "Imprimir" porque es lo que la gente busca cuando
          quiere mandar el reporte: el diálogo del navegador ofrece "Guardar
          como PDF" y de ahí sale el archivo. */}
      <Button asChild variant="outline" className="touch-target">
        <a href={pdfHref} target="_blank" rel="noopener">
          <FileText className="size-4" aria-hidden />
          PDF
        </a>
      </Button>
    </div>
  );
}
