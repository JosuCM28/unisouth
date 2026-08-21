import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Pencil, Printer } from "lucide-react";
import { getCurrentUser, requirePermission } from "@/lib/core/session";
import { roleHasPermission } from "@/lib/constants/roles";
import { ReceiptRepository } from "@/lib/repositories/receipt.repository";
import { cn, formatDate, formatDateTime, toPlainObject } from "@/lib/utils";
import { PageHeader } from "@/components/layout/page-header";
import { ExportButton } from "@/components/shared/export-button";
import { ReceiptLots } from "@/components/receipts/receipt-lots";
import { ReceiptEditSheet } from "@/components/receipts/receipt-edit-sheet";
import { Button } from "@/components/ui/button";

interface PageProps {
  params: Promise<{ code: string }>;
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { code } = await params;
  return { title: `Recepción ${decodeURIComponent(code)}` };
}

/**
 * Detalle de una recepción: el encabezado y TODOS los rollos que trajo.
 *
 * Es la pantalla que responde "¿qué llegó el martes en la guía 4471?" sin
 * tener que cruzar el inventario a mano.
 */
export default async function ReceiptDetailPage({ params }: PageProps) {
  await requirePermission("inventory:browse");

  const { code } = await params;
  const repository = new ReceiptRepository();

  const [receipt, user] = await Promise.all([
    repository.findByCodeWithLots(decodeURIComponent(code)),
    getCurrentUser(),
  ]);

  if (!receipt) notFound();

  const plain = toPlainObject(receipt);

  // Sin permiso de escritura no se ofrece corregir: el botón abriría un
  // formulario que el servidor va a rechazar de todos modos.
  const canEdit = user
    ? roleHasPermission(user.role, "inventory:write")
    : false;
  const options = canEdit ? await repository.findEditOptions() : null;

  return (
    <div className="flex flex-col gap-4">
      <Link
        href="/receipts"
        className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Recepciones
      </Link>

      <PageHeader
        title={formatDate(receipt.date)}
        description={receipt.code}
        action={
          <div className="flex flex-wrap gap-2">
            {options && (
              <ReceiptEditSheet
                receipt={{
                  id: receipt.id,
                  code: receipt.code,
                  date: receipt.date.toISOString(),
                  guideNumber: receipt.guideNumber,
                  carrierId: receipt.carrierId,
                  origin: receipt.origin,
                  supplierId: receipt.supplierId,
                  clientId: receipt.clientId,
                  invoiceRef: receipt.invoiceRef,
                  orderRef: receipt.orderRef,
                  packageCount: receipt.packageCount,
                  notes: receipt.notes,
                }}
                clients={options.clients}
                suppliers={options.suppliers}
                carriers={options.carriers}
                trigger={
                  <Button variant="outline" className="touch-target">
                    <Pencil className="size-4" aria-hidden />
                    Editar
                  </Button>
                }
              />
            )}
            <ExportButton
              href={`/api/export/receipts/${receipt.code}`}
              label="Excel"
            />
            <Button asChild variant="outline" className="touch-target">
              <a
                href={`/print/lots?receiptId=${receipt.id}`}
                target="_blank"
                rel="noopener"
              >
                <Printer className="size-4" aria-hidden />
                Imprimir hojas
              </a>
            </Button>
          </div>
        }
      />

      {/* Encabezado: de dónde vino la carga. */}
      <section className="flat-surface p-4">
        <dl className="grid grid-cols-1 gap-x-8 gap-y-2 sm:grid-cols-2">
          <Row label="Guía" value={receipt.guideNumber} tabular />
          <Row label="Paquetería" value={receipt.carrier?.name} />
          <Row label="Proveedor" value={receipt.supplier?.name} />
          <Row label="Cliente dueño" value={receipt.client?.name ?? "De la fábrica"} />
          <Row label="Origen" value={receipt.origin} />
          <Row label="Factura" value={receipt.invoiceRef} tabular />
          <Row label="Orden de compra" value={receipt.orderRef} tabular />
          <Row label="Bultos" value={receipt.packageCount?.toString()} tabular />
          <Row label="Registró" value={receipt.recordedBy?.name} />
          <Row label="Capturada" value={formatDateTime(receipt.createdAt)} tabular />
        </dl>

        {receipt.notes && (
          <div className="mt-3 border-t border-border pt-3">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Notas
            </p>
            <p className="mt-1 whitespace-pre-wrap text-sm">{receipt.notes}</p>
          </div>
        )}
      </section>

      <ReceiptLots lots={plain.lots} />
    </div>
  );
}

/**
 * Un renglón del encabezado.
 *
 * Los vacíos se pintan con guion en vez de omitirse: saber que una carga
 * llegó SIN guía es un dato, y un hueco no lo distingue de un olvido.
 */
function Row({
  label,
  value,
  tabular,
}: {
  label: string;
  value: string | null | undefined;
  tabular?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-border py-1 text-sm">
      <dt className="shrink-0 text-muted-foreground">{label}</dt>
      {/* min-w-0 + break-words: un origen o un proveedor de nombre largo se
          parte en varias líneas en vez de empujar el renglón fuera de la
          pantalla del celular. */}
      <dd className={cn("min-w-0 break-words text-right", tabular && "tabular")}>
        {value || "—"}
      </dd>
    </div>
  );
}
