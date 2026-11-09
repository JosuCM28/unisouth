import { CUT_DETAIL_GROUP_LABELS } from "@/lib/constants/labels";
import { formatDayKey } from "@/lib/report-period";
import type {
  CutDetailBucket,
  CutDetailData,
} from "@/lib/reports/cut-detail-calculations";
import { formatDifference, formatRate } from "@/lib/reports/cut-report-format";
import { formatDate, formatQuantity } from "@/lib/utils";
import { Figure, Section, Table } from "./print-parts";

function labelOf(bucket: CutDetailBucket): string {
  return bucket.partial ? `${bucket.label} *` : bucket.label;
}

/** El detalle en papel: el resumen y lo que se cortó en cada periodo. */
export function CutDetailPrint({ report }: { report: CutDetailData }) {
  const { period, group, buckets, totals } = report;

  return (
    <article className="bg-white p-4 text-black sm:p-8 print:p-8">
      <header className="border-b-2 border-black pb-3">
        <p className="text-xs uppercase tracking-wide">
          UNISOUTH · Detalle de corte
        </p>
        <h1 className="mt-1 text-2xl font-bold leading-none first-letter:uppercase">
          {period.label}
        </h1>
        <p className="mt-2 text-sm">{CUT_DETAIL_GROUP_LABELS[group]}</p>
      </header>

      <section className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4 print:grid-cols-4">
        <Figure label="Piezas cortadas" value={formatQuantity(totals.pieces)} />
        <Figure label="Bultos" value={formatQuantity(totals.bundles)} />
        <Figure label="Órdenes" value={String(totals.orders)} />
        <Figure label="Cortes" value={String(totals.cuts)} />
      </section>

      <Section title="Resumen">
        <Table
          head={["Periodo", "Piezas", "Bultos", "Órdenes", "% total", "Diferencia"]}
          numericFrom={1}
          rows={buckets.map((bucket) => [
            labelOf(bucket),
            formatQuantity(bucket.pieces),
            formatQuantity(bucket.bundles),
            String(bucket.orders),
            formatRate(bucket.share),
            formatDifference(bucket.difference),
          ])}
          empty="No se capturó corte en este periodo."
        />
      </Section>

      {buckets
        .filter((bucket) => bucket.cuts > 0)
        .map((bucket) => (
          <Section key={bucket.key} title={labelOf(bucket)}>
            <Table
              head={["Día", "Folio", "Empresa · prenda", "Tallas", "Bultos", "Piezas"]}
              numericFrom={4}
              rows={bucket.items.map((item) => [
                formatDayKey(item.dayKey),
                `${item.orderCode} (${item.cutName})`,
                `${item.clientName} · ${item.description}`,
                item.sizes
                  .map((size) => `${size.code}: ${size.pieces}`)
                  .join(" · "),
                formatQuantity(item.bundles),
                formatQuantity(item.pieces),
              ])}
              empty="Sin corte."
            />
          </Section>
        ))}

      <footer className="mt-6 border-t border-neutral-400 pt-2 text-xs">
        * Incompleto en este periodo. Impreso el {formatDate(new Date())}
      </footer>
    </article>
  );
}
