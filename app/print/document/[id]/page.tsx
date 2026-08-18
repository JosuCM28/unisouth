import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/core/session";
import {
  CUT_TAG_COLORS,
  CUT_TAG_LABELS,
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
      cutLines: {
        orderBy: { order: "asc" },
        include: { size: { select: { code: true, name: true } } },
      },
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

  /* La empresa y la tela se leen de los rollos y no del encabezado: el
     documento sólo guarda `clientId` sin relación, y de todos modos el dato
     que importa en el taller es de qué cliente es la tela que va en la caja.
     Si la salida mezcla materiales se listan todos, separados por coma. */
  const companyName =
    unique(document.lines.map((line) => line.lot.client?.name)).join(", ") ||
    "De la fábrica";
  const fabricNames = unique(
    document.lines.map((line) => line.lot.material.name),
  ).join(", ");

  const cutTotals = document.cutLines.reduce(
    (acc, line) => ({
      pieces: acc.pieces + line.quantity,
      bundles: acc.bundles + line.bundles,
    }),
    { pieces: 0, bundles: 0 },
  );

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

      {/* ── Desglose de corte: lo que se va a cortar con esta tela ── */}
      {document.cutLines.length > 0 && (
        <section className="mt-4">
          <dl className="grid grid-cols-2 gap-x-6 border border-black p-2 text-sm">
            <Row label="Empresa" value={companyName} />
            <Row label="Tela" value={fabricNames} />
          </dl>

          <table className="mt-2 w-full border-collapse text-sm">
            <thead>
              <tr className="bg-neutral-200 text-left">
                <th className="border border-black px-2 py-1">Talla</th>
                <th className="border border-black px-2 py-1 text-right">
                  Cantidad
                </th>
                <th className="border border-black px-2 py-1 text-right">
                  Bultos
                </th>
                <th className="border border-black px-2 py-1">Foleo</th>
                <th className="border border-black px-2 py-1">Anotaciones</th>
              </tr>
            </thead>
            <tbody>
              {document.cutLines.map((line) => {
                const colors = line.tag ? CUT_TAG_COLORS[line.tag] : null;

                return (
                  <tr key={line.id}>
                    <td className="tabular border border-black px-2 py-1 font-medium">
                      {line.size.code}
                    </td>
                    <td className="tabular border border-black px-2 py-1 text-right">
                      {line.quantity}
                    </td>
                    <td className="tabular border border-black px-2 py-1 text-right">
                      {line.bundles}
                    </td>
                    {/* La celda se pinta del color del papelito: así la hoja
                        impresa se puede cotejar de un vistazo con el bulto. */}
                    <td
                      className="border border-black px-2 py-1 text-center"
                      style={
                        colors
                          ? {
                              backgroundColor: colors.background,
                              color: colors.text,
                              // Sin esto el navegador descarta los fondos al
                              // imprimir y el foleo sale en blanco.
                              printColorAdjust: "exact",
                              WebkitPrintColorAdjust: "exact",
                            }
                          : undefined
                      }
                    >
                      {line.tag ? CUT_TAG_LABELS[line.tag] : "—"}
                    </td>
                    <td className="border border-black px-2 py-1">
                      {line.notes ?? ""}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="font-bold">
                <td className="border border-black px-2 py-1">TOTAL</td>
                <td className="tabular border border-black px-2 py-1 text-right">
                  {cutTotals.pieces}
                </td>
                <td className="tabular border border-black px-2 py-1 text-right">
                  {cutTotals.bundles}
                </td>
                <td className="border border-black" colSpan={2} />
              </tr>
            </tfoot>
          </table>
        </section>
      )}

      {/* ── Rollos que salieron y con cuántos metros cada uno ── */}
      <h2 className="mt-6 text-sm font-bold uppercase">Rollos entregados</h2>
      <table className="mt-1 w-full border-collapse text-sm">
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

      {/* El total de rollos Y de metros: en el andén se cuentan los bultos
          físicos, y el metraje es lo que se factura. */}
      <p className="tabular mt-2 text-right text-sm font-bold">
        {document.lines.length}{" "}
        {document.lines.length === 1 ? "rollo" : "rollos"} ·{" "}
        {formatQuantity(
          document.lines.reduce((sum, line) => sum + Number(line.quantity), 0),
        )}{" "}
        en total
      </p>

      {document.notes && (
        <p className="mt-4 border border-neutral-400 p-2 text-sm">
          {document.notes}
        </p>
      )}

      {/* Las firmas son el punto de todo esto: el vale existe para que quede
          constancia en papel de quién entregó y quién recibió. Se deja el
          renglón de "nombre" aparte de la firma porque una firma sola no se
          lee, y meses después nadie sabe de quién era. */}
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
      {/* Si el vale ya trae el nombre capturado se imprime; si no, se deja el
          renglón en blanco para que lo escriba a mano quien recibe. */}
      {name ? (
        <p className="text-xs">{name}</p>
      ) : (
        <>
          <div className="mt-6 border-b border-black" />
          <p className="mt-1 text-xs">Nombre</p>
        </>
      )}
    </div>
  );
}

/** Valores distintos y sin vacíos, conservando el orden en que aparecieron. */
function unique(values: (string | null | undefined)[]): string[] {
  return [...new Set(values.filter((value): value is string => Boolean(value)))];
}
