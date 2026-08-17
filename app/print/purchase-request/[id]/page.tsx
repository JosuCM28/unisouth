import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/core/session";
import { PURCHASE_STATUS_LABELS, UNIT_SHORT_LABELS } from "@/lib/constants/labels";
import { formatDate, formatQuantity } from "@/lib/utils";
import { PrintButton } from "@/components/shared/print-button";

interface PageProps { params: Promise<{ id: string }> }

export const metadata: Metadata = { title: "Requisición" };

export default async function PrintPurchaseRequestPage({ params }: PageProps) {
  // Cualquiera que pueda levantar o autorizar una requisición puede imprimirla.
  await requirePermission("purchase:request");
  const { id } = await params;

  const request = await prisma.purchaseRequest.findUnique({
    where: { id },
    include: {
      requestedBy: { select: { name: true } },
      approvedBy: { select: { name: true } },
      lines: { orderBy: { order: "asc" }, include: { material: { select: { code: true, name: true } } } },
    },
  });

  if (!request) notFound();

  return (
    <main className="mx-auto max-w-3xl bg-white p-8 text-black">
      <PrintButton />

      <header className="flex items-start justify-between gap-4 border-b-2 border-black pb-4">
        <div>
          <h1 className="text-xl font-bold">UNISOUTH</h1>
          <p className="text-sm">Requisición de compra</p>
        </div>
        <div className="text-right">
          <p className="tabular text-lg font-bold">{request.code}</p>
          <p className="tabular text-sm">{formatDate(request.requestedAt)}</p>
          <p className="text-xs uppercase">{PURCHASE_STATUS_LABELS[request.status]}</p>
        </div>
      </header>

      <dl className="grid grid-cols-2 gap-x-6 gap-y-1 border-b border-black py-3 text-sm">
        {request.requestedBy && (
          <div className="flex gap-2"><dt className="font-medium">Solicita:</dt><dd>{request.requestedBy.name}</dd></div>
        )}
        {request.neededBy && (
          <div className="flex gap-2"><dt className="font-medium">Se necesita:</dt><dd className="tabular">{formatDate(request.neededBy)}</dd></div>
        )}
      </dl>

      <table className="mt-4 w-full border-collapse text-sm">
        <thead>
          <tr className="border-b-2 border-black text-left">
            <th className="py-1 pr-2">Código</th>
            <th className="py-1 pr-2">Material</th>
            <th className="py-1 text-right">Cantidad</th>
          </tr>
        </thead>
        <tbody>
          {request.lines.map((line) => (
            <tr key={line.id} className="border-b border-neutral-300">
              <td className="tabular py-1 pr-2">{line.material.code}</td>
              <td className="py-1 pr-2">{line.material.name}</td>
              <td className="tabular py-1 text-right">
                {formatQuantity(line.requestedQuantity, { unit: UNIT_SHORT_LABELS[line.unit] })}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {request.justification && (
        <p className="mt-4 border border-neutral-400 p-2 text-sm">{request.justification}</p>
      )}

      <div className="mt-16 grid grid-cols-2 gap-8 text-center text-sm">
        <div>
          <div className="border-b border-black" />
          <p className="mt-1 font-medium">Solicita</p>
          {request.requestedBy && <p className="text-xs">{request.requestedBy.name}</p>}
        </div>
        <div>
          <div className="border-b border-black" />
          <p className="mt-1 font-medium">Autoriza</p>
          {request.approvedBy && <p className="text-xs">{request.approvedBy.name}</p>}
        </div>
      </div>
    </main>
  );
}
