import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/core/session";
import { roleHasPermission } from "@/lib/constants/roles";
import {
  PURCHASE_STATUS_LABELS, PURCHASE_STATUS_STYLES, UNIT_SHORT_LABELS,
} from "@/lib/constants/labels";
import { cn, formatDate, formatDateTime, formatQuantity } from "@/lib/utils";
import { PageHeader } from "@/components/layout/page-header";
import { PurchaseActions } from "@/components/purchase-requests/purchase-actions";

interface PageProps { params: Promise<{ id: string }> }

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const pr = await prisma.purchaseRequest.findUnique({ where: { id }, select: { code: true } });
  return { title: pr?.code ?? "Requisición" };
}

export default async function PurchaseRequestPage({ params }: PageProps) {
  const { id } = await params;
  const user = await requireUser();

  const request = await prisma.purchaseRequest.findUnique({
    where: { id },
    include: {
      requestedBy: { select: { name: true } },
      approvedBy: { select: { name: true } },
      calculation: { select: { code: true } },
      lines: {
        orderBy: { order: "asc" },
        include: { material: { select: { code: true, name: true } } },
      },
    },
  });

  if (!request) notFound();

  return (
    <div className="flex flex-col gap-4">
      <Link href="/purchase-requests" className="touch-target flex w-fit items-center gap-1.5 text-sm text-muted-foreground">
        <ArrowLeft className="size-4" aria-hidden />Requisiciones
      </Link>

      <PageHeader
        title={request.code}
        description={`Levantada ${formatDate(request.requestedAt)}${request.requestedBy ? ` por ${request.requestedBy.name}` : ""}`}
      />

      <div className="flex flex-wrap items-center gap-2">
        <span className={cn("rounded px-2 py-1 text-sm", PURCHASE_STATUS_STYLES[request.status])}>
          {PURCHASE_STATUS_LABELS[request.status]}
        </span>
        {request.calculation && (
          <span className="tabular text-xs text-muted-foreground">
            del cálculo {request.calculation.code}
          </span>
        )}
        {request.approvedAt && request.approvedBy && (
          <span className="text-xs text-muted-foreground">
            Autorizada {formatDateTime(request.approvedAt)} por {request.approvedBy.name}
          </span>
        )}
      </div>

      {request.status === "REJECTED" && request.rejectionReason && (
        <div className="border border-state-defective bg-state-defective-muted p-3">
          <p className="text-sm font-medium">Rechazada</p>
          <p className="text-sm">{request.rejectionReason}</p>
        </div>
      )}

      <PurchaseActions
        id={request.id} code={request.code} status={request.status}
        canApprove={roleHasPermission(user.role, "purchase:approve")}
      />

      <section className="flat-surface p-4">
        <h2 className="mb-3 text-sm font-semibold">Materiales</h2>
        <ul className="divide-y divide-border">
          {request.lines.map((line) => (
            <li key={line.id} className="flex items-center justify-between gap-3 py-2">
              <div className="min-w-0">
                <p className="truncate text-sm">{line.material.name}</p>
                <p className="tabular text-xs text-muted-foreground">{line.material.code}</p>
              </div>
              <span className="tabular shrink-0 text-sm font-medium">
                {formatQuantity(line.requestedQuantity, { unit: UNIT_SHORT_LABELS[line.unit] })}
              </span>
            </li>
          ))}
        </ul>
      </section>

      {request.justification && (
        <section className="flat-surface p-4">
          <h2 className="mb-1 text-sm font-semibold">Justificación</h2>
          <p className="text-sm text-muted-foreground">{request.justification}</p>
        </section>
      )}
    </div>
  );
}
