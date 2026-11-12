import { AlertTriangle } from "lucide-react";
import { ReportService } from "@/lib/services/report.service";
import { formatDate, formatQuantity } from "@/lib/utils";
import { BarChart } from "./bar-chart";
import { FlowChart } from "./flow-chart";
import { Block, Kpi } from "./report-block";

/** La pestaña Almacén: material que entra, sale y se queda parado. */
export async function WarehouseReportSections({ days }: { days: number }) {
  const report = await new ReportService().getReport(days);

  return (
    <div className="flex flex-col gap-4">
      {/* Las tres cifras de arriba: lo que se mira primero al abrir. */}
      <section className="grid grid-cols-2 gap-2 lg:grid-cols-3">
        <Kpi
          label="Salió a producción"
          value={formatQuantity(report.summary.totalConsumed)}
          hint="En el periodo"
        />
        <Kpi
          label="Entró al almacén"
          value={formatQuantity(report.summary.totalReceived)}
          hint="En el periodo"
        />
        <Kpi
          label="Rollos en bodega"
          value={String(report.summary.lotsInWarehouse)}
          hint="Ocupando lugar"
        />
      </section>

      <Block
        title="Consumo por cliente"
        subtitle="De quién era la tela que se usó"
      >
        <BarChart
          data={report.byClient.map((row) => ({
            label: row.clientName,
            value: row.quantity,
          }))}
          emptyLabel="Sin consumo registrado en el periodo."
        />
      </Block>

      <Block
        title="Movimiento del almacén"
        subtitle="Últimos 6 meses, entradas contra salidas"
      >
        <FlowChart data={report.flow} />
      </Block>

      <Block
        title="Focos de atención"
        subtitle="Material que cuesta dinero sin que se note"
      >
        <ul className="flex flex-col gap-2">
          {report.alerts.map((alert) => (
            <li
              key={alert.key}
              className="flex items-start justify-between gap-3 border-b border-border pb-2 last:border-0 last:pb-0"
            >
              <div className="min-w-0">
                <p className="flex items-center gap-1.5 text-sm font-medium">
                  {alert.count > 0 && (
                    <AlertTriangle
                      className="size-3.5 shrink-0 text-state-reserved"
                      aria-hidden
                    />
                  )}
                  {alert.label}
                </p>
                <p className="text-xs text-muted-foreground">{alert.detail}</p>
              </div>
              <span className="tabular shrink-0 text-xl font-semibold">
                {alert.count}
              </span>
            </li>
          ))}
        </ul>
      </Block>

      <p className="tabular text-xs text-muted-foreground">
        Del {formatDate(report.summary.from)} al {formatDate(report.summary.to)}
      </p>
    </div>
  );
}
