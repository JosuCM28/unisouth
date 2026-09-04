import Link from "next/link";
import { Send, Truck } from "lucide-react";
import type { DocumentStatus } from "@prisma/client";
import {
  DOCUMENT_STATUS_LABELS,
  DOCUMENT_STATUS_STYLES,
} from "@/lib/constants/labels";
import { cn, formatDate } from "@/lib/utils";

export interface IssueView {
  id: string;
  code: string;
  status: DocumentStatus;
  date: Date;
  receivedBy: string | null;
  /** De qué corte salió. Vacío = cubre la orden completa. */
  batchLabel: string | null;
  pieces: number;
  sizes: number;
  /** El envío a taller que lo levantó, cuando el vale nació de uno. */
  shipment: {
    code: string;
    workshopName: string;
    stageName: string;
  } | null;
}

/**
 * Las salidas que ya nacieron de esta orden.
 *
 * Es el indicador que contesta la pregunta de todos los días: "¿esto ya lo
 * mandamos?". Antes no había forma de saberlo desde la orden —el vale sólo
 * copiaba el número de papel en un campo de texto— y se resolvía yendo al
 * registro de salidas a buscar a ojo.
 *
 * Los vales de ENVÍO A TALLER también se listan aquí, marcados. Se pintan dos
 * veces en la pantalla —abajo, en "En talleres", con sus retornos— y está
 * bien: son dos preguntas distintas. Ahí se pregunta "¿qué anda afuera y
 * cuánto ha vuelto?"; aquí, "¿qué papeles salieron de esta orden?". Que el
 * papel del taller faltara en la lista de papeles era el hueco.
 *
 * Las CANCELADAS se pintan también, en gris y tachadas: que un envío se haya
 * cancelado es parte de lo que pasó con la orden, y esconderlo deja sin
 * respuesta al que pregunta "¿no que ya lo habías mandado?".
 */
export function OrderIssues({ issues }: { issues: IssueView[] }) {
  return (
    <ul className="flex flex-col gap-2">
      {issues.map((issue) => {
        const isCancelled = issue.status === "CANCELLED";

        return (
          <li key={issue.id}>
            <Link
              href={`/documents/${issue.id}`}
              className="flat-surface flex items-start justify-between gap-3 p-3 transition-colors active:bg-accent"
            >
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2 text-sm">
                  {/* Otro icono para el que va al taller: en una lista de
                      cinco vales, el ojo separa antes por la silueta que por
                      leer la etiqueta de cada renglón. */}
                  {issue.shipment ? (
                    <Send
                      className="size-3.5 shrink-0 text-muted-foreground"
                      aria-hidden
                    />
                  ) : (
                    <Truck
                      className="size-3.5 shrink-0 text-muted-foreground"
                      aria-hidden
                    />
                  )}
                  <span
                    className={cn(
                      "tabular font-medium",
                      isCancelled && "line-through",
                    )}
                  >
                    {issue.code}
                  </span>
                  <span
                    className={cn(
                      "rounded px-1.5 py-0.5 text-xs",
                      DOCUMENT_STATUS_STYLES[issue.status],
                    )}
                  >
                    {DOCUMENT_STATUS_LABELS[issue.status]}
                  </span>

                  {issue.shipment && (
                    <span className="rounded border border-border px-1.5 py-0.5 text-xs text-muted-foreground">
                      A taller
                    </span>
                  )}
                </p>

                <p className="tabular mt-1 text-xs text-muted-foreground">
                  {formatDate(issue.date)}
                  {/* De qué corte salió: es lo que distingue dos vales de la
                      misma orden mandados con una semana de diferencia. */}
                  {issue.batchLabel
                    ? ` · ${issue.batchLabel}`
                    : " · orden completa"}
                  {issue.receivedBy && ` · recibe ${issue.receivedBy}`}
                </p>

                {/* La etapa, el taller y el folio del envío: es lo que hace
                    que este renglón se pueda cruzar con el bloque de abajo sin
                    tener que abrir el vale. */}
                {issue.shipment && (
                  <p className="tabular mt-0.5 text-xs text-muted-foreground">
                    {issue.shipment.stageName} · {issue.shipment.workshopName} ·{" "}
                    {issue.shipment.code}
                  </p>
                )}
              </div>

              <div className="shrink-0 text-right">
                <p
                  className={cn(
                    "tabular text-xl font-semibold leading-none",
                    isCancelled && "text-muted-foreground line-through",
                  )}
                >
                  {issue.pieces}
                </p>
                <p className="tabular mt-0.5 text-xs text-muted-foreground">
                  {issue.sizes} {issue.sizes === 1 ? "talla" : "tallas"}
                </p>
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
