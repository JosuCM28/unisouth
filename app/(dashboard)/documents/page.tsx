import type { Metadata } from "next";
import Link from "next/link";
import { FileText } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { DOCUMENT_STATUS_LABELS, DOCUMENT_STATUS_STYLES, DOCUMENT_TYPE_LABELS } from "@/lib/constants/labels";
import { cn, formatDate } from "@/lib/utils";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Pager } from "@/components/shared/pager";

export const metadata: Metadata = { title: "Documentos" };

const PAGE_SIZE = 50;

interface PageProps {
  searchParams: Promise<{ page?: string; all?: string }>;
}

export default async function DocumentsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const page = parsePositiveInt(params.page) ?? 1;
  /* "Cargar más" del celular: trae desde la primera fila hasta el final de
     esta página, porque cada toque es una navegación y lo ya mostrado no
     sobrevive en estado del cliente. Se topa para no bajar la tabla entera. */
  const accumulate = params.all === "1";
  const skip = accumulate ? 0 : (page - 1) * PAGE_SIZE;
  const take = accumulate ? Math.min(page * PAGE_SIZE, 300) : PAGE_SIZE;

  /* Se cuenta y se trae en paralelo: sin el total no hay forma de saber
     cuántas páginas hay, y sin páginas los vales viejos quedan inalcanzables
     conforme se acumulan. */
  const [total, documents] = await Promise.all([
    prisma.inventoryDocument.count(),
    prisma.inventoryDocument.findMany({
      // El id desempata: `date` no es único y sin criterio estable las filas
      // se barajan entre páginas, duplicando unas y escondiendo otras.
      /* Desempate por `createdAt` y no por `id`: la fecha se ancla al inicio
         del día, así que todo lo capturado hoy queda empatado, y `cuid()` no
         es cronológico. Sin esto lo más viejo del día sale hasta arriba. */
      orderBy: [{ date: "desc" }, { createdAt: "desc" }, { id: "desc" }],
      skip,
      take,
      include: { _count: { select: { lines: true } } },
    }),
  ]);

  const totalPages = Math.ceil(total / PAGE_SIZE) || 1;

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

      <Pager
        page={page}
        totalPages={totalPages}
        total={total}
        itemLabel={{ one: "documento", many: "documentos" }}
        basePath="/documents"
        params={params}
      />
    </div>
  );
}

/** Entero positivo o nada. Cualquier basura en la URL se ignora. */
function parsePositiveInt(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) return undefined;
  return parsed;
}
