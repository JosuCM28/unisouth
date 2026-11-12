import type { Metadata } from "next";
import { Suspense } from "react";
import { requirePermission } from "@/lib/core/session";
import { PageHeader } from "@/components/layout/page-header";
import { OfflineLotsView } from "@/components/offline/views/offline-lots-view";

export const metadata: Metadata = { title: "Inventario sin conexión" };

/**
 * Inventario sobre la copia local, para cuando no hay señal.
 *
 * Pide `offline:manage` porque sólo existe para quien puede bajar la copia;
 * sin ella la pantalla estaría siempre vacía. No lee nada del servidor.
 */
export default async function OfflineLotsPage() {
  await requirePermission("offline:manage");

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="Inventario sin conexión" description="Rollo por rollo, desde la copia de este equipo" />
      {/* Suspense: la vista lee `?material=` con useSearchParams. */}
      <Suspense>
        <OfflineLotsView />
      </Suspense>
    </div>
  );
}
