import type { Metadata } from "next";
import Link from "next/link";
import { FileText } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { DOCUMENT_STATUS_LABELS, DOCUMENT_STATUS_STYLES, DOCUMENT_TYPE_LABELS } from "@/lib/constants/labels";
import { cn, formatDate } from "@/lib/utils";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/shared/empty-state";

export const metadata: Metadata = { title: "Documentos" };

export default async function DocumentsPage() {
  const documents = await prisma.inventoryDocument.findMany({
    orderBy: { date: "desc" },
    take: 50,
    include: { _count: { select: { lines: true } } },
  });

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="Documentos" description="Vales de entrada y salida" />

      {documents.length === 0 ? (
        <div className="flat-surface">
          <EmptyState icon={FileText} title="Aún no hay documentos"
            description="Los vales de entrada y salida aparecerán aquí." />
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {documents.map((document) => (
            <li key={document.id}>
              <Link href={`/documents/${document.id}`}
                className="flat-surface flex items-start justify-between gap-3 p-3 transition-colors active:bg-accent">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="tabular text-sm font-medium">{document.code}</span>
                    <span className={cn("rounded px-1.5 py-0.5 text-xs", DOCUMENT_STATUS_STYLES[document.status])}>
                      {DOCUMENT_STATUS_LABELS[document.status]}
                    </span>
                  </div>
                  <p className="text-sm">{DOCUMENT_TYPE_LABELS[document.type]}</p>
                  <p className="tabular text-xs text-muted-foreground">
                    {formatDate(document.date)} · {document._count.lines}{" "}
                    {document._count.lines === 1 ? "renglón" : "renglones"}
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
