import type { Metadata } from "next";
import Link from "next/link";
import { PackageMinus, Plus } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getIssueSummaries } from "@/lib/issue-summary";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Pager } from "@/components/shared/pager";
import { Button } from "@/components/ui/button";
import { IssueCard } from "@/components/issues/issue-card";

export const metadata: Metadata = { title: "Salidas" };

const PAGE_SIZE = 50;

/** Un vale sin renglones ni cortes: la tarjeta lo avisa en vez de reventar. */
const EMPTY_SUMMARY = {
  totalQuantity: 0,
  unit: null,
  materialNames: [],
  lots: 0,
  cutPieces: 0,
};

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
        client: { select: { name: true } },
        cutFabric: { select: { name: true } },
      },
    }),
  ]);

  /* El resumen va en una segunda consulta agrupada sobre la página completa:
     traerlo con un `include` por vale haría que Prisma bajara todos los
     renglones de las 50 salidas sólo para sumarlos aquí. */
  const summaries = await getIssueSummaries(issues.map((issue) => issue.id));

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
              <IssueCard
                issue={{
                  id: issue.id,
                  code: issue.code,
                  status: issue.status,
                  date: issue.date,
                  concept: issue.concept,
                  reference: issue.reference,
                  clientName: issue.client?.name ?? null,
                  cutFabricName: issue.cutFabric?.name ?? null,
                  cutDescription: issue.cutDescription,
                  summary: summaries.get(issue.id) ?? EMPTY_SUMMARY,
                }}
              />
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
