import type { Metadata } from "next";
import Link from "next/link";
import { ShoppingCart } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { PURCHASE_STATUS_LABELS, PURCHASE_STATUS_STYLES } from "@/lib/constants/labels";
import { cn, formatDate } from "@/lib/utils";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/shared/empty-state";

export const metadata: Metadata = { title: "Requisiciones" };

export default async function PurchaseRequestsPage() {
  const requests = await prisma.purchaseRequest.findMany({
    orderBy: { requestedAt: "desc" },
    take: 50,
    include: {
      requestedBy: { select: { name: true } },
      _count: { select: { lines: true } },
    },
  });

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
    </div>
  );
}
