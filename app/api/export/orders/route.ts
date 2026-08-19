import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/core/session";
import { enforceRateLimit, EXPORT_LIMIT } from "@/lib/core/rate-limit";
import { csvResponse, toCsv, type CsvColumn } from "@/lib/csv";
import { CUTTING_ORDER_STATUS_LABELS } from "@/lib/constants/labels";
import { cutProgress, formatDate } from "@/lib/utils";
import {
  cuttingOrderWhere,
  parseCuttingOrderFilters,
} from "@/lib/repositories/cutting-order-filters";
import type { CuttingOrderStatus } from "@prisma/client";

/**
 * Una fila por TALLA, no por orden.
 *
 * Es la forma que se pivotea en Excel: con la orden repetida en cada renglón
 * se puede agrupar por cliente, por talla o por mes sin tocar el archivo. Una
 * fila por orden sería más corta pero escondería el detalle por talla, que es
 * justo donde se ve qué se cortó de más y qué quedó a deber.
 */
interface Row {
  code: string;
  status: CuttingOrderStatus;
  client: string;
  description: string;
  reference: string;
  material: string;
  orderedAt: Date;
  dueDate: Date | null;
  sizeCode: string;
  tag: string;
  ordered: number;
  cut: number;
}

const COLUMNS: CsvColumn<Row>[] = [
  { header: "Orden", value: (r) => r.code },
  { header: "Estado", value: (r) => CUTTING_ORDER_STATUS_LABELS[r.status] },
  { header: "Cliente", value: (r) => r.client },
  { header: "Descripción", value: (r) => r.description },
  { header: "Orden del cliente", value: (r) => r.reference },
  { header: "Material", value: (r) => r.material },
  { header: "Pedido el", value: (r) => formatDate(r.orderedAt) },
  { header: "Entrega", value: (r) => (r.dueDate ? formatDate(r.dueDate) : "") },
  { header: "Talla", value: (r) => r.sizeCode },
  { header: "Foleo", value: (r) => r.tag },
  { header: "Pedidas", value: (r) => r.ordered },
  { header: "Cortadas", value: (r) => r.cut },
  { header: "Faltan", value: (r) => cutProgress(r.ordered, r.cut).pending },
  { header: "Sobran", value: (r) => cutProgress(r.ordered, r.cut).surplus },
  {
    header: "Diferencia",
    // Con signo: en Excel se suma la columna y se ve el neto de la selección,
    // cosa que "faltan" y "sobran" por separado no permiten.
    value: (r) => r.cut - r.ordered,
  },
];

export async function GET(request: Request) {
  // Recorren tablas completas: sin límite, son un vector de denegación.
  await enforceRateLimit("export:orders", EXPORT_LIMIT);

  await requirePermission("inventory:read");

  const url = new URL(request.url);
  const filters = parseCuttingOrderFilters({
    client: url.searchParams.get("client") ?? undefined,
    status: url.searchParams.get("status") ?? undefined,
    from: url.searchParams.get("from") ?? undefined,
    to: url.searchParams.get("to") ?? undefined,
  });

  const orders = await prisma.cuttingOrder.findMany({
    where: cuttingOrderWhere(filters),
    orderBy: [{ orderedAt: "desc" }, { id: "asc" }],
    // El tope es de órdenes, pero el archivo crece por tallas: 500 órdenes de
    // seis tallas son 3,000 renglones, que Excel abre sin problema.
    take: 500,
    include: {
      client: { select: { name: true } },
      material: { select: { code: true, name: true } },
      lines: {
        orderBy: { position: "asc" },
        include: {
          size: { select: { code: true } },
          cutTag: { select: { name: true } },
        },
      },
    },
  });

  const rows: Row[] = orders.flatMap((order) =>
    order.lines.map((line) => ({
      code: order.code,
      status: order.status,
      client: order.client?.name ?? "Fábrica",
      description: order.description ?? "",
      reference: order.reference ?? "",
      material: order.material
        ? `${order.material.code} · ${order.material.name}`
        : "",
      orderedAt: order.orderedAt,
      dueDate: order.dueDate,
      sizeCode: line.size.code,
      tag: line.cutTag?.name ?? "",
      ordered: line.orderedQuantity,
      cut: line.cutQuantity,
    })),
  );

  return csvResponse(toCsv(rows, COLUMNS), "ordenes");
}
