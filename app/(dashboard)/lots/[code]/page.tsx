import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRightLeft,
  ClipboardCheck,
  Ban,
  Pencil,
  Printer,
  QrCode,
  Scissors,
} from "lucide-react";
import { ClientRepository } from "@/lib/repositories/client.repository";
import { LocationRepository } from "@/lib/repositories/location.repository";
import { LotRepository } from "@/lib/repositories/lot.repository";
import { UNIT_SHORT_LABELS } from "@/lib/constants/labels";
import { formatQuantity, toPlainObject } from "@/lib/utils";
import { StatusChip } from "@/components/lots/lot-card";
import { CancelLotDialog } from "@/components/lots/cancel-lot-dialog";
import { LotEditSheet } from "@/components/lots/lot-edit-sheet";
import { CutLotDialog } from "@/components/lots/cut-lot-dialog";
import { RecountDialog } from "@/components/lots/recount-dialog";
import { TransferDialog } from "@/components/lots/transfer-dialog";
import { LotMovements, type MovementRow } from "@/components/lots/lot-movements";
import { LotReceiptInfo } from "@/components/lots/lot-receipt-info";
import { Button } from "@/components/ui/button";

interface PageProps {
  params: Promise<{ code: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { code } = await params;
  return { title: code };
}

export default async function LotDetailPage({ params }: PageProps) {
  const { code } = await params;

  const [lot, locations, clients] = await Promise.all([
    new LotRepository().findDetail(decodeURIComponent(code)),
    new LocationRepository().findOptions(),
    new ClientRepository().findOptions(),
  ]);

  if (!lot) notFound();

  const plain = toPlainObject(lot);
  const unitLabel = UNIT_SHORT_LABELS[lot.unit];
  const available = plain.currentQuantity - plain.reservedQuantity;
  const isCancelled = lot.status === "WRITTEN_OFF";

  return (
    <div className="flex flex-col gap-4">
      <Link
        href="/lots"
        className="touch-target flex w-fit items-center gap-1.5 text-sm text-muted-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Inventario
      </Link>

      {/* Folio y cantidad, lo primero que se compara con la etiqueta física. */}
      <section className="flat-surface p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="tabular text-xl font-semibold leading-tight">
              {lot.code}
            </h1>
            <p className="mt-1 truncate text-sm">{lot.material.name}</p>
            <p className="tabular truncate text-xs text-muted-foreground">
              {lot.material.code}
              {lot.colorText && ` · ${lot.colorText}`}
            </p>
          </div>

          <div className="shrink-0 text-right">
            <p className="tabular text-3xl font-semibold leading-none">
              {formatQuantity(plain.currentQuantity)}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">{unitLabel}</p>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <StatusChip status={lot.status} />
          {lot.location && (
            <Chip label={`Ubicación ${lot.location.code}`} />
          )}
          {lot.shade && <Chip label={`Tono ${lot.shade}`} />}
          {lot.client && <Chip label={lot.client.name} />}
          {!lot.verified && <Chip label="Sin medir" />}
        </div>

        {/* Un rollo cancelado se anuncia arriba y con el motivo: es lo primero
            que hay que saber antes de intentar hacer nada con él. */}
        {isCancelled && lot.blockReason && (
          <div className="mt-3 border border-destructive p-3">
            <p className="text-xs font-medium uppercase tracking-wide text-destructive">
              Rollo cancelado
            </p>
            <p className="mt-1 text-sm">{lot.blockReason}</p>
          </div>
        )}

        {plain.reservedQuantity > 0 && (
          <p className="tabular mt-3 border-t border-border pt-3 text-sm text-state-reserved">
            {formatQuantity(plain.reservedQuantity, { unit: unitLabel })} reservados ·{" "}
            {formatQuantity(available, { unit: unitLabel })} disponibles
          </p>
        )}
      </section>

      {/* Las acciones van ARRIBA del kárdex: son a lo que el auxiliar entra,
          y buscarlas después de una lista larga costaría scroll.
          Un rollo cancelado no las muestra: no hay material que mover, y
          ofrecer "Cortar" sobre una baja sólo lleva a un error. */}
      {!isCancelled && (
      <section className="grid grid-cols-2 gap-2 md:grid-cols-5">
        <CutLotDialog
          lotId={lot.id}
          lotCode={lot.code}
          currentQuantity={plain.currentQuantity}
          reservedQuantity={plain.reservedQuantity}
          unit={lot.unit}
          trigger={
            <Button className="h-16 flex-col gap-1 text-xs">
              <Scissors className="size-5" aria-hidden />
              Cortar
            </Button>
          }
        />

        <RecountDialog
          lotId={lot.id}
          lotCode={lot.code}
          currentQuantity={plain.currentQuantity}
          unit={lot.unit}
          trigger={
            <Button variant="outline" className="h-16 flex-col gap-1 text-xs">
              <ClipboardCheck className="size-5" aria-hidden />
              Recontar
            </Button>
          }
        />

        <TransferDialog
          lotId={lot.id}
          lotCode={lot.code}
          currentLocationId={lot.locationId}
          currentLocationCode={lot.location?.code}
          locations={locations}
          trigger={
            <Button variant="outline" className="h-16 flex-col gap-1 text-xs">
              <ArrowRightLeft className="size-5" aria-hidden />
              Traspasar
            </Button>
          }
        />

        <LotEditSheet
          lot={{
            id: lot.id,
            code: lot.code,
            locationId: lot.locationId,
            clientId: lot.clientId,
            supplierLotNumber: lot.supplierLotNumber,
            shade: lot.shade,
            colorText: lot.colorText,
            actualWidthMm: lot.actualWidthMm,
            actualThicknessMm: plain.actualThicknessMm,
            actualWeightOz: plain.actualWeightOz,
            weightKg: plain.weightKg,
            unitCost: plain.unitCost,
            comment: lot.comment,
          }}
          locations={locations}
          clients={clients}
          trigger={
            <Button variant="outline" className="h-16 flex-col gap-1 text-xs">
              <Pencil className="size-5" aria-hidden />
              Corregir
            </Button>
          }
        />

        <CancelLotDialog
          lotId={lot.id}
          lotCode={lot.code}
          currentQuantity={plain.currentQuantity}
          unit={lot.unit}
          trigger={
            <Button
              variant="outline"
              className="h-16 flex-col gap-1 text-xs text-destructive hover:text-destructive"
            >
              <Ban className="size-5" aria-hidden />
              Cancelar
            </Button>
          }
        />
      </section>
      )}

      {/* Impresión: la etiqueta se pega en el rollo, la hoja lo acompaña. */}
      <section className="grid grid-cols-2 gap-2">
        <Button asChild variant="outline" className="touch-target">
          <a href={`/print/lots/${lot.code}?formato=etiqueta`} target="_blank" rel="noopener">
            <QrCode className="size-4" aria-hidden />
            Etiqueta con QR
          </a>
        </Button>

        <Button asChild variant="outline" className="touch-target">
          <a href={`/print/lots/${lot.code}`} target="_blank" rel="noopener">
            <Printer className="size-4" aria-hidden />
            Hoja completa
          </a>
        </Button>
      </section>

      <LotReceiptInfo lot={plain} />

      <section className="flat-surface p-4">
        <h2 className="mb-1 text-sm font-semibold">Kárdex</h2>
        <p className="mb-2 text-xs text-muted-foreground">
          Cada movimiento del rollo. No se edita ni se borra.
        </p>
        <LotMovements movements={plain.movements as unknown as MovementRow[]} />
      </section>
    </div>
  );
}

function Chip({ label }: { label: string }) {
  return (
    <span className="rounded border border-border px-1.5 py-0.5 text-xs text-muted-foreground">
      {label}
    </span>
  );
}
