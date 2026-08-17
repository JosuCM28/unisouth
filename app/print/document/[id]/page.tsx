import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/core/session";
import {
  DOCUMENT_STATUS_LABELS,
  DOCUMENT_TYPE_LABELS,
  UNIT_SHORT_LABELS,
} from "@/lib/constants/labels";
import { formatDate, formatQuantity } from "@/lib/utils";
import { PrintButton } from "@/components/shared/print-button";

interface PageProps {
  params: Promise<{ id: string }>;
}

export const metadata: Metadata = { title: "Vale" };

/**
 * Vale imprimible, para firma física.
 *
 * Vive fuera de (dashboard) a propósito: sin sidebar ni barra móvil, para que
 * la hoja salga limpia. El auxiliar lo imprime, lo firma quien entrega y quien
 * recibe, y se archiva.
 */
export default async function PrintDocumentPage({ params }: PageProps) {
  await requirePermission("inventory:read");
  const { id } = await params;

  const document = await prisma.inventoryDocument.findUnique({
    where: { id },
    include: {
      createdBy: { select: { name: true } },
      appliedBy: { select: { name: true } },
      productionRun: { select: { code: true, name: true } },
      lines: {
        orderBy: { order: "asc" },
        include: {
          lot: {
            include: {
              material: { select: { code: true, name: true } },
              location: { select: { code: true } },
              client: { select: { name: true } },
            },
          },
        },
      },
    },
  });

  if (!document) notFound();

  return (
    <main className="mx-auto max-w-3xl bg-white p-8 text-black">
      <PrintButton />

      <header className="flex items-start justify-between gap-4 border-b-2 border-black pb-4">
        <div>
          <h1 className="text-xl font-bold">UNISOUTH</h1>
          <p className="text-sm">{DOCUMENT_TYPE_LABELS[document.type]}</p>
        </div>
        <div className="text-right">
          <p className="tabular text-lg font-bold">{document.code}</p>
          <p className="tabular text-sm">{formatDate(document.date)}</p>
          <p className="text-xs uppercase">
            {DOCUMENT_STATUS_LABELS[document.status]}
          </p>
        </div>
      </header>

      <dl className="grid grid-cols-2 gap-x-6 gap-y-1 border-b border-black py-3 text-sm">
        {document.concept && <Row label="Concepto" value={document.concept} />}
        {document.reference && <Row label="Referencia" value={document.reference} />}
        {document.productionRun && (
          <Row
            label="Producción"
            value={`${document.productionRun.code} · ${document.productionRun.name}`}
          />
        )}
        {document.createdBy && <Row label="Elaboró" value={document.createdBy.name} />}
      </dl>

      <table className="mt-4 w-full border-collapse text-sm">
        <thead>
          <tr className="border-b-2 border-black text-left">
            <th className="py-1 pr-2">Folio</th>
            <th className="py-1 pr-2">Material</th>
            <th className="py-1 pr-2">Tono</th>
            <th className="py-1 pr-2">Ubic.</th>
            <th className="py-1 text-right">Cantidad</th>
          </tr>
        </thead>
        <tbody>
          {document.lines.map((line) => (
            <tr key={line.id} className="border-b border-neutral-300">
              <td className="tabular py-1 pr-2">{line.lot.code}</td>
              <td className="py-1 pr-2">{line.lot.material.name}</td>
              <td className="tabular py-1 pr-2">{line.lot.shade ?? "—"}</td>
              <td className="tabular py-1 pr-2">{line.lot.location?.code ?? "—"}</td>
              <td className="tabular py-1 text-right">
                {formatQuantity(line.quantity, {
                  unit: UNIT_SHORT_LABELS[line.unit],
                })}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <p className="tabular mt-2 text-right text-sm font-bold">
        {document.lines.length}{" "}
        {document.lines.length === 1 ? "renglón" : "renglones"}
      </p>

      {document.notes && (
        <p className="mt-4 border border-neutral-400 p-2 text-sm">
          {document.notes}
        </p>
      )}

      {/* Las firmas son el punto de todo esto: el vale existe para que quede
          constancia en papel de quién entregó y quién recibió. */}
      <div className="mt-16 grid grid-cols-2 gap-8 text-center text-sm">
        <Signature label="Entrega" name={document.handedOverBy} />
        <Signature label="Recibe" name={document.receivedBy} />
      </div>
    </main>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2">
      <dt className="font-medium">{label}:</dt>
      <dd>{value}</dd>
    </div>
  );
}

function Signature({ label, name }: { label: string; name: string | null }) {
  return (
    <div>
      <div className="border-b border-black" />
      <p className="mt-1 font-medium">{label}</p>
      {name && <p className="text-xs">{name}</p>}
    </div>
  );
}
