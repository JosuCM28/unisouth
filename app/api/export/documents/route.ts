import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/core/session";
import { enforceRateLimit, EXPORT_LIMIT } from "@/lib/core/rate-limit";
import {
  toXlsxWithNotice,
  xlsxResponse,
  type XlsxColumn,
} from "@/lib/export/xlsx";
import { EXPORT_ROW_LIMIT } from "@/lib/export/limits";
import {
  DOCUMENT_STATUS_LABELS,
  DOCUMENT_TYPE_LABELS,
} from "@/lib/constants/labels";
import type { DocumentStatus, DocumentType } from "@prisma/client";

interface Row {
  code: string;
  type: DocumentType;
  status: DocumentStatus;
  date: Date;
  client: string;
  productionRun: string;
  concept: string;
  reference: string;
  handedOverBy: string;
  receivedBy: string;
  lines: number;
  cutLines: number;
  appliedAt: Date | null;
  createdBy: string;
}

const COLUMNS: XlsxColumn<Row>[] = [
  { header: "Folio", value: (r) => r.code, width: 16 },
  { header: "Tipo", value: (r) => DOCUMENT_TYPE_LABELS[r.type], width: 18 },
  { header: "Estado", value: (r) => DOCUMENT_STATUS_LABELS[r.status] },
  { header: "Fecha", value: (r) => r.date, kind: "date" },
  { header: "Cliente", value: (r) => r.client, width: 22 },
  { header: "Producción", value: (r) => r.productionRun },
  { header: "Concepto", value: (r) => r.concept, width: 28 },
  { header: "Referencia", value: (r) => r.reference },
  { header: "Entregó", value: (r) => r.handedOverBy, width: 20 },
  { header: "Recibió", value: (r) => r.receivedBy, width: 20 },
  { header: "Renglones", value: (r) => r.lines, kind: "number" },
  { header: "Tallas", value: (r) => r.cutLines, kind: "number" },
  { header: "Aplicado", value: (r) => r.appliedAt, kind: "date" },
  { header: "Capturó", value: (r) => r.createdBy, width: 20 },
];

export async function GET() {
  // Recorren tablas completas: sin límite, son un vector de denegación.
  await enforceRateLimit("export:documents", EXPORT_LIMIT);

  await requirePermission("inventory:browse");

  const documents = await prisma.inventoryDocument.findMany({
    // Mismo orden que la lista: el archivo sale como se ve en pantalla.
    orderBy: [{ date: "desc" }, { createdAt: "desc" }, { id: "desc" }],
    take: EXPORT_ROW_LIMIT,
    include: {
      client: { select: { name: true } },
      productionRun: { select: { code: true } },
      createdBy: { select: { name: true } },
      _count: { select: { lines: true, cutLines: true } },
    },
  });

  const rows: Row[] = documents.map((document) => ({
    code: document.code,
    type: document.type,
    status: document.status,
    date: document.date,
    client: document.client?.name ?? "Fábrica",
    productionRun: document.productionRun?.code ?? "",
    concept: document.concept ?? "",
    reference: document.reference ?? "",
    handedOverBy: document.handedOverBy ?? "",
    receivedBy: document.receivedBy ?? "",
    lines: document._count.lines,
    cutLines: document._count.cutLines,
    appliedAt: document.appliedAt,
    createdBy: document.createdBy?.name ?? "",
  }));

  return xlsxResponse(
    toXlsxWithNotice(rows, COLUMNS, "Documentos"),
    "documentos",
  );
}
