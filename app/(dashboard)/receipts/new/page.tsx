import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/core/session";
import { ClientRepository } from "@/lib/repositories/client.repository";
import { LocationRepository } from "@/lib/repositories/location.repository";
import { MaterialRepository } from "@/lib/repositories/material.repository";
import { HelperRepository } from "@/lib/repositories/helper.repository";
import { PageHeader } from "@/components/layout/page-header";
import { ReceiptWizard } from "@/components/receipts/receipt-wizard";

export const metadata: Metadata = { title: "Nueva recepción" };

export default async function NewReceiptPage() {
  // Ocultar el enlace es comodidad visual, no seguridad: la barrera real es
  // ésta. Antes bastaba con que el sidebar no lo pintara, pero el registro de
  // recepciones ya es visible para roles de sólo lectura y desde ahí se
  // alcanza esta ruta.
  await requirePermission("inventory:write");

  const [materials, helpers, locations, clients, suppliers, carriers] = await Promise.all([
    new MaterialRepository().findOptions(),
    new HelperRepository().findOptions(),
    new LocationRepository().findOptions(),
    new ClientRepository().findOptions(),
    prisma.supplier.findMany({
      where: { active: true, deletedAt: null },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.carrier.findMany({
      where: { active: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Nueva recepción"
        description="Registra la carga que acaba de llegar"
      />
      <ReceiptWizard
        materials={materials}
        helpers={helpers}
        locations={locations}
        clients={clients}
        suppliers={suppliers}
        carriers={carriers}
      />
    </div>
  );
}
