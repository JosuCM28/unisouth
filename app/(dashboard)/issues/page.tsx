import type { Metadata } from "next";
import Link from "next/link";
import { PackageMinus, Plus } from "lucide-react";
import { prisma } from "@/lib/prisma";
import {
  DOCUMENT_STATUS_LABELS,
  DOCUMENT_STATUS_STYLES,
} from "@/lib/constants/labels";
import { cn, formatDate } from "@/lib/utils";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Pager } from "@/components/shared/pager";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Salidas" };

const PAGE_SIZE = 50;

interface PageProps {
  searchParams: Promise<{ page?: string; all?: string }>;
}

export default async function IssuesPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const page = parsePositiveInt(params.page) ?? 1;
  /* "Cargar más" del celular: trae desde la primera fila hasta el final de
     esta página, porque cada toque es una navegación y lo ya mostrado no
     sobrevive en estado del cliente. Se topa para no bajar la tabla entera. */
  const accumulate = params.all === "1";
  const skip = accumulate ? 0 : (page - 1) * PAGE_SIZE;
  const take = accumulate ? Math.min(page * PAGE_SIZE, 300) : PAGE_SIZE;

  // Sólo salidas: los vales de entrada tienen su propio registro y mezclarlos
  // obligaría a leer el tipo de cada renglón para saber si el material entró
  // o salió.
  const where = { type: "ISSUE" as const };

  const [total, issues] = await Promise.all([
    prisma.inventoryDocument.count({ where }),
    prisma.inventoryDocument.findMany({
      where,
      // El id desempata: `date` no es único y sin criterio estable las filas
      // se barajan entre páginas.
      orderBy: [{ date: "desc" }, { id: "asc" }],
      skip,
      take,
      include: {
        _count: { select: { lines: true } },
        productionRun: { select: { code: true } },
      },
    }),
  ]);

  const totalPages = Math.ceil(total / PAGE_SIZE) || 1;

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Salidas"
        description="Material que se entregó a producción"
        action={
          <Button asChild className="touch-target">
            <Link href="/issues/new">
              <Plus className="size-4" aria-hidden />
              Nueva
            </Link>
          </Button>
        }
      />

      {issues.length === 0 ? (
        <div className="flat-surface">
          <EmptyState
            icon={PackageMinus}
            title="Aún no hay salidas"
            description="Registra la primera cuando producción se lleve material."
          />
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {issues.map((issue) => (
            <li key={issue.id}>
              <Link
                href={`/documents/${issue.id}`}
                className="flat-surface flex items-start justify-between gap-3 p-3 transition-colors active:bg-accent"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="tabular text-sm font-medium">
                      {issue.code}
                    </span>
                    <span
                      className={cn(
                        "rounded px-1.5 py-0.5 text-xs",
                        DOCUMENT_STATUS_STYLES[issue.status],
                      )}
                    >
                      {DOCUMENT_STATUS_LABELS[issue.status]}
                    </span>
                  </div>

                  {issue.concept && (
                    <p className="truncate text-sm">{issue.concept}</p>
                  )}

                  <p className="tabular text-xs text-muted-foreground">
                    {formatDate(issue.date)} · {issue._count.lines}{" "}
                    {issue._count.lines === 1 ? "rollo" : "rollos"}
                    {issue.productionRun && ` · ${issue.productionRun.code}`}
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
        itemLabel={{ one: "salida", many: "salidas" }}
        basePath="/issues"
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
