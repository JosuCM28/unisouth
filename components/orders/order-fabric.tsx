import Link from "next/link";
import { Scissors } from "lucide-react";
import {
  DOCUMENT_STATUS_LABELS,
  DOCUMENT_STATUS_STYLES,
  UNIT_SHORT_LABELS,
} from "@/lib/constants/labels";
import type { FabricDocument, FabricSummary } from "@/lib/order-fabric";
import { cn, formatDate, formatQuantity } from "@/lib/utils";

interface Props {
  documents: FabricDocument[];
  summary: FabricSummary;
  /** Si el folio lleva al vale. Sin `inventory:browse` se pinta como texto. */
  canOpen: boolean;
}

/**
 * La tela de la orden: cuántos rollos y metros se le sacaron, cuánto regresó
 * y cuánto lleva consumido.
 *
 * Es el control que faltaba para saber lo que cuesta cada orden: antes la
 * salida de tela quedaba en el registro general de salidas y no había forma de
 * sumar, por orden, lo que se llevó.
 */
export function OrderFabric({ documents, summary, canOpen }: Props) {
  const pending = documents.filter((doc) => doc.status === "DRAFT").length;

  return (
    <div className="flex flex-col gap-4">
      {summary.totals.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Todavía no hay tela aplicada para esta orden.
          {pending > 0 && " Hay borradores por aplicar abajo."}
        </p>
      ) : (
        summary.totals.map((total) => {
          const unit = UNIT_SHORT_LABELS[total.unit];

          return (
            <dl
              key={total.unit}
              className="grid grid-cols-2 gap-2 sm:grid-cols-4"
            >
              <Kpi
                label="Rollos sacados"
                value={String(total.rollsOut)}
              />
              <Kpi
                label="Sacado"
                value={formatQuantity(total.out, { unit })}
              />
              <Kpi
                label="Regresado"
                value={formatQuantity(total.returned, { unit })}
                hint={
                  total.rollsReturned > 0
                    ? `${total.rollsReturned} ${total.rollsReturned === 1 ? "rollo" : "rollos"}`
                    : undefined
                }
              />
              <Kpi
                label="Consumo neto"
                value={formatQuantity(total.net, { unit })}
                strong
              />
            </dl>
          );
        })
      )}

      {summary.rolls.length > 0 && (
        <ul className="flex flex-col gap-2">
          {summary.rolls.map((roll) => {
            const unit = UNIT_SHORT_LABELS[roll.unit];

            return (
              <li
                key={roll.lotId}
                className="flat-surface flex items-start justify-between gap-3 p-3"
              >
                <div className="min-w-0">
                  <p className="tabular text-sm font-medium">{roll.lotCode}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {roll.materialName}
                    {roll.shade && ` · tono ${roll.shade}`}
                  </p>
                </div>
                <div className="tabular shrink-0 text-right text-xs text-muted-foreground">
                  <p>Sacó {formatQuantity(roll.out, { unit })}</p>
                  {roll.returned > 0 && (
                    <p>Regresó {formatQuantity(roll.returned, { unit })}</p>
                  )}
                  <p className="text-sm font-semibold text-foreground">
                    {formatQuantity(roll.net, { unit })}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {documents.length > 0 && (
        <div>
          <h3 className="mb-2 text-xs font-medium uppercase text-muted-foreground">
            Vales
          </h3>
          <ul className="flex flex-col gap-1.5">
            {documents.map((doc) => (
              <li key={doc.id}>
                <DocumentRow doc={doc} canOpen={canOpen} />
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function Kpi({
  label,
  value,
  hint,
  strong = false,
}: {
  label: string;
  value: string;
  hint?: string;
  strong?: boolean;
}) {
  return (
    <div
      className={cn(
        "flat-surface p-3",
        strong && "border-primary",
      )}
    >
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="tabular mt-1 text-lg font-semibold leading-none">
        {value}
      </dd>
      {hint && <p className="tabular mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function DocumentRow({
  doc,
  canOpen,
}: {
  doc: FabricDocument;
  canOpen: boolean;
}) {
  const isCancelled = doc.status === "CANCELLED";
  const total = doc.lines.reduce((sum, line) => sum + line.quantity, 0);
  const unit = doc.lines[0] ? UNIT_SHORT_LABELS[doc.lines[0].unit] : "";

  const content = (
    <>
      <span className="flex min-w-0 flex-wrap items-center gap-2 text-sm">
        <Scissors className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
        <span className={cn("tabular font-medium", isCancelled && "line-through")}>
          {doc.code}
        </span>
        <span className="text-xs text-muted-foreground">
          {doc.kind === "ISSUE" ? "Salida" : "Devolución"} ·{" "}
          {formatDate(doc.date)}
        </span>
        <span
          className={cn(
            "rounded px-1.5 py-0.5 text-xs",
            DOCUMENT_STATUS_STYLES[doc.status],
          )}
        >
          {DOCUMENT_STATUS_LABELS[doc.status]}
        </span>
      </span>
      <span
        className={cn(
          "tabular shrink-0 text-xs text-muted-foreground",
          isCancelled && "line-through",
        )}
      >
        {doc.lines.length} {doc.lines.length === 1 ? "rollo" : "rollos"} ·{" "}
        {formatQuantity(total, { unit })}
      </span>
    </>
  );

  const className =
    "flat-surface flex items-center justify-between gap-3 px-3 py-2";

  if (!canOpen) return <div className={className}>{content}</div>;

  return (
    <Link
      href={`/documents/${doc.id}`}
      className={cn(className, "transition-colors active:bg-accent")}
    >
      {content}
    </Link>
  );
}
