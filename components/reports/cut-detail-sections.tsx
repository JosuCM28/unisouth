import { ChevronRight } from "lucide-react";
import {
  formatDayKey,
  type CutDetailGroup,
  type ReportPeriod,
} from "@/lib/report-period";
import type {
  CutDetailBucket,
  CutDetailData,
  CutDetailItem,
  CutDetailTotals,
} from "@/lib/reports/cut-detail-calculations";
import { formatDifference, formatRate } from "@/lib/reports/cut-report-format";
import { CutDetailService } from "@/lib/services/cut-detail.service";
import { cn, formatQuantity } from "@/lib/utils";
import { Kpi } from "./report-block";

const PER_BUCKET_LABELS: Record<CutDetailGroup, string> = {
  day: "Piezas por día con corte",
  week: "Piezas por semana con corte",
  month: "Piezas por mes con corte",
};

const BEST_LABELS: Record<CutDetailGroup, string> = {
  day: "Mejor día",
  week: "Mejor semana",
  month: "Mejor mes",
};

const COLUMN_LABELS: Record<CutDetailGroup, string> = {
  day: "Día",
  week: "Semana",
  month: "Mes",
};

const DESKTOP_COLUMNS =
  "md:grid-cols-[minmax(0,2.4fr)_repeat(5,minmax(0,1fr))]";

export async function CutDetailSections({
  period,
  group,
}: {
  period: ReportPeriod;
  group: CutDetailGroup;
}) {
  const report = await new CutDetailService().getReport(period, group);
  return <CutDetailView report={report} />;
}

/** Sin consultas: recibe el detalle ya calculado. */
export function CutDetailView({ report }: { report: CutDetailData }) {
  const { period, group, buckets, totals } = report;

  return (
    <div className="flex flex-col gap-4">
      <p className="tabular text-xs">
        <span className="font-medium capitalize">{period.label}</span>
      </p>

      <DetailKpis totals={totals} group={group} />

      {totals.cuts === 0 ? (
        <p className="flat-surface p-4 text-sm text-muted-foreground">
          No se capturó corte en este periodo.
        </p>
      ) : (
        <section className="flat-surface">
          <DesktopHeader group={group} />
          {buckets.map((bucket) => (
            <BucketRow key={bucket.key} bucket={bucket} />
          ))}
          <TotalRow totals={totals} />
        </section>
      )}

      {buckets.some((bucket) => bucket.partial) && (
        <p className="text-xs text-muted-foreground">
          * Incompleto en este periodo: no se compara contra los demás.
        </p>
      )}
      <p className="text-xs text-muted-foreground">
        Cuenta el día en que se capturó cada corte. La diferencia es contra el
        anterior con corte.
      </p>
    </div>
  );
}

function DetailKpis({
  totals,
  group,
}: {
  totals: CutDetailTotals;
  group: CutDetailGroup;
}) {
  return (
    <section className="grid grid-cols-2 gap-2 lg:grid-cols-4">
      <Kpi
        label="Piezas cortadas"
        value={formatQuantity(totals.pieces)}
        hint={`${formatQuantity(totals.bundles)} bultos`}
      />
      <Kpi
        label="Órdenes"
        value={String(totals.orders)}
        hint={`${totals.cuts} cortes capturados`}
      />
      <Kpi
        label={PER_BUCKET_LABELS[group]}
        value={formatQuantity(totals.piecesPerBucket, { decimals: 0 })}
        hint={`${totals.bucketsWithCut} con corte`}
      />
      <Kpi
        label={BEST_LABELS[group]}
        value={totals.best ? formatQuantity(totals.best.pieces) : "—"}
        hint={totals.best?.label ?? "Sin corte en el periodo"}
      />
    </section>
  );
}

function DesktopHeader({ group }: { group: CutDetailGroup }) {
  return (
    <div
      className={cn(
        "hidden gap-2 border-b border-border p-3 text-xs font-medium md:grid",
        DESKTOP_COLUMNS,
      )}
    >
      <span>{COLUMN_LABELS[group]}</span>
      <span className="text-right">Piezas</span>
      <span className="text-right">Bultos</span>
      <span className="text-right">Órdenes</span>
      <span className="text-right">% total</span>
      <span className="text-right">Diferencia</span>
    </div>
  );
}

function bucketLabel(bucket: CutDetailBucket): string {
  return bucket.partial ? `${bucket.label} *` : bucket.label;
}

function differenceTone(value: number | null): string {
  if (value === null || value === 0) return "text-muted-foreground";
  return value > 0 ? "text-state-available" : "text-state-defective";
}

function BucketRow({ bucket }: { bucket: CutDetailBucket }) {
  if (bucket.cuts === 0) {
    return (
      <div className="flex items-center justify-between gap-3 border-b border-border p-3 text-sm text-muted-foreground">
        <span className="tabular min-w-0">{bucketLabel(bucket)}</span>
        <span>Sin corte</span>
      </div>
    );
  }

  /* `details` nativo y no un componente con estado: abrir un renglón no pide
     JavaScript, y la página sigue siendo Server Component. */
  return (
    <details className="group border-b border-border">
      <summary className="touch-target flex cursor-pointer list-none items-start gap-2 p-3 [&::-webkit-details-marker]:hidden">
        <ChevronRight
          className="mt-0.5 size-4 shrink-0 text-muted-foreground group-open:rotate-90"
          aria-hidden
        />
        <div className="min-w-0 flex-1">
          <MobileSummary bucket={bucket} />
          <DesktopSummary bucket={bucket} />
        </div>
      </summary>

      <ul className="flex flex-col gap-2 border-t border-border bg-muted p-3">
        {bucket.items.map((item) => (
          <ItemCard key={item.id} item={item} />
        ))}
      </ul>
    </details>
  );
}

function MobileSummary({ bucket }: { bucket: CutDetailBucket }) {
  return (
    <div className="md:hidden">
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span className="tabular min-w-0 font-medium">{bucketLabel(bucket)}</span>
        <span className="tabular shrink-0 font-semibold">
          {formatQuantity(bucket.pieces)}
        </span>
      </div>
      <div className="tabular mt-0.5 flex items-baseline justify-between gap-3 text-xs text-muted-foreground">
        <span>
          {formatQuantity(bucket.bundles)} bultos · {bucket.orders} órd. ·{" "}
          {formatRate(bucket.share)}
        </span>
        <span className={cn("shrink-0", differenceTone(bucket.difference))}>
          {formatDifference(bucket.difference)}
        </span>
      </div>
    </div>
  );
}

function DesktopSummary({ bucket }: { bucket: CutDetailBucket }) {
  return (
    <div className={cn("hidden gap-2 text-sm md:grid", DESKTOP_COLUMNS)}>
      <span className="tabular min-w-0 font-medium">{bucketLabel(bucket)}</span>
      <span className="tabular text-right font-semibold">
        {formatQuantity(bucket.pieces)}
      </span>
      <span className="tabular text-right">{formatQuantity(bucket.bundles)}</span>
      <span className="tabular text-right">{bucket.orders}</span>
      <span className="tabular text-right">{formatRate(bucket.share)}</span>
      <span className={cn("tabular text-right", differenceTone(bucket.difference))}>
        {formatDifference(bucket.difference)}
      </span>
    </div>
  );
}

function ItemCard({ item }: { item: CutDetailItem }) {
  return (
    <li className="flat-surface p-3">
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span className="tabular min-w-0 break-words font-medium">
          {item.orderCode} · {item.clientName}
        </span>
        <span className="tabular shrink-0 font-semibold">
          {formatQuantity(item.pieces)}
        </span>
      </div>
      <p className="break-words text-sm">{item.description}</p>
      <ul className="tabular mt-1.5 flex flex-wrap gap-1 text-xs">
        {item.sizes.map((size) => (
          <li key={size.code} className="border border-border px-1.5 py-0.5">
            <span className="text-muted-foreground">{size.code}</span>{" "}
            <span className="font-medium">{formatQuantity(size.pieces)}</span>
          </li>
        ))}
      </ul>
      <p className="tabular mt-1.5 text-xs text-muted-foreground">
        {formatDayKey(item.dayKey)} · {item.cutName} ·{" "}
        {formatQuantity(item.bundles)} bultos · capturó {item.capturedBy}
      </p>
    </li>
  );
}

function TotalRow({ totals }: { totals: CutDetailTotals }) {
  return (
    <div className="tabular flex items-baseline justify-between gap-3 p-3 text-sm font-semibold">
      <span>Total</span>
      <span>
        {formatQuantity(totals.pieces)} piezas ·{" "}
        {formatQuantity(totals.bundles)} bultos
      </span>
    </div>
  );
}
