import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/core/session";
import { enforceRateLimit, EXPORT_LIMIT } from "@/lib/core/rate-limit";
import {
  toXlsxWithNotice,
  xlsxResponse,
  type XlsxColumn,
} from "@/lib/export/xlsx";
import { EXPORT_ROW_LIMIT } from "@/lib/export/limits";
import { CUTTING_ORDER_STATUS_LABELS } from "@/lib/constants/labels";
import { cutProgress } from "@/lib/utils";
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
  folder: string;
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

const COLUMNS: XlsxColumn<Row>[] = [
  { header: "Orden", value: (r) => r.code, width: 16 },
  { header: "Estado", value: (r) => CUTTING_ORDER_STATUS_LABELS[r.status] },
  // El pedido va junto a la orden para poder agrupar el Excel por pedido,
  // que es como el cliente pregunta por su trabajo.
  { header: "Pedido", value: (r) => r.folder, width: 26 },
  { header: "Cliente", value: (r) => r.client, width: 22 },
  { header: "Descripción", value: (r) => r.description, width: 28 },
  { header: "Orden del cliente", value: (r) => r.reference },
  { header: "Material", value: (r) => r.material, width: 28 },
  { header: "Pedido el", value: (r) => r.orderedAt, kind: "date" },
  { header: "Entrega", value: (r) => r.dueDate, kind: "date" },
  { header: "Talla", value: (r) => r.sizeCode },
  { header: "Foleo", value: (r) => r.tag },
  { header: "Pedidas", value: (r) => r.ordered, kind: "number" },
  { header: "Cortadas", value: (r) => r.cut, kind: "number" },
  {
    header: "Faltan",
    value: (r) => cutProgress(r.ordered, r.cut).pending,
    kind: "number",
  },
  {
    header: "Sobran",
    value: (r) => cutProgress(r.ordered, r.cut).surplus,
    kind: "number",
  },
  {
    header: "Diferencia",
    // Con signo: en Excel se suma la columna y se ve el neto de la selección,
    // cosa que "faltan" y "sobran" por separado no permiten.
    value: (r) => r.cut - r.ordered,
    kind: "number",
  },
];

export async function GET(request: Request) {
  // Recorren tablas completas: sin límite, son un vector de denegación.
  await enforceRateLimit("export:orders", EXPORT_LIMIT);

  await requirePermission("inventory:browse");

  const url = new URL(request.url);
  const filters = parseCuttingOrderFilters({
    // El texto buscado también: sin él el archivo traería más órdenes de las
    // que se están viendo y dejaría de ser un respaldo de la pantalla.
    q: url.searchParams.get("q") ?? undefined,
    client: url.searchParams.get("client") ?? undefined,
    status: url.searchParams.get("status") ?? undefined,
    from: url.searchParams.get("from") ?? undefined,
    to: url.searchParams.get("to") ?? undefined,
    folder: url.searchParams.get("folder") ?? undefined,
  });

  const orders = await prisma.cuttingOrder.findMany({
    where: cuttingOrderWhere(filters),
    /* Mismo desempate que la lista: el CSV debe salir en el orden que el
       usuario acaba de ver en pantalla. */
    orderBy: [{ orderedAt: "desc" }, { createdAt: "desc" }, { id: "desc" }],
    /* El tope es de ÓRDENES, pero el archivo crece por tallas. Se pide la
       cuarta parte del tope de filas porque una orden trae del orden de cuatro
       tallas: así el archivo se acerca al límite sin pasarlo, y si lo alcanza
       la fila de aviso lo dice. */
    take: Math.floor(EXPORT_ROW_LIMIT / 4),
    include: {
      client: { select: { name: true } },
      material: { select: { code: true, name: true } },
      folder: { select: { code: true, name: true } },
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
      folder: order.folder ? `${order.folder.code} · ${order.folder.name}` : "",
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

  return xlsxResponse(toXlsxWithNotice(rows, COLUMNS, "Órdenes"), "ordenes");
}
