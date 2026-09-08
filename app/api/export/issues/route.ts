import type { DocumentStatus, Unit } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/core/session";
import { enforceRateLimit, EXPORT_LIMIT } from "@/lib/core/rate-limit";
import {
  toXlsxWithNotice,
  xlsxResponse,
  type XlsxColumn,
} from "@/lib/export/xlsx";
import { EXPORT_ROW_LIMIT } from "@/lib/export/limits";
import { DOCUMENT_STATUS_LABELS, UNIT_SHORT_LABELS } from "@/lib/constants/labels";
import { getIssueSummaries } from "@/lib/issue-summary";
import { issueWhere, parseIssueFilters } from "@/lib/repositories/issue-filters";

/**
 * Una fila por VALE, igual que la tabla de la pantalla.
 *
 * No se abre por renglón —como sí hace el Excel de órdenes— porque la pregunta
 * que se le hace a este archivo es de vale completo: "¿cuánto se llevó Ternium
 * este mes?", "¿qué anda en el taller?". El detalle rollo por rollo vive en el
 * kárdex de /movements, que ya se exporta aparte.
 */
interface Row {
  code: string;
  status: DocumentStatus;
  date: Date;
  concept: string;
  material: string;
  client: string;
  handedOverBy: string;
  receivedBy: string;
  shipmentCode: string;
  workshop: string;
  stage: string;
  reference: string;
  quantity: number | null;
  unit: Unit | null;
  lots: number;
  pieces: number;
  appliedAt: Date | null;
  createdBy: string;
}

const COLUMNS: XlsxColumn<Row>[] = [
  { header: "Folio", value: (r) => r.code, width: 16 },
  { header: "Estado", value: (r) => DOCUMENT_STATUS_LABELS[r.status] },
  { header: "Fecha", value: (r) => r.date, kind: "date" },
  { header: "Concepto", value: (r) => r.concept, width: 28 },
  { header: "Tela", value: (r) => r.material, width: 28 },
  { header: "Cliente", value: (r) => r.client, width: 22 },
  { header: "Entregó", value: (r) => r.handedOverBy, width: 20 },
  { header: "Recibió", value: (r) => r.receivedBy, width: 20 },
  /* El envío se abre en tres columnas y no en una celda de dos renglones como
     en pantalla: aquí se va a filtrar por taller y a agrupar por etapa, y un
     "BORDADO · SITEX" pegado obliga a partirlo a mano antes de poder hacerlo. */
  { header: "Envío", value: (r) => r.shipmentCode, width: 16 },
  { header: "Taller", value: (r) => r.workshop, width: 22 },
  { header: "Etapa", value: (r) => r.stage, width: 18 },
  { header: "Referencia", value: (r) => r.reference },
  /* Cantidad y unidad en columnas separadas: pegadas ("120.5 m") la columna
     deja de sumarse, que es lo primero que se hace con ella. Un vale sin
     rollos —al taller salen prendas ya cortadas— va con la celda VACÍA y no
     con un cero: no se llevó cero metros, se llevó prendas. */
  { header: "Cantidad", value: (r) => r.quantity, kind: "number" },
  { header: "Unidad", value: (r) => (r.unit ? UNIT_SHORT_LABELS[r.unit] : "") },
  { header: "Rollos", value: (r) => r.lots, kind: "number" },
  { header: "Prendas", value: (r) => r.pieces, kind: "number" },
  { header: "Aplicado", value: (r) => r.appliedAt, kind: "date" },
  { header: "Capturó", value: (r) => r.createdBy, width: 20 },
];

export async function GET(request: Request) {
  // Recorren tablas completas: sin límite, son un vector de denegación.
  await enforceRateLimit("export:issues", EXPORT_LIMIT);

  await requirePermission("inventory:browse");

  const url = new URL(request.url);
  /* El MISMO parser que la lista, no una copia: si el archivo interpretara
     los parámetros a su modo, traería más salidas de las que se están viendo
     y dejaría de ser un respaldo de la pantalla. */
  const filters = parseIssueFilters({
    q: url.searchParams.get("q") ?? undefined,
    status: url.searchParams.get("status") ?? undefined,
    origin: url.searchParams.get("origin") ?? undefined,
  });

  const issues = await prisma.inventoryDocument.findMany({
    where: issueWhere(filters),
    // Mismo desempate que la lista: el archivo sale como se ve en pantalla.
    orderBy: [{ date: "desc" }, { createdAt: "desc" }, { id: "desc" }],
    take: EXPORT_ROW_LIMIT,
    include: {
      client: { select: { name: true } },
      cutFabric: { select: { name: true } },
      createdBy: { select: { name: true } },
      shipments: {
        take: 1,
        select: {
          code: true,
          workshop: { select: { name: true } },
          stage: { select: { name: true } },
        },
      },
    },
  });

  /* El resumen va en consultas agrupadas sobre todo el lote, igual que en la
     lista: son dos viajes a Neon sin importar cuántos vales se exporten. */
  const summaries = await getIssueSummaries(issues.map((issue) => issue.id));

  const rows: Row[] = issues.map((issue) => {
    const summary = summaries.get(issue.id);
    const shipment = issue.shipments[0];

    return {
      code: issue.code,
      status: issue.status,
      date: issue.date,
      concept: issue.concept ?? issue.cutDescription ?? "",
      material: materialOf(summary?.materialNames ?? [], issue.cutFabric?.name),
      client: issue.client?.name ?? "Fábrica",
      handedOverBy: issue.handedOverBy ?? "",
      receivedBy: issue.receivedBy ?? "",
      shipmentCode: shipment?.code ?? "",
      workshop: shipment?.workshop.name ?? "",
      stage: shipment?.stage.name ?? "",
      reference: issue.reference ?? "",
      quantity: summary?.totalQuantity || null,
      unit: summary?.unit ?? null,
      lots: summary?.lots ?? 0,
      pieces: summary?.cutPieces ?? 0,
      appliedAt: issue.appliedAt,
      createdBy: issue.createdBy?.name ?? "",
    };
  });

  return xlsxResponse(toXlsxWithNotice(rows, COLUMNS, "Salidas"), "salidas");
}

/**
 * La tela del vale, con la misma regla que la tabla: manda la de los rollos y,
 * si no llevó rollos, vale la del desglose de corte.
 */
function materialOf(materialNames: string[], cutFabricName?: string): string {
  if (materialNames.length > 0) return materialNames.join(" · ");

  return cutFabricName ?? "";
}
