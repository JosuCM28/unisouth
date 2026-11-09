import type { Metadata } from "next";
import { requirePermission } from "@/lib/core/session";
import { parseRangeDays } from "@/lib/constants/report-ranges";
import { parseCutDetailGroup, resolveReportPeriod } from "@/lib/report-period";
import {
  DETAIL_VIEW_PARAM,
  WAREHOUSE_VIEW_PARAM,
} from "@/components/reports/report-tabs";
import {
  CutDetailScreen,
  CutReportScreen,
  WarehouseReportScreen,
} from "@/components/reports/report-views";

export const metadata: Metadata = { title: "Reportes" };

interface PageProps {
  searchParams: Promise<{
    vista?: string;
    dias?: string;
    mes?: string;
    desde?: string;
    hasta?: string;
    agrupar?: string;
  }>;
}

export default async function ReportsPage({ searchParams }: PageProps) {
  await requirePermission("reporting:read");

  const params = await searchParams;

  if (params.vista === WAREHOUSE_VIEW_PARAM) {
    return <WarehouseReportScreen days={parseRangeDays(params.dias)} />;
  }

  const period = resolveReportPeriod(params);

  if (params.vista === DETAIL_VIEW_PARAM) {
    return (
      <CutDetailScreen
        period={period}
        group={parseCutDetailGroup(params.agrupar)}
      />
    );
  }

  return <CutReportScreen period={period} />;
}
