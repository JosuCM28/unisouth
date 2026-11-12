import type { Metadata } from "next";
import { requirePermission } from "@/lib/core/session";
import { offlineTablesFor } from "@/lib/constants/offline-tables";
import { PageHeader } from "@/components/layout/page-header";
import { OfflineDataPanel } from "@/components/offline/offline-data-panel";

export const metadata: Metadata = { title: "Datos sin conexión" };

/**
 * La copia de la base en este equipo, para trabajar sin internet.
 *
 * La página sólo resuelve QUÉ tablas le tocan al rol; lo demás —qué hay
 * guardado, qué falta por subir— vive en el navegador y lo pinta el panel.
 */
export default async function OfflineDataPage() {
  const user = await requirePermission("offline:manage");

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Datos sin conexión"
        description="Copia de la base guardada en este equipo para seguir trabajando sin internet"
      />

      <OfflineDataPanel tables={offlineTablesFor(user.role)} />
    </div>
  );
}
