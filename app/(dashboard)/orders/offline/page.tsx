import type { Metadata } from "next";
import { getCurrentUser, requirePermission } from "@/lib/core/session";
import { roleHasPermission } from "@/lib/constants/roles";
import { PageHeader } from "@/components/layout/page-header";
import { OfflineOrdersView } from "@/components/offline/views/offline-orders-view";

export const metadata: Metadata = { title: "Órdenes sin conexión" };

/**
 * Órdenes vivas sobre la copia local, para cuando no hay señal.
 *
 * Qué botones de captura se pintan se decide AQUÍ, con la sesión, y viaja
 * dentro de la pantalla que el service worker guarda: sin señal no hay a
 * quién preguntarle. La barrera real sigue en el servidor al subir.
 */
export default async function OfflineOrdersPage() {
  await requirePermission("offline:manage");
  const user = await getCurrentUser();
  const role = user?.role ?? "";

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="Órdenes sin conexión" description="Órdenes abiertas y en corte, desde la copia de este equipo" />
      <OfflineOrdersView
        abilities={{
          canCut: roleHasPermission(role, "cuts:write"),
          canWrite: roleHasPermission(role, "inventory:write"),
        }}
      />
    </div>
  );
}
