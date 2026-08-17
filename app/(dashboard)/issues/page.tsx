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
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Salidas" };

export default async function IssuesPage() {
  const issues = await prisma.inventoryDocument.findMany({
    // Sólo salidas: los vales de entrada tienen su propio registro y
    // mezclarlos obligaría a leer el tipo de cada renglón para saber si el
    // material entró o salió.
    where: { type: "ISSUE" },
    orderBy: { date: "desc" },
    take: 50,
    include: {
      _count: { select: { lines: true } },
      productionRun: { select: { code: true } },
    },
  });

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
    </div>
  );
}
