import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ArrowRightLeft, ClipboardCheck, Scissors } from "lucide-react";
import { LocationRepository } from "@/lib/repositories/location.repository";
import { LotRepository } from "@/lib/repositories/lot.repository";
import { UNIT_SHORT_LABELS } from "@/lib/constants/labels";
import { formatQuantity, toPlainObject } from "@/lib/utils";
import { StatusChip } from "@/components/lots/lot-card";
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

  const [lot, locations] = await Promise.all([
    new LotRepository().findDetail(decodeURIComponent(code)),
    new LocationRepository().findOptions(),
  ]);

  if (!lot) notFound();

  const plain = toPlainObject(lot);
  const unitLabel = UNIT_SHORT_LABELS[lot.unit];
  const available = plain.currentQuantity - plain.reservedQuantity;

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

        {plain.reservedQuantity > 0 && (
          <p className="tabular mt-3 border-t border-border pt-3 text-sm text-state-reserved">
            {formatQuantity(plain.reservedQuantity, { unit: unitLabel })} reservados ·{" "}
            {formatQuantity(available, { unit: unitLabel })} disponibles
          </p>
        )}
      </section>

      {/* Las acciones van ARRIBA del kárdex: son a lo que el auxiliar entra,
          y buscarlas después de una lista larga costaría scroll. */}
      <section className="grid grid-cols-3 gap-2">
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
