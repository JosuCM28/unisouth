import type { Metadata } from "next";
import { requirePermission } from "@/lib/core/session";
import { PageHeader } from "@/components/layout/page-header";
import { OfflineMaterialsView } from "@/components/offline/views/offline-materials-view";

export const metadata: Metadata = { title: "Materiales sin conexión" };

/** Materiales y su existencia sobre la copia local, para cuando no hay señal. */
export default async function OfflineMaterialsPage() {
  await requirePermission("offline:manage");

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="Materiales sin conexión" description="Existencia por tela y tono, desde la copia de este equipo" />
      <OfflineMaterialsView />
    </div>
  );
}
