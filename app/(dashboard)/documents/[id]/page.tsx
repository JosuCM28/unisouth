import { notFound } from "next/navigation";
import type { CutTag } from "@prisma/client";
import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import {
  CUT_TAG_COLORS, CUT_TAG_LABELS, CUT_VERSION_LABELS,
  DOCUMENT_STATUS_LABELS, DOCUMENT_STATUS_STYLES,
  DOCUMENT_TYPE_LABELS, UNIT_SHORT_LABELS,
} from "@/lib/constants/labels";
import { cn, contrastText, formatDate, formatDateTime, formatQuantity } from "@/lib/utils";
import { PageHeader } from "@/components/layout/page-header";
import { DocumentActions } from "@/components/documents/document-actions";

interface PageProps { params: Promise<{ id: string }> }

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const doc = await prisma.inventoryDocument.findUnique({ where: { id }, select: { code: true } });
  return { title: doc?.code ?? "Documento" };
}

export default async function DocumentDetailPage({ params }: PageProps) {
  const { id } = await params;

  const document = await prisma.inventoryDocument.findUnique({
    where: { id },
    include: {
      createdBy: { select: { name: true } },
      appliedBy: { select: { name: true } },
      cancelledBy: { select: { name: true } },
      // Empresa y tela del encabezado del corte: son del vale, no de los
      // rollos, para que una salida sin rollos también las tenga.
      client: { select: { name: true } },
      cutFabric: { select: { name: true } },
      lines: {
        orderBy: { order: "asc" },
        include: {
          lot: {
            include: {
              material: { select: { name: true } },
              location: { select: { code: true } },
              client: { select: { name: true } },
            },
          },
        },
      },
      cutLines: {
        orderBy: { order: "asc" },
        include: {
          size: { select: { code: true, name: true } },
          cutTag: { select: { name: true, color: true } },
        },
      },
    },
  });

  if (!document) notFound();

  return (
    <div className="flex flex-col gap-4">
      <Link href="/documents" className="touch-target flex w-fit items-center gap-1.5 text-sm text-muted-foreground">
        <ArrowLeft className="size-4" aria-hidden />Documentos
      </Link>

      <PageHeader
        title={document.code}
        description={`${DOCUMENT_TYPE_LABELS[document.type]} · ${formatDate(document.date)}`}
      />

      <div className="flex flex-wrap items-center gap-2">
        <span className={cn("rounded px-2 py-1 text-sm", DOCUMENT_STATUS_STYLES[document.status])}>
          {DOCUMENT_STATUS_LABELS[document.status]}
        </span>
        {document.appliedAt && (
          <span className="text-xs text-muted-foreground">
            Aplicado {formatDateTime(document.appliedAt)}
            {document.appliedBy && ` por ${document.appliedBy.name}`}
          </span>
        )}
      </div>

      {document.status === "CANCELLED" && document.cancellationReason && (
        <div className="border border-state-defective bg-state-defective-muted p-3">
          <p className="text-sm font-medium">Cancelado</p>
          <p className="text-sm">{document.cancellationReason}</p>
          {document.cancelledBy && (
            <p className="mt-1 text-xs text-muted-foreground">
              Por {document.cancelledBy.name} · {formatDateTime(document.cancelledAt)}
            </p>
          )}
        </div>
      )}

      <DocumentActions
        documentId={document.id}
        documentCode={document.code}
        status={document.status}
        lineCount={document.lines.length}
        cutLineCount={document.cutLines.length}
        isIssue={document.type === "ISSUE"}
      />

      {document.cutLines.length > 0 && (
        <section className="flat-surface p-4">
          <h2 className="mb-3 text-sm font-semibold">Desglose de corte</h2>

          {/* El encabezado: lo mismo que se lee arriba en la hoja impresa. */}
          <dl className="mb-3 grid grid-cols-2 gap-x-4 gap-y-1 border border-border p-3 text-sm md:grid-cols-3">
            <HeaderItem label="Empresa" value={document.client?.name} />
            <HeaderItem label="Descripción" value={document.cutDescription} />
            <HeaderItem label="Fecha" value={formatDate(document.date)} />
            <HeaderItem label="Orden" value={document.reference} />
            <HeaderItem
              label="Tela"
              value={document.cutFabric?.name ?? document.cutFabricText}
            />
            <HeaderItem label="Molde" value={document.cutPattern} />
            <HeaderItem
              label="Versión"
              value={
                document.cutVersion
                  ? CUT_VERSION_LABELS[document.cutVersion]
                  : null
              }
            />
            <HeaderItem
              label="De la versión"
              value={document.cutVersionNotes}
            />
          </dl>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="p-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Talla
                  </th>
                  <th className="p-2 text-right text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Cantidad a cortar
                  </th>
                  <th className="p-2 text-right text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Bultos
                  </th>
                  <th className="p-2 text-right text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Total
                  </th>
                  <th className="p-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Foleo
                  </th>
                  <th className="p-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Anotaciones
                  </th>
                </tr>
              </thead>
              <tbody>
                {document.cutLines.map((line) => (
                  <tr key={line.id} className="border-b border-border">
                    <td className="tabular p-2 font-medium">{line.size.code}</td>
                    <td className="tabular p-2 text-right">{line.quantity}</td>
                    <td className="tabular p-2 text-right">{line.bundles}</td>
                    {/* Cantidad por bulto × bultos: lo que de verdad sale. */}
                    <td className="tabular p-2 text-right font-medium">
                      {line.quantity * line.bundles}
                    </td>
                    <td className="p-2">
                      {/* Del catálogo; el enum viejo queda de respaldo para
                          los vales capturados antes de que existiera. */}
                      {resolveTag(line.cutTag, line.tag) ? (
                        <span
                          className="inline-block px-2 py-0.5 text-xs"
                          style={{
                            backgroundColor: resolveTag(line.cutTag, line.tag)!
                              .color,
                            color: contrastText(
                              resolveTag(line.cutTag, line.tag)!.color,
                            ),
                          }}
                        >
                          {resolveTag(line.cutTag, line.tag)!.name}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="p-2 text-muted-foreground">
                      {line.notes ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="font-medium">
                  <td className="p-2">Total</td>
                  <td className="tabular p-2 text-right">
                    {document.cutLines.reduce((sum, l) => sum + l.quantity, 0)}
                  </td>
                  <td className="tabular p-2 text-right">
                    {document.cutLines.reduce((sum, l) => sum + l.bundles, 0)}
                  </td>
                  <td className="tabular p-2 text-right text-base font-bold">
                    {document.cutLines.reduce(
                      (sum, l) => sum + l.quantity * l.bundles,
                      0,
                    )}
                  </td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Las notas del corte, numeradas igual que en la hoja: en el taller
              se citan por número, así que la pantalla y el papel tienen que
              numerarlas igual. */}
          {document.cutNotes.length > 0 && (
            <ol className="mt-3 flex flex-col gap-1 border-t border-border pt-3 text-sm">
              {document.cutNotes.map((note, index) => (
                <li key={index} className="flex gap-2">
                  <span className="tabular shrink-0 font-medium">
                    Nota {index + 1}.
                  </span>
                  <span>{note}</span>
                </li>
              ))}
            </ol>
          )}
        </section>
      )}

      <section className="flat-surface p-4">
        <h2 className="mb-3 text-sm font-semibold">
          Rollos ({document.lines.length})
        </h2>

        {/* Sin rollos se explica por qué: un vale de sólo cortes es válido,
            y una lista vacía sin más haría pensar que algo se perdió. */}
        {document.lines.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Esta salida no lleva rollos: sólo el desglose de cortes. No mueve
            existencias.
          </p>
        )}

        <ul className="divide-y divide-border">
          {document.lines.map((line) => (
            <li key={line.id} className="flex items-center justify-between gap-3 py-2">
              <div className="min-w-0">
                <p className="tabular text-sm font-medium">{line.lot.code}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {line.lot.material.name}
                  {line.lot.shade && ` · tono ${line.lot.shade}`}
                  {line.lot.location && ` · ${line.lot.location.code}`}
                </p>
              </div>
              <span className="tabular shrink-0 text-sm font-medium">
                {formatQuantity(line.quantity, { unit: UNIT_SHORT_LABELS[line.unit] })}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

/** El foleo de un renglón: primero el catálogo, luego el enum viejo. */
function resolveTag(
  option: { name: string; color: string } | null,
  legacy: CutTag | null,
): { name: string; color: string } | null {
  if (option) return option;
  if (!legacy) return null;

  return {
    name: CUT_TAG_LABELS[legacy],
    color: CUT_TAG_COLORS[legacy].background,
  };
}

/**
 * Un dato del encabezado del corte, o nada.
 *
 * Los campos vacíos NO se pintan con un guion: la hoja de corte se llena a
 * medias con toda normalidad, y ocho renglones con "—" hacen creer que la
 * captura quedó incompleta.
 */
function HeaderItem({
  label,
  value,
}: {
  label: string;
  value: string | null | undefined;
}) {
  if (!value) return null;

  return (
    <div className="flex flex-col">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}
