import { MEASUREMENT_SOURCE_LABELS } from "@/lib/constants/labels";
import { formatDate } from "@/lib/utils";

interface ReceiptLot {
  receivedAt: Date;
  supplierLotNumber: string | null;
  measurementSource: keyof typeof MEASUREMENT_SOURCE_LABELS;
  createdBy: { name: string } | null;
  receipt: {
    code: string;
    date: Date;
    guideNumber: string | null;
    origin: string | null;
    supplier: { name: string } | null;
    carrier: { name: string } | null;
  } | null;
}

/**
 * De dónde vino el rollo.
 *
 * Los renglones vacíos no se pintan: con casi todo opcional, mostrar ocho
 * guiones sería peor que no mostrar la sección.
 */
export function LotReceiptInfo({ lot }: { lot: ReceiptLot }) {
  const rows: { label: string; value: string; tabular?: boolean }[] = [];

  rows.push({ label: "Recibido", value: formatDate(lot.receivedAt), tabular: true });

  if (lot.receipt) {
    rows.push({ label: "Recepción", value: lot.receipt.code, tabular: true });
    if (lot.receipt.guideNumber)
      rows.push({ label: "Guía", value: lot.receipt.guideNumber, tabular: true });
    if (lot.receipt.carrier)
      rows.push({ label: "Paquetería", value: lot.receipt.carrier.name });
    if (lot.receipt.supplier)
      rows.push({ label: "Proveedor", value: lot.receipt.supplier.name });
    if (lot.receipt.origin)
      rows.push({ label: "Origen", value: lot.receipt.origin });
  }

  if (lot.supplierLotNumber)
    rows.push({ label: "Lote proveedor", value: lot.supplierLotNumber, tabular: true });

  rows.push({
    label: "Metraje según",
    value: MEASUREMENT_SOURCE_LABELS[lot.measurementSource],
  });

  if (lot.createdBy) rows.push({ label: "Dio de alta", value: lot.createdBy.name });

  return (
    <section className="flat-surface p-4">
      <h2 className="mb-2 text-sm font-semibold">Recepción</h2>
      <dl className="flex flex-col gap-1.5">
        {rows.map((row) => (
          <div key={row.label} className="flex justify-between gap-3 text-sm">
            <dt className="shrink-0 text-muted-foreground">{row.label}</dt>
            <dd className={row.tabular ? "tabular truncate text-right" : "truncate text-right"}>
              {row.value}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
