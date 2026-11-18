import type { PackingOrderStatus } from "@prisma/client";
import type { ReactNode } from "react";
import { cn, formatDate, formatQuantity } from "@/lib/utils";
import { PackingStatusBadge } from "./packing-status-badge";

/**
 * La franja de datos del pedido, en celdas con borde. Antes iban en una
 * sola línea de texto gris y el número de piezas —lo que se pregunta al
 * cerrar— se perdía entre puntos medios.
 *
 * Las líneas entre celdas son el fondo del contenedor asomando por un
 * `gap-px`: así no hay que calcular qué celda lleva borde izquierdo en cada
 * ancho de pantalla.
 */
export function PackingOrderSummary({
  status,
  clientName,
  date,
  boxes,
  pieces,
}: {
  status: PackingOrderStatus;
  clientName: string | null;
  date: Date;
  boxes: number;
  pieces: number;
}) {
  return (
    <dl className="grid grid-cols-2 gap-px border border-border bg-border md:grid-cols-5">
      <Cell label="Cliente" className="col-span-2 md:col-span-1">
        <span className="truncate">{clientName ?? "Varias empresas"}</span>
      </Cell>
      <Cell label="Estado"><PackingStatusBadge status={status} /></Cell>
      <Cell label="Fecha"><span className="tabular">{formatDate(date)}</span></Cell>
      <Cell label="Cajas"><span className="tabular text-lg font-semibold">{formatQuantity(boxes)}</span></Cell>
      <Cell label="Piezas"><span className="tabular text-lg font-semibold">{formatQuantity(pieces)}</span></Cell>
    </dl>
  );
}

function Cell({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-1 bg-card p-3", className)}>
      <dt className="text-xs uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="flex min-h-7 min-w-0 items-center text-sm font-medium">{children}</dd>
    </div>
  );
}
