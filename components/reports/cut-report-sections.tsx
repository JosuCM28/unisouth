import { REMNANT_LEVEL_LABELS } from "@/lib/constants/labels";
import type { RemnantLevel } from "@/lib/export/cut-report";
import { formatDayKey, type ReportPeriod } from "@/lib/report-period";
import type {
  CutPending,
  CutReportData,
  CutSummary,
  CutYield,
} from "@/lib/reports/cut-report-calculations";
import { changeHint, formatRate } from "@/lib/reports/cut-report-format";
import { CutReportService } from "@/lib/services/cut-report.service";
import { cn, formatQuantity } from "@/lib/utils";
import { BarChart } from "./bar-chart";
import { ClientCutTable } from "./client-cut-table";
import { DailyCutChart } from "./daily-cut-chart";
import { MonthlyCutChart } from "./monthly-cut-chart";
import { Block, Kpi } from "./report-block";

export async function CutReportSections({ period }: { period: ReportPeriod }) {
  const report = await new CutReportService().getReport(period);
  return <CutReportView report={report} />;
}

/** La pestaña Corte. Sin consultas: recibe el reporte ya calculado. */
export function CutReportView({ report }: { report: CutReportData }) {
  const { period, summary, yieldData } = report;

  return (
    <div className="flex flex-col gap-4">
      <p className="tabular text-xs text-muted-foreground">
        <span className="font-medium capitalize text-foreground">
          {period.label}
        </span>{" "}
        · comparado contra {period.previousLabel}
      </p>

      <CutKpis summary={summary} yieldData={yieldData} />

      <Block
        title="Últimos 14 días"
        subtitle="Cuánto corte se reportó cada día y cómo cambió"
      >
        <DailyCutChart data={report.daily} />
      </Block>

      <Block title="Por empresa" subtitle="De quién fue lo que se cortó">
        <ClientCutTable rows={report.clients} />
      </Block>

      <Block title="Por mes" subtitle="Los últimos 6 meses">
        <MonthlyCutChart rows={report.monthly} />
      </Block>

      <Block title="Rendimiento de tela" subtitle="Qué tan bien se aprovechó">
        <YieldBlock data={yieldData} />
      </Block>

      <div className="grid gap-4 lg:grid-cols-2">
        <Block title="Órdenes con más corte" subtitle="Piezas en el periodo">
          <BarChart
            data={report.topOrders.map((row) => ({
              label: row.code,
              sublabel: `${row.clientName} · ${row.description}`,
              value: row.pieces,
            }))}
            emptyLabel="Sin órdenes con corte en el periodo."
          />
        </Block>

        <Block title="Prendas con más corte" subtitle="Piezas en el periodo">
          <BarChart
            data={report.topGarments.map((row) => ({
              label: row.label,
              sublabel: orderCount(row.orders),
              value: row.pieces,
            }))}
            emptyLabel="Sin prendas con corte en el periodo."
          />
        </Block>
      </div>

      <Block title="Pendientes" subtitle="Cómo está la mesa ahora mismo">
        <PendingBlock data={report.pending} />
      </Block>
    </div>
  );
}

function orderCount(orders: number): string {
  return orders === 1 ? "1 orden" : `${orders} órdenes`;
}

function CutKpis({
  summary,
  yieldData,
}: {
  summary: CutSummary;
  yieldData: CutYield;
}) {
  const { bestDay } = summary;
  /* "No se ha medido" no es "salieron 0 metros": un cero aquí se leería en la
     junta como que no se tendió tela. */
  const hasMeters = yieldData.measuredOrders > 0;

  return (
    <section className="grid grid-cols-2 gap-2 lg:grid-cols-3">
      <Kpi
        label="Piezas cortadas"
        value={formatQuantity(summary.pieces)}
        hint={changeHint(summary.piecesChange)}
      />
      <Kpi
        label="% de lo pedido"
        value={formatRate(summary.progress)}
        hint={`${formatQuantity(summary.cutPieces)} de ${formatQuantity(summary.orderedPieces)} pzas`}
      />
      <Kpi
        label="Órdenes trabajadas"
        value={String(summary.orders)}
        hint={changeHint(summary.ordersChange)}
      />
      <Kpi
        label="Metros tendidos"
        value={hasMeters ? formatQuantity(yieldData.metersSpread) : "—"}
        hint={hasMeters ? changeHint(summary.metersChange) : "Sin metros capturados"}
      />
      <Kpi
        label="Piezas por día trabajado"
        value={formatQuantity(summary.piecesPerDay, { decimals: 0 })}
        hint={`${summary.workedDays} días con corte · ${changeHint(summary.piecesPerDayChange)}`}
      />
      <Kpi
        label="Mejor día"
        value={bestDay ? formatQuantity(bestDay.pieces) : "—"}
        hint={bestDay ? formatDayKey(bestDay.key) : "Sin corte en el periodo"}
      />
    </section>
  );
}

const REMNANT_LEVEL_CLASSES: Record<RemnantLevel, string> = {
  ok: "bg-state-available text-state-available-foreground",
  warn: "bg-state-reserved text-state-reserved-foreground",
  high: "bg-state-defective text-state-defective-foreground",
};

function YieldBlock({ data }: { data: CutYield }) {
  if (data.closedOrders === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Ninguna orden terminó de cortarse en el periodo.
      </p>
    );
  }

  if (data.measuredOrders === 0) {
    return (
      <p className="tabular text-sm text-muted-foreground">
        Ninguna de las {data.closedOrders} órdenes con último corte en el
        periodo trae metros capturados. Se anotan en el cierre del corte de
        cada orden.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Va ANTES de las cifras: quien las lee tiene que saber sobre cuántas
          órdenes están hechas, o tomará una muestra por el total. */}
      <p className="tabular border border-border p-2 text-sm">
        <span className="font-semibold">
          {data.measuredOrders} de {data.closedOrders}
        </span>{" "}
        órdenes con último corte en el periodo traen metros capturados. Estas
        cifras sólo cuentan esas.
      </p>

      <dl className="grid grid-cols-2 gap-2 lg:grid-cols-3">
        <YieldFigure label="Metros entregados" value={formatQuantity(data.metersDelivered)} />
        <YieldFigure label="Metros tendidos" value={formatQuantity(data.metersSpread)} />
        <YieldFigure label="Sobrante de tela" value={formatQuantity(data.leftover)} />
        <YieldFigure label="Retacería chica" value={formatQuantity(data.smallRemnant)} />
        <YieldFigure
          label="Metros por pieza"
          value={formatQuantity(data.metersPerPiece, { decimals: 3 })}
        />
        <RemnantFigure rate={data.remnantRate} level={data.remnantLevel} />
      </dl>
    </div>
  );
}

function YieldFigure({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-border p-2">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="tabular mt-0.5 text-lg font-semibold">{value}</dd>
    </div>
  );
}

function RemnantFigure({
  rate,
  level,
}: {
  rate: number | null;
  level: RemnantLevel | null;
}) {
  return (
    <div className={cn("border border-border p-2", level && REMNANT_LEVEL_CLASSES[level])}>
      <dt className="text-xs">% de retacería</dt>
      <dd className="tabular mt-0.5 text-lg font-semibold">
        {formatRate(rate, 2)}
      </dd>
      {level && <dd className="text-xs">{REMNANT_LEVEL_LABELS[level]}</dd>}
    </div>
  );
}

function PendingBlock({ data }: { data: CutPending }) {
  return (
    <dl className="grid grid-cols-2 gap-2 lg:grid-cols-4">
      <YieldFigure label="Órdenes abiertas" value={String(data.openOrders)} />
      <YieldFigure label="Piezas por cortar" value={formatQuantity(data.pendingPieces)} />
      <YieldFigure label="Órdenes vencidas" value={String(data.overdueOrders)} />
      <YieldFigure label="Piezas vencidas" value={formatQuantity(data.overduePieces)} />
    </dl>
  );
}
