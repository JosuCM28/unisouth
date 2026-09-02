import { AlertTriangle } from "lucide-react";
import type { ReceiptReportData } from "@/lib/services/receipt-report.service";
import { UNIT_SHORT_LABELS } from "@/lib/constants/labels";
import { formatDate, formatQuantity } from "@/lib/utils";
import { ReceiptReportBreakdown } from "./receipt-report-breakdown";

/**
 * El reporte global de recepciones.
 *
 * El orden de los bloques no es casual: primero CUÁNTO y CUÁNDO, que es la
 * pregunta que trae a alguien aquí ("¿cuánta tela llegó este mes?"), y
 * después los desgloses que explican esa cifra —de qué tela, de quién, quién
 * la mandó y quién la trajo—.
 */
export function ReceiptReportView({ report }: { report: ReceiptReportData }) {
  const { summary } = report;
  // La unidad dominante: con la que se miden las barras de todos los cortes.
  const mainUnit = summary.byUnit[0] ?? null;

  return (
    <div className="flex flex-col gap-4">
      {report.truncated && (
        <p className="flex items-start gap-2 border border-state-reserved bg-card p-3 text-sm">
          <AlertTriangle
            className="size-4 shrink-0 text-state-reserved"
            aria-hidden
          />
          {/* Se dice en pantalla y no sólo en el Excel: un total incompleto se
              ve igual de correcto que uno completo, y con éste se decide. */}
          <span>
            El rango trae más recepciones de las que caben en un reporte. Las
            cifras están incompletas: acota las fechas o filtra por tela.
          </span>
        </p>
      )}

      <section className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        <Kpi
          label="Entró"
          value={
            mainUnit
              ? formatQuantity(mainUnit.quantity, {
                  unit: UNIT_SHORT_LABELS[mainUnit.unit],
                })
              : "—"
          }
          hint={otherUnitsHint(summary.byUnit)}
        />
        <Kpi
          label="Rollos"
          value={String(summary.lots)}
          hint="Piezas físicas recibidas"
        />
        <Kpi
          label="Recepciones"
          value={String(summary.receipts)}
          hint="Guías que llegaron"
        />
        <Kpi
          label="Telas distintas"
          value={String(summary.materials)}
          hint={`De ${summary.clients} ${summary.clients === 1 ? "dueño" : "dueños"}`}
        />
      </section>

      <Block
        title="Cuánto llegó por periodo"
        subtitle="La serie completa, incluidos los periodos en que no llegó nada"
      >
        <ReceiptReportBreakdown
          rows={report.periods}
          unit={mainUnit?.unit ?? null}
          emptyLabel="No llegó nada en este rango."
        />
      </Block>

      <Block title="Por tela" subtitle="De qué material fue lo que entró">
        <ReceiptReportBreakdown
          rows={report.byMaterial}
          unit={mainUnit?.unit ?? null}
          emptyLabel="Sin material recibido en el rango."
        />
      </Block>

      <Block
        title="Por cliente dueño"
        subtitle="De quién es la tela que está en la bodega"
      >
        <ReceiptReportBreakdown
          rows={report.byClient}
          unit={mainUnit?.unit ?? null}
          emptyLabel="Sin material recibido en el rango."
        />
      </Block>

      <Block title="Por proveedor" subtitle="Quién la mandó">
        <ReceiptReportBreakdown
          rows={report.bySupplier}
          unit={mainUnit?.unit ?? null}
          emptyLabel="Sin proveedores en el rango."
        />
      </Block>

      <Block title="Por paquetería" subtitle="Quién la trajo">
        <ReceiptReportBreakdown
          rows={report.byCarrier}
          unit={mainUnit?.unit ?? null}
          emptyLabel="Sin paqueterías en el rango."
        />
      </Block>

      <p className="tabular text-xs text-muted-foreground">
        Del {formatDate(summary.from)} al {formatDate(summary.to)} · se cuenta
        lo que entró, no el saldo de hoy.
      </p>
    </div>
  );
}

/**
 * "más 2,000 pza".
 *
 * Las otras unidades van de subtítulo y no sumadas a la cifra grande: metros
 * y piezas no se suman, y un "7,502" que junta tela con cierres es un número
 * que no significa nada.
 */
function otherUnitsHint(
  byUnit: ReceiptReportData["summary"]["byUnit"],
): string {
  const rest = byUnit.slice(1);
  if (rest.length === 0) return "En el periodo";

  return `más ${rest
    .map((total) =>
      formatQuantity(total.quantity, { unit: UNIT_SHORT_LABELS[total.unit] }),
    )
    .join(" · ")}`;
}

function Kpi({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="flat-surface p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="tabular mt-1 text-2xl font-semibold leading-none">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}

function Block({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flat-surface p-4">
      <h2 className="text-sm font-semibold uppercase tracking-wide">{title}</h2>
      <p className="mb-3 text-xs text-muted-foreground">{subtitle}</p>
      {children}
    </section>
  );
}
