import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/core/session";
import { EXPORT_ROW_LIMIT } from "@/lib/export/limits";
import {
  DOCUMENT_STATUS_LABELS,
  DOCUMENT_TYPE_LABELS,
} from "@/lib/constants/labels";
import { formatDate } from "@/lib/utils";
import { PrintSheet, PrintTable } from "@/components/shared/print-sheet";

export const metadata: Metadata = { title: "Documentos impresos" };

/** El registro de vales, en papel o PDF. La contraparte del Excel. */
export default async function PrintDocumentsPage() {
  await requirePermission("inventory:browse");

  const documents = await prisma.inventoryDocument.findMany({
    // Mismo orden que la lista: la hoja sale como se ve en pantalla.
    orderBy: [{ date: "desc" }, { createdAt: "desc" }, { id: "desc" }],
    take: EXPORT_ROW_LIMIT,
    include: {
      client: { select: { name: true } },
      _count: { select: { lines: true, cutLines: true } },
    },
  });

  const rows = documents.map((document) => [
    document.code,
    DOCUMENT_TYPE_LABELS[document.type],
    DOCUMENT_STATUS_LABELS[document.status],
    formatDate(document.date),
    document.client?.name ?? "Fábrica",
    document.concept ?? "—",
    document.receivedBy ?? "—",
    document._count.lines,
    document._count.cutLines,
  ]);

  return (
    <PrintSheet
      title="Documentos"
      criteria={["registro completo"]}
      count={`${documents.length} ${documents.length === 1 ? "vale" : "vales"}`}
    >
      <PrintTable
        head={[
          "Folio",
          "Tipo",
          "Estado",
          "Fecha",
          "Cliente",
          "Concepto",
          "Recibió",
          "Renglones",
          "Tallas",
        ]}
        rows={rows}
        numeric={[7, 8]}
        empty="Todavía no hay documentos."
      />
    </PrintSheet>
  );
}
