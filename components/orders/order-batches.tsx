import Link from "next/link";
import { Truck } from "lucide-react";
import type { DocumentStatus } from "@prisma/client";
import {
  cutBatchLabel,
  DOCUMENT_STATUS_LABELS,
  DOCUMENT_STATUS_STYLES,
} from "@/lib/constants/labels";
import { sumBundlePieces, sumBundles } from "@/lib/bundles";
import { formatDate, formatDateTime } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { OrderSendToIssueDialog } from "./order-send-to-issue-dialog";

/** Un bulto (o varios de la misma cuenta) que una talla aportó a un corte. */
export interface BatchEntryView {
  id: string;
  sizeCode: string;
  /** Piezas POR BULTO: lo que vale la captura es `quantity * bundles`. */
  quantity: number;
  bundles: number;
  createdAt: Date;
  userName: string | null;
  notes: string | null;
}

/** La salida de este corte, si ya se mandó. */
export interface BatchIssueView {
  id: string;
  code: string;
  status: DocumentStatus;
}

export interface BatchView {
  id: string;
  number: number;
  label: string | null;
  notes: string | null;
  openedAt: Date;
  openedByName: string | null;
  entries: BatchEntryView[];
  /**
   * Las salidas de ESTE corte, de la más nueva a la más vieja.
   *
   * En plural porque un vale cancelado no borra el intento: si alguien mandó
   * el corte, se equivocó y lo canceló, la ficha tiene que seguir contando
   * las dos cosas.
   */
  issues: BatchIssueView[];
}

/**
 * Los cortes de una orden, del más nuevo al más viejo.
 *
 * Sustituye al historial plano de avances, que respondía "cuándo se cortó
 * esto" pero no "cuántas dio el segundo corte": las entradas se veían en fila
 * y agrupar las de una misma tanda era trabajo de quien leía. Aquí cada corte
 * trae su total y su desglose por talla, que es como se pregunta en el piso.
 *
 * Las tallas de un corte se AGRUPAN aunque se hayan capturado en dos ratos:
 * un corte es un tendido, no una sesión de captura, y ver la 32 dos veces en
 * el mismo bloque obliga a sumarlas a mano.
 */
export function OrderBatches({
  batches,
  orderId,
  orderCode,
  canSend = false,
}: {
  batches: BatchView[];
  orderId: string;
  orderCode: string;
  /** Si se ofrece mandar cortes a salidas. Falso en una orden cancelada. */
  canSend?: boolean;
}) {
  if (batches.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Aún no se captura ningún corte. Usa “Capturar corte” cuando el tendido
        salga de la mesa.
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-3">
      {batches.map((batch) => {
        // Cantidad × bultos: la captura guarda lo que lleva CADA bulto.
        const total = sumBundlePieces(batch.entries);

        // Un vale cancelado no cuenta: cancelar es justo cómo se deshace un
        // envío equivocado, y después el corte se puede volver a mandar.
        const live = batch.issues.find((issue) => issue.status !== "CANCELLED");
        const sizes = groupBySize(batch.entries).filter(
          (row) => row.quantity > 0,
        );

        return (
          <li key={batch.id} className="flat-surface flex flex-col gap-2 p-3">
            {/* El total SIEMPRE a la derecha del nombre. La nota va fuera de
                esta fila —no dentro de la columna izquierda— porque su ancho
                natural empujaba el número al renglón de abajo en cuanto el
                texto era largo, y en celular cada corte quedaba maquetado
                distinto según lo que alguien hubiera escrito. */}
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">
                  {cutBatchLabel(batch.number, batch.label)}
                </p>
                <p className="tabular text-xs text-muted-foreground">
                  {formatDate(batch.openedAt)}
                  {batch.openedByName && ` · ${batch.openedByName}`}
                </p>
              </div>

              <p className="tabular shrink-0 text-2xl font-semibold leading-none">
                {total}
              </p>
            </div>

            {batch.notes && (
              <p className="text-xs text-muted-foreground">{batch.notes}</p>
            )}

            {/* Las salidas de este corte. Se pintan TODAS, canceladas
                incluidas: que un vale se haya cancelado es parte de lo que
                pasó con este tendido, y esconderlo deja la pregunta "¿no que
                ya lo habíamos mandado?" sin respuesta en la pantalla. */}
            {batch.issues.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5">
                {batch.issues.map((issue) => (
                  <Link
                    key={issue.id}
                    href={`/documents/${issue.id}`}
                    className="flex items-center gap-1.5 rounded border border-border px-1.5 py-0.5 text-xs"
                  >
                    <Truck className="size-3 shrink-0" aria-hidden />
                    <span className="tabular">{issue.code}</span>
                    <span
                      className={cn(
                        "rounded px-1",
                        DOCUMENT_STATUS_STYLES[issue.status],
                      )}
                    >
                      {DOCUMENT_STATUS_LABELS[issue.status]}
                    </span>
                  </Link>
                ))}
              </div>
            )}

            {batch.entries.length === 0 ? (
              /* Un corte abierto sin piezas es un estado válido: se abrió para
                 empezar a capturar y todavía no sale nada de la mesa. */
              <p className="text-xs text-muted-foreground">
                Abierto, sin piezas capturadas.
              </p>
            ) : (
              <ul className="flex flex-col">
                {groupBySize(batch.entries).map((row) => (
                  <li
                    key={row.sizeCode}
                    className="flex items-baseline justify-between gap-3 border-t border-border py-1 text-sm"
                  >
                    <span className="tabular">Talla {row.sizeCode}</span>
                    <span className="tabular flex items-baseline gap-2">
                      {/* Los bultos sólo cuando son más de uno: con uno solo
                          es ruido al lado de la cifra que de verdad se lee. */}
                      {row.bundles > 1 && (
                        <span className="text-xs text-muted-foreground">
                          {row.bundles} bultos
                        </span>
                      )}
                      <span
                        className={cn(
                          "font-medium",
                          row.quantity < 0 && "text-state-defective",
                        )}
                      >
                        {row.quantity > 0 ? "+" : ""}
                        {row.quantity}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            )}

            {/* El detalle de captura queda plegado: interesa cuando algo no
                cuadra, no cada vez que se abre la orden. */}
            {batch.entries.length > 0 && (
              <details className="text-xs text-muted-foreground">
                <summary className="touch-target cursor-pointer list-none py-1">
                  Ver las {batch.entries.length}{" "}
                  {batch.entries.length === 1 ? "captura" : "capturas"}
                </summary>
                <ul className="mt-1 flex flex-col gap-1 border-t border-border pt-1">
                  {batch.entries.map((entry) => (
                    <li key={entry.id} className="tabular">
                      Talla {entry.sizeCode}: {entry.quantity > 0 ? "+" : ""}
                      {entry.quantity}
                      {/* El desglose del bulto sólo cuando hay más de uno: es
                          lo que explica de dónde salió el total. */}
                      {entry.bundles > 1 &&
                        ` × ${entry.bundles} bultos = ${
                          entry.quantity * entry.bundles
                        }`}{" "}
                      · {formatDateTime(entry.createdAt)}
                      {entry.userName && ` · ${entry.userName}`}
                      {entry.notes && ` · ${entry.notes}`}
                    </li>
                  ))}
                </ul>
              </details>
            )}

            {/* Mandar ESTE corte, no la orden entera.

                El taller entrega por tendidos: corta el primero, lo entrega, y
                sigue con el segundo. Sin este botón había que mandar todo lo
                cortado hasta la fecha, y el segundo vale volvía a incluir lo
                que ya se había llevado el primero.

                Con una salida viva no se ofrece: mandarlo otra vez entregaría
                dos veces las mismas prendas. El chip de arriba dice cuál es el
                vale, y cancelarlo vuelve a habilitar el botón. */}
            {canSend && !live && sizes.length > 0 && (
              <OrderSendToIssueDialog
                orderId={orderId}
                orderCode={orderCode}
                sizes={sizes}
                batch={{
                  id: batch.id,
                  label: cutBatchLabel(batch.number, batch.label),
                }}
                trigger={
                  <Button
                    variant="outline"
                    className="touch-target w-full sm:w-auto"
                  >
                    <Truck className="size-4" aria-hidden />
                    Mandar a salida
                  </Button>
                }
              />
            )}
          </li>
        );
      })}
    </ul>
  );
}

/** Suma las capturas de una misma talla dentro del corte. */
function groupBySize(entries: BatchEntryView[]) {
  const totals = new Map<string, BatchEntryView[]>();

  for (const entry of entries) {
    totals.set(entry.sizeCode, [...(totals.get(entry.sizeCode) ?? []), entry]);
  }

  return [...totals.entries()]
    .map(([sizeCode, rows]) => ({
      sizeCode,
      quantity: sumBundlePieces(rows),
      bundles: sumBundles(rows),
    }))
    .sort((a, b) => a.sizeCode.localeCompare(b.sizeCode, "es", { numeric: true }));
}
