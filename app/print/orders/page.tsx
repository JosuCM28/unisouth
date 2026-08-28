import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/core/session";
import {
  cuttingOrderWhere,
  parseCuttingOrderFilters,
} from "@/lib/repositories/cutting-order-filters";
import { EXPORT_ROW_LIMIT } from "@/lib/export/limits";
import { CUTTING_ORDER_STATUS_LABELS } from "@/lib/constants/labels";
import { cutProgress, formatDate } from "@/lib/utils";
import { PrintSheet, PrintTable } from "@/components/shared/print-sheet";

export const metadata: Metadata = { title: "Órdenes impresas" };

interface PageProps {
  searchParams: Promise<{
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
    const ordered = order.lines.reduce((sum, l) => sum + l.orderedQuantity, 0);
    const cut = order.lines.reduce((sum, l) => sum + l.cutQuantity, 0);
    const { pending, surplus } = cutProgress(ordered, cut);

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
      pending || (surplus ? `+${surplus}` : 0),
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
