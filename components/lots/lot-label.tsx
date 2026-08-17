import { UNIT_SHORT_LABELS } from "@/lib/constants/labels";
import { formatDate, formatQuantity } from "@/lib/utils";
import type { LotSheetData } from "@/lib/lot-sheet-data";

/**
 * Etiqueta para pegar en el rollo.
 *
 * Lleva sólo lo que se necesita leer con el rollo en la mano: folio, QR,
 * material, metraje y tono. El resto va en la hoja completa.
 *
 * Todo va grande y con bordes gruesos: se lee a un metro de distancia, con
 * mala luz y con la etiqueta ya un poco sucia.
 */
export function LotLabel({
  lot,
  qrSvg,
}: {
  lot: LotSheetData;
  qrSvg: string;
}) {
  const unitLabel = UNIT_SHORT_LABELS[lot.unit];

  return (
    <article className="mx-auto w-[10cm] border-2 border-black bg-white p-4 text-black">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="tabular text-2xl font-bold leading-none">{lot.code}</p>
          <p className="mt-1.5 truncate text-sm font-medium">
            {lot.materialName}
          </p>
        </div>

        <div className="size-24 shrink-0" dangerouslySetInnerHTML={{ __html: qrSvg }} />
      </div>

      {/* El metraje es el dato que más se consulta: va enorme. */}
      <p className="tabular mt-2 border-y-2 border-black py-1 text-center text-3xl font-bold">
        {formatQuantity(lot.currentQuantity, { unit: unitLabel })}
      </p>

      <dl className="mt-2 space-y-0.5 text-xs">
        <LabelRow label="Tono" value={lot.shade} tabular />
        <LabelRow label="Color" value={lot.colorText ?? lot.materialColor} />
        <LabelRow label="Cliente" value={lot.clientName ?? "Fábrica"} />
        <LabelRow label="Ubicación" value={lot.locationName} tabular />
        <LabelRow label="Entrada" value={formatDate(lot.receivedAt)} tabular />
      </dl>
    </article>
  );
}

function LabelRow({
  label,
  value,
  tabular,
}: {
  label: string;
  value: string | null | undefined;
  tabular?: boolean;
}) {
  if (!value) return null;

  return (
    <div className="flex justify-between gap-2">
      <dt className="shrink-0 text-neutral-600">{label}</dt>
      <dd className={tabular ? "tabular truncate text-right font-medium" : "truncate text-right font-medium"}>
        {value}
      </dd>
    </div>
  );
}
