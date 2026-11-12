import type { Metadata } from "next";
import { requirePermission } from "@/lib/core/session";
import { parseRangeDays } from "@/lib/constants/report-ranges";
import { ReportService } from "@/lib/services/report.service";
import { formatDate, formatQuantity } from "@/lib/utils";
import { Figure, Section, Table } from "@/components/reports/print-parts";
import { PrintButton } from "@/components/shared/print-button";

export const metadata: Metadata = { title: "Reporte" };

interface PageProps {
  searchParams: Promise<{ dias?: string }>;
}

const RANGE_LABELS: Record<number, string> = {
  30: "del último mes",
  90: "del último trimestre",
  365: "del último año",
};

/**
 * Reporte para llevar en papel a la junta.
 *
 * En blanco y negro y sin gráficas de barras: las barras se ven bien en
 * pantalla pero en una impresora láser sin tóner de color quedan como cajas
 * grises indistinguibles. En papel manda la tabla con los números exactos.
 */
export default async function PrintReportPage({ searchParams }: PageProps) {
  await requirePermission("reporting:read");

  const params = await searchParams;
  const days = parseRangeDays(params.dias);
  const report = await new ReportService().getReport(days);

  return (
    <main className="mx-auto w-full max-w-3xl">
      <div className="p-4 print:hidden">
        <PrintButton />
      </div>

      <article className="bg-white p-4 text-black sm:p-8 print:p-8">
        <header className="border-b-2 border-black pb-3">
          <p className="text-xs uppercase tracking-wide">UNISOUTH · Almacén</p>
          <h1 className="mt-1 text-2xl font-bold leading-none">
            Reporte {RANGE_LABELS[days]}
          </h1>
          <p className="tabular mt-2 text-sm">
            Del {formatDate(report.summary.from)} al{" "}
            {formatDate(report.summary.to)}
          </p>
        </header>

        <section className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 print:grid-cols-3">
          <Figure
            label="Salió a producción"
            value={formatQuantity(report.summary.totalConsumed)}
          />
          <Figure
            label="Entró al almacén"
            value={formatQuantity(report.summary.totalReceived)}
          />
          <Figure
            label="Rollos en bodega"
            value={String(report.summary.lotsInWarehouse)}
          />
        </section>

        <Section title="Consumo por cliente">
          <Table
            head={["Cliente", "Consumo"]}
            rows={report.byClient.map((row) => [
              row.clientName,
              formatQuantity(row.quantity),
            ])}
            empty="Sin consumo registrado en el periodo."
          />
        </Section>

        <Section title="Movimiento del almacén">
          <Table
            head={["Mes", "Entró", "Salió"]}
            rows={report.flow.map((row) => [
              row.label,
              formatQuantity(row.inbound),
              formatQuantity(row.outbound),
            ])}
            empty="Sin movimientos."
          />
        </Section>

        <Section title="Focos de atención">
          <Table
            head={["Concepto", "Rollos"]}
            rows={report.alerts.map((row) => [row.label, String(row.count)])}
            empty="Sin focos de atención."
          />
        </Section>

        <footer className="mt-6 border-t border-neutral-400 pt-2 text-xs">
          Impreso el {formatDate(new Date())}
        </footer>
      </article>
    </main>
  );
}
