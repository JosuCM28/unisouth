import type { Metadata } from "next";
import Link from "next/link";
import { ShoppingCart } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/core/session";
import { PURCHASE_STATUS_LABELS, PURCHASE_STATUS_STYLES } from "@/lib/constants/labels";
import { cn, formatDate } from "@/lib/utils";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Pager } from "@/components/shared/pager";

export const metadata: Metadata = { title: "Requisiciones" };

const PAGE_SIZE = 50;

interface PageProps {
  searchParams: Promise<{ page?: string; all?: string }>;
}

export default async function PurchaseRequestsPage({ searchParams }: PageProps) {
  await requirePermission("purchase:request");

  const params = await searchParams;
  const page = parsePositiveInt(params.page) ?? 1;
  /* "Cargar más" del celular: trae desde la primera fila hasta el final de
     esta página, porque cada toque es una navegación y lo ya mostrado no
     sobrevive en estado del cliente. Se topa para no bajar la tabla entera. */
  const accumulate = params.all === "1";
  const skip = accumulate ? 0 : (page - 1) * PAGE_SIZE;
  const take = accumulate ? Math.min(page * PAGE_SIZE, 300) : PAGE_SIZE;

  const [total, requests] = await Promise.all([
    prisma.purchaseRequest.count(),
    prisma.purchaseRequest.findMany({
      // El id desempata: `requestedAt` no es único y sin criterio estable las
      // filas se barajan entre páginas.
      /* Desempate por `createdAt` y no por `id`: la fecha se ancla al inicio
         del día, así que todo lo capturado hoy queda empatado, y `cuid()` no
         es cronológico. Sin esto lo más viejo del día sale hasta arriba. */
      orderBy: [{ requestedAt: "desc" }, { createdAt: "desc" }, { id: "desc" }],
      skip,
      take,
      include: {
        requestedBy: { select: { name: true } },
        _count: { select: { lines: true } },
      },
    }),
  ]);

  const totalPages = Math.ceil(total / PAGE_SIZE) || 1;

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="Requisiciones" description="Lo que hay que comprar" />

      {requests.length === 0 ? (
        <div className="flat-surface">
          <EmptyState icon={ShoppingCart} title="Aún no hay requisiciones"
            description="Se generan desde un cálculo con faltantes o a mano." />
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {requests.map((request) => (
            <li key={request.id}>
              <Link href={`/purchase-requests/${request.id}`}
                className="flat-surface flex items-start justify-between gap-3 p-3 transition-colors active:bg-accent">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="tabular text-sm font-medium">{request.code}</span>
                    <span className={cn("rounded px-1.5 py-0.5 text-xs", PURCHASE_STATUS_STYLES[request.status])}>
                      {PURCHASE_STATUS_LABELS[request.status]}
                    </span>
                  </div>
                  <p className="tabular text-xs text-muted-foreground">
                    {formatDate(request.requestedAt)} · {request._count.lines}{" "}
                    {request._count.lines === 1 ? "material" : "materiales"}
                    {request.requestedBy && ` · ${request.requestedBy.name}`}
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
        itemLabel={{ one: "requisición", many: "requisiciones" }}
        basePath="/purchase-requests"
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
