import Link from "next/link";
import { CUT_DETAIL_GROUP_LABELS } from "@/lib/constants/labels";
import {
  CUT_DETAIL_GROUP_PARAMS,
  type CutDetailGroup,
  type ReportPeriod,
} from "@/lib/report-period";
import { cn } from "@/lib/utils";
import { DETAIL_VIEW_PARAM } from "./report-tabs";

const GROUPS: CutDetailGroup[] = ["day", "week", "month"];

/** Son enlaces para que la agrupación viaje en la URL junto con el periodo. */
export function GroupPicker({
  active,
  period,
}: {
  active: CutDetailGroup;
  period: ReportPeriod;
}) {
  return (
    <div className="flex gap-2" role="group" aria-label="Agrupar el detalle">
      {GROUPS.map((group) => (
        <Link
          key={group}
          href={`/reports?vista=${DETAIL_VIEW_PARAM}&agrupar=${CUT_DETAIL_GROUP_PARAMS[group]}&${period.query}`}
          scroll={false}
          aria-current={group === active ? "true" : undefined}
          className={cn(
            "touch-target flex flex-1 items-center justify-center rounded border px-3 text-sm transition-colors sm:flex-none",
            group === active
              ? "border-primary bg-primary font-medium text-primary-foreground"
              : "border-border bg-card text-muted-foreground",
          )}
        >
          {CUT_DETAIL_GROUP_LABELS[group]}
        </Link>
      ))}
    </div>
  );
}
