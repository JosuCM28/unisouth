import { REMNANT_LEVEL_LABELS } from "@/lib/constants/labels";
import { formatDayKey, formatWeekdayKey } from "@/lib/report-period";
import type { CutReportData } from "@/lib/reports/cut-report-calculations";
import {
  formatChange,
  formatDifference,
  formatRate,
} from "@/lib/reports/cut-report-format";
import { formatDate, formatQuantity } from "@/lib/utils";
import { Figure, Section, Table } from "./print-parts";

/**
 * El reporte de corte para llevar a la junta.
 *
 * En tablas y sin gráficas, igual que el de almacén: en una láser sin color
 * las barras son cajas grises y en papel lo que se discute es el número.
 */
export function CutReportPrint({ report }: { report: CutReportData }) {
  const { period, summary, yieldData, pending } = report;

  return (
    <article className="bg-white p-4 text-black sm:p-8 print:p-8">
      <header className="border-b-2 border-black pb-3">
        <p className="text-xs uppercase tracking-wide">UNISOUTH · Corte</p>
        <h1 className="mt-1 text-2xl font-bold leading-none first-letter:uppercase">
          {period.label}
        </h1>
        <p className="tabular mt-2 text-sm">
          Del {formatDayKey(period.fromKey)} al {formatDayKey(period.toKey)} ·
          comparado contra {period.previousLabel}
        </p>
      </header>

      <section className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 print:grid-cols-3">
        <Figure
          label={`Piezas cortadas (${formatChange(summary.piecesChange)})`}
          value={formatQuantity(summary.pieces)}
        />
        <Figure label="% de lo pedido" value={formatRate(summary.progress)} />
        <Figure label="Órdenes trabajadas" value={String(summary.orders)} />
        <Figure
          label="Metros tendidos"
          value={
            yieldData.measuredOrders > 0
              ? formatQuantity(yieldData.metersSpread)
              : "—"
          }
        />
        <Figure
          label="Piezas por día trabajado"
          value={formatQuantity(summary.piecesPerDay, { decimals: 0 })}
        />
        <Figure label="Días con corte" value={String(summary.workedDays)} />
      </section>

      <Section title="Últimos 14 días">
        <Table
          head={["Día", "Piezas", "Diferencia"]}
          numericFrom={1}
          rows={report.daily.days.map((day) => [
            formatWeekdayKey(day.key),
            formatQuantity(day.pieces),
            formatDifference(day.difference),
          ])}
          empty="Sin corte en estos días."
        />
        <p className="tabular mt-2 text-sm">
          Total {formatQuantity(report.daily.total)} · 14 días anteriores{" "}
          {formatQuantity(report.daily.previousTotal)} · variación{" "}
          {formatChange(report.daily.change)}
        </p>
      </Section>

      <Section title="Por empresa">
        <Table
          head={["Empresa", "Piezas", "% total", "Órdenes", "Pedido", "Avance"]}
          numericFrom={1}
          rows={report.clients.map((row) => [
            row.name,
            formatQuantity(row.pieces),
            formatRate(row.share),
            String(row.orders),
            formatQuantity(row.ordered),
            formatRate(row.progress),
          ])}
          empty="Sin corte en el periodo."
        />
      </Section>

      <Section title="Por mes">
        <Table
          head={["Mes", "Piezas", "Variación", "Metros"]}
          numericFrom={1}
          rows={report.monthly.map((row) => [
            row.partial ? `${row.label}*` : row.label,
            formatQuantity(row.pieces),
            formatChange(row.change),
            formatQuantity(row.meters || null),
          ])}
          empty="Sin corte en estos meses."
        />
      </Section>

      <Section title="Rendimiento de tela">
        <p className="tabular mb-2 text-sm">
          {yieldData.measuredOrders} de {yieldData.closedOrders} órdenes con
          último corte en el periodo traen metros capturados. Estas cifras sólo
          cuentan esas.
        </p>
        <Table
          head={["Concepto", "Valor"]}
          rows={yieldRows(report)}
          empty="Sin metros capturados."
        />
      </Section>

      <Section title="Órdenes con más corte">
        <Table
          head={["Folio", "Empresa", "Descripción", "Piezas"]}
          rows={report.topOrders.map((row) => [
            row.code,
            row.clientName,
            row.description,
            formatQuantity(row.pieces),
          ])}
          empty="Sin órdenes con corte en el periodo."
        />
      </Section>

      <Section title="Prendas con más corte">
        <Table
          head={["Prenda", "Órdenes", "Piezas"]}
          numericFrom={1}
          rows={report.topGarments.map((row) => [
            row.label,
            String(row.orders),
            formatQuantity(row.pieces),
          ])}
          empty="Sin prendas con corte en el periodo."
        />
      </Section>

      <Section title="Pendientes al día de hoy">
        <Table
          head={["Concepto", "Cantidad"]}
          rows={[
            ["Órdenes abiertas", String(pending.openOrders)],
            ["Piezas por cortar", formatQuantity(pending.pendingPieces)],
            ["Órdenes vencidas", String(pending.overdueOrders)],
            ["Piezas vencidas", formatQuantity(pending.overduePieces)],
          ]}
          empty="Sin pendientes."
        />
      </Section>

      <footer className="mt-6 border-t border-neutral-400 pt-2 text-xs">
        Impreso el {formatDate(new Date())}
      </footer>
    </article>
  );
}

function yieldRows(report: CutReportData): string[][] {
  const { yieldData } = report;
  if (yieldData.measuredOrders === 0) return [];

  return [
    ["Metros entregados", formatQuantity(yieldData.metersDelivered)],
    ["Metros tendidos", formatQuantity(yieldData.metersSpread)],
    ["Sobrante de tela", formatQuantity(yieldData.leftover)],
    ["Retacería chica", formatQuantity(yieldData.smallRemnant)],
    [
      "Metros por pieza",
      formatQuantity(yieldData.metersPerPiece, { decimals: 3 }),
    ],
    ["% de retacería", remnantText(report)],
  ];
}

function remnantText({ yieldData }: CutReportData): string {
  const rate = formatRate(yieldData.remnantRate, 2);
  if (!yieldData.remnantLevel) return rate;
  return `${rate} · ${REMNANT_LEVEL_LABELS[yieldData.remnantLevel]}`;
}
