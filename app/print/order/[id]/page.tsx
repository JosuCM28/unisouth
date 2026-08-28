import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/core/session";
import {
  CUT_VERSION_LABELS,
  CUTTING_ORDER_STATUS_LABELS,
} from "@/lib/constants/labels";
import { cutProgress, formatDate, formatDateTime } from "@/lib/utils";
import { PrintButton } from "@/components/shared/print-button";

interface PageProps {
  params: Promise<{ id: string }>;
}

export const metadata: Metadata = { title: "Orden de corte" };

/**
 * Hoja de una orden para archivar o firmar en el taller.
 *
 * Lleva el historial completo y no sólo el acumulado: la hoja se guarda, y
 * meses después la pregunta no es "cuántas se cortaron" sino "quién cortó
 * estas y cuándo", que un total no puede responder.
 */
export default async function PrintOrderPage({ params }: PageProps) {
  await requirePermission("inventory:browse");
  const { id } = await params;

  const order = await prisma.cuttingOrder.findUnique({
    where: { id },
    include: {
      client: { select: { name: true } },
      material: { select: { code: true, name: true } },
      productionRun: { select: { code: true, name: true } },
      createdBy: { select: { name: true } },
      lines: {
        orderBy: { position: "asc" },
        include: {
          size: { select: { code: true, name: true } },
          cutTag: { select: { name: true } },
          progress: {
            orderBy: { createdAt: "asc" },
            include: { user: { select: { name: true } } },
          },
        },
      },
    },
  });

  if (!order) notFound();

  const ordered = order.lines.reduce((sum, l) => sum + l.orderedQuantity, 0);
  const cut = order.lines.reduce((sum, l) => sum + l.cutQuantity, 0);
  const { pending, surplus } = cutProgress(ordered, cut);

  const history = order.lines
    .flatMap((line) =>
      line.progress.map((entry) => ({ ...entry, sizeCode: line.size.code })),
    )
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

  return (
    <main className="mx-auto max-w-3xl bg-white p-8 text-black">
      <PrintButton />

      <header className="flex items-start justify-between gap-4 border-b-2 border-black pb-4">
        <div>
          <h1 className="text-xl font-bold">UNISOUTH</h1>
          <p className="text-sm">Orden de corte</p>
        </div>
        <div className="text-right">
          <p className="tabular text-lg font-bold">{order.code}</p>
          <p className="tabular text-sm">{formatDate(order.orderedAt)}</p>
          <p className="text-xs uppercase">
            {CUTTING_ORDER_STATUS_LABELS[order.status]}
          </p>
        </div>
      </header>

      <dl className="grid grid-cols-2 gap-x-6 gap-y-1 border-b border-black py-3 text-sm">
        <Field label="Cliente" value={order.client?.name ?? "Fábrica"} />
        <Field label="Descripción" value={order.description} />
        <Field label="Orden del cliente" value={order.reference} />
        <Field
          label="Entrega"
          value={order.dueDate ? formatDate(order.dueDate) : null}
        />
        <Field
          label="Material"
          value={
            order.material
              ? `${order.material.code} · ${order.material.name}`
              : null
          }
        />
        <Field
          label="Producción"
          value={
            order.productionRun
              ? `${order.productionRun.code} · ${order.productionRun.name ?? ""}`
              : null
          }
        />
        <Field label="Capturó" value={order.createdBy?.name} />
        {/* El encabezado del corte va en la MISMA rejilla y no en un bloque
            aparte: en la hoja impresa el taller lee molde y versión junto a la
            tela, no en otra parte de la página. */}
        <Field label="Tela (a mano)" value={order.cutFabricText} />
        <Field label="Molde" value={order.cutPattern} />
        <Field
          label="Versión"
          value={order.cutVersion ? CUT_VERSION_LABELS[order.cutVersion] : null}
        />
        <Field label="Cambios de la versión" value={order.cutVersionNotes} />
      </dl>

      {/* Numeradas, para irlas palomeando en el taller. */}
      {order.cutNotes.length > 0 && (
        <section className="border-b border-black py-3 text-sm">
          <p className="font-semibold">Notas del corte</p>
          <ol className="mt-1 flex flex-col gap-0.5">
            {order.cutNotes.map((note, index) => (
              <li key={index} className="flex gap-2">
                <span className="tabular shrink-0">{index + 1}.</span>
                <span>{note}</span>
              </li>
            ))}
          </ol>
        </section>
      )}

      <table className="mt-4 w-full border-collapse text-sm">
        <thead>
          <tr className="border-b-2 border-black text-left">
            <th className="py-1 pr-2">Talla</th>
            <th className="py-1 pr-2">Foleo</th>
            <th className="py-1 pr-2 text-right">Pedidas</th>
            <th className="py-1 pr-2 text-right">Cortadas</th>
            <th className="py-1 pr-2 text-right">Faltan</th>
            <th className="py-1 text-right">Sobran</th>
          </tr>
        </thead>
        <tbody>
          {order.lines.map((line) => {
            const progress = cutProgress(
              line.orderedQuantity,
              line.cutQuantity,
            );

            return (
              <tr key={line.id} className="border-b border-black/30">
                <td className="py-1 pr-2 font-medium">{line.size.code}</td>
                <td className="py-1 pr-2">{line.cutTag?.name ?? ""}</td>
                <td className="tabular py-1 pr-2 text-right">
                  {line.orderedQuantity}
                </td>
                <td className="tabular py-1 pr-2 text-right">
                  {line.cutQuantity}
                </td>
                <td className="tabular py-1 pr-2 text-right">
                  {progress.pending > 0 ? progress.pending : ""}
                </td>
                <td className="tabular py-1 text-right font-medium">
                  {progress.surplus > 0 ? `+${progress.surplus}` : ""}
                </td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-black font-bold">
            <td className="py-1 pr-2" colSpan={2}>
              Total
            </td>
            <td className="tabular py-1 pr-2 text-right">{ordered}</td>
            <td className="tabular py-1 pr-2 text-right">{cut}</td>
            <td className="tabular py-1 pr-2 text-right">
              {pending > 0 ? pending : ""}
            </td>
            <td className="tabular py-1 text-right">
              {surplus > 0 ? `+${surplus}` : ""}
            </td>
          </tr>
        </tfoot>
      </table>

      {history.length > 0 && (
        <section className="mt-6">
          <h2 className="mb-1 border-b border-black pb-1 text-sm font-bold">
            Historial de cortes
          </h2>
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr className="border-b border-black text-left">
                <th className="py-1 pr-2">Fecha</th>
                <th className="py-1 pr-2">Talla</th>
                <th className="py-1 pr-2 text-right">Piezas</th>
                <th className="py-1 pr-2">Quién</th>
                <th className="py-1">Notas</th>
              </tr>
            </thead>
            <tbody>
              {history.map((entry) => (
                <tr key={entry.id} className="border-b border-black/20">
                  <td className="tabular py-1 pr-2">
                    {formatDateTime(entry.createdAt)}
                  </td>
                  <td className="py-1 pr-2">{entry.sizeCode}</td>
                  <td className="tabular py-1 pr-2 text-right">
                    {entry.quantity > 0 ? "+" : ""}
                    {entry.quantity}
                  </td>
                  <td className="py-1 pr-2">{entry.user?.name ?? ""}</td>
                  <td className="py-1">{entry.notes ?? ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {order.notes && (
        <p className="mt-4 whitespace-pre-wrap border-t border-black pt-2 text-sm">
          {order.notes}
        </p>
      )}

      <div className="mt-12 grid grid-cols-2 gap-8 text-sm">
        <Signature label="Entrega" />
        <Signature label="Recibe" />
      </div>
    </main>
  );
}

function Field({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;

  return (
    <div className="flex gap-2">
      <dt className="font-medium">{label}:</dt>
      <dd>{value}</dd>
    </div>
  );
}

function Signature({ label }: { label: string }) {
  return (
    <div>
      <div className="h-12 border-b border-black" />
      <p className="mt-1 text-center text-xs">{label}</p>
    </div>
  );
}
