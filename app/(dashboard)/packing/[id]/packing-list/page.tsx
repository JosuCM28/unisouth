import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requirePermission } from "@/lib/core/session";
import { roleHasPermission } from "@/lib/constants/roles";
import { dataFromOrder, dataFromSheet, piecesInBoxes } from "@/lib/packing/packing-list-data";
import { toDraft } from "@/lib/packing/packing-list-draft";
import { PackingRepository } from "@/lib/repositories/packing.repository";
import { PackingListSheetRepository } from "@/lib/repositories/packing-list-sheet.repository";
import { formatDateTime } from "@/lib/utils";
import { PageHeader } from "@/components/layout/page-header";
import { PackingListEditor } from "@/components/packing/packing-list-editor";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Packing list" };

interface PageProps {
  params: Promise<{ id: string }>;
}

/** El packing list del pedido para revisarlo y corregirlo antes de exportarlo. */
export default async function PackingListPage({ params }: PageProps) {
  const user = await requirePermission("finished-goods:browse");
  const { id } = await params;
  const [order, sheet] = await Promise.all([
    new PackingRepository().findDetail(id),
    new PackingListSheetRepository().findByOrder(id),
  ]);
  if (!order) notFound();

  const fromBoxes = dataFromOrder(order, user.name ?? null);
  const initial = sheet ? dataFromSheet(sheet) : fromBoxes;

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Packing list"
        description={describe(order.code, order.name, sheet)}
        action={
          <Button asChild variant="outline" className="touch-target">
            <Link href={`/packing/${id}`}><ArrowLeft className="size-4" aria-hidden />Pedido</Link>
          </Button>
        }
      />
      <PackingListEditor
        orderId={order.id}
        initial={toDraft(initial)}
        fromBoxes={toDraft(fromBoxes).rows}
        boxesPieces={piecesInBoxes(order)}
        saved={sheet !== null}
        canEdit={roleHasPermission(user.role, "packing:write")}
      />
    </div>
  );
}

function describe(
  code: string,
  name: string,
  sheet: { updatedAt: Date; updatedBy: { name: string } | null } | null,
): string {
  const base = `${name} · ${code}`;
  if (!sheet) return `${base} · sin guardar`;
  const by = sheet.updatedBy ? ` por ${sheet.updatedBy.name}` : "";
  return `${base} · guardado el ${formatDateTime(sheet.updatedAt)}${by}`;
}
