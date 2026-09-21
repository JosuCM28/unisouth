import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/core/session";
import {
  cuttingOrderWhere,
  parseCuttingOrderFilters,
} from "@/lib/repositories/cutting-order-filters";
import { EXPORT_ROW_LIMIT } from "@/lib/export/limits";
import { CUTTING_ORDER_STATUS_LABELS } from "@/lib/constants/labels";
import { cutTotals, formatDate } from "@/lib/utils";
import { PrintSheet, PrintTable } from "@/components/shared/print-sheet";

export const metadata: Metadata = { title: "Órdenes impresas" };

interface PageProps {
  searchParams: Promise<{
    q?: string;
    client?: string;
    status?: string;
    from?: string;
    to?: string;
    folder?: string;
  }>;
}

/**
 * Las órdenes filtradas, en papel o PDF.
 *
 * Una fila por ORDEN, no por talla: en pantalla el Excel se pivotea por talla
 * porque ahí se agrupa, pero una hoja impresa con seis renglones por orden se
 * vuelve ilegible. Aquí interesa el avance de cada orden de un vistazo.
 */
export default async function PrintOrdersPage({ searchParams }: PageProps) {
  await requirePermission("inventory:browse");

  const params = await searchParams;
  const filters = parseCuttingOrderFilters(params);

  const orders = await prisma.cuttingOrder.findMany({
    where: cuttingOrderWhere(filters),
    // Mismo desempate que la lista: la hoja sale en el orden de la pantalla.
    orderBy: [{ orderedAt: "desc" }, { createdAt: "desc" }, { id: "desc" }],
    take: EXPORT_ROW_LIMIT,
    include: {
      client: { select: { name: true } },
      folder: { select: { code: true } },
      lines: { select: { orderedQuantity: true, cutQuantity: true } },
    },
  });

  const rows = orders.map((order) => {
    /* Talla por talla, igual que la hoja de UNA orden: si el neto mandara,
       esta lista diría "faltan 834" donde la hoja de esa misma orden dice
       "faltan 902 · sobran 68", y las dos se imprimen para la misma junta. */
    const { ordered, cut, pending, surplus } = cutTotals(order.lines);

    return [
      order.code,
      order.folder?.code ?? "—",
      order.client?.name ?? "Fábrica",
      order.description ?? "—",
      CUTTING_ORDER_STATUS_LABELS[order.status],
      formatDate(order.orderedAt),
      order.dueDate ? formatDate(order.dueDate) : "—",
      ordered,
      cut,
      /* Los dos cuando hay de los dos: "902 (+68)". Enseñar sólo uno deja
         fuera de la hoja piezas que ya se cortaron o que faltan por cortar. */
      pendingCell(pending, surplus),
    ];
  });

  const criteria: string[] = [];
  if (params.client) criteria.push("un cliente");
  if (params.folder) criteria.push("un pedido");
  if (params.status) {
    criteria.push(
      CUTTING_ORDER_STATUS_LABELS[
        params.status as keyof typeof CUTTING_ORDER_STATUS_LABELS
      ] ?? params.status,
    );
  }
  if (params.from) criteria.push(`desde ${params.from}`);
  if (params.to) criteria.push(`hasta ${params.to}`);

  return (
    <PrintSheet
      title="Órdenes de corte"
      criteria={criteria.length > 0 ? criteria : ["sin filtro"]}
      count={`${orders.length} ${orders.length === 1 ? "orden" : "órdenes"}`}
    >
      <PrintTable
        head={[
          "Orden",
          "Pedido",
          "Cliente",
          "Descripción",
          "Estado",
          "Pedido el",
          "Entrega",
          "Pedidas",
          "Cortadas",
          "Faltan",
        ]}
        rows={rows}
        numeric={[7, 8, 9]}
        empty="Ninguna orden cumple con ese filtro."
      />
    </PrintSheet>
  );
}

/**
 * La celda de "Faltan" de una orden.
 *
 * Una orden puede ir corta en unas tallas y pasada en otras a la vez, así que
 * el excedente va ENTRE PARÉNTESIS junto al faltante en vez de reemplazarlo:
 * en la hoja impresa no hay dónde picar para ver el desglose, y un solo
 * número tendría que ser el neto, que es justo el que miente.
 */
function pendingCell(pending: number, surplus: number): string | number {
  if (pending > 0 && surplus > 0) return `${pending} (+${surplus})`;
  if (surplus > 0) return `+${surplus}`;
  return pending;
}
