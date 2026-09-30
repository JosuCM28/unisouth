import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/core/session";
import { roleHasPermission } from "@/lib/constants/roles";
import { getIssueFormOptions } from "@/lib/issue-form-options";
import { PageHeader } from "@/components/layout/page-header";
import { IssueForm } from "@/components/issues/issue-form";

export const metadata: Metadata = { title: "Nueva salida" };

interface PageProps {
  searchParams: Promise<{ order?: string }>;
}

export default async function NewIssuePage({ searchParams }: PageProps) {
  // Ocultar el enlace es comodidad visual, no seguridad: el registro de
  // salidas lo ven los roles de sólo lectura y desde ahí se alcanza esta
  // ruta escribiéndola. La barrera real es ésta.
  const user = await requirePermission("inventory:write");

  /* Corregir el metraje de un rollo desde el vale es un reconteo, y eso pesa
     más que armar la salida: se resuelve aquí, en el servidor, y el
     formulario sólo recibe el sí o el no. */
  const canAdjust = roleHasPermission(user.role, "inventory:adjust");

  const options = await getIssueFormOptions();

  /* "Salida de tela" desde una orden: el vale nace ligado a ella. Una orden
     que no existe o está cancelada se ignora y queda la salida suelta de
     siempre, en vez de ligar tela a algo que ya no corre. */
  const { order: orderId } = await searchParams;
  const order = orderId
    ? await prisma.cuttingOrder.findFirst({
        where: { id: orderId, status: { not: "CANCELLED" } },
        select: { id: true, code: true, clientId: true, materialId: true },
      })
    : null;

  return (
    <div className="flex flex-col gap-4">
      <Link
        href={order ? `/orders/${order.id}` : "/issues"}
        className="touch-target flex w-fit items-center gap-1.5 text-sm text-muted-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden />
        {order ? order.code : "Salidas"}
      </Link>

      <PageHeader
        title={order ? `Salida de tela · ${order.code}` : "Nueva salida"}
        description={
          order
            ? "Los rollos que se lleva esta orden"
            : "Qué material se lleva producción"
        }
      />

      <IssueForm
        materials={options.materials}
        products={options.products}
        sizes={options.sizes}
        cutSizes={options.sizes}
        cutTags={options.cutTags}
        clients={options.clients}
        productionRuns={options.productionRuns}
        locations={options.locations}
        order={order ?? undefined}
        canAdjust={canAdjust}
      />
    </div>
  );
}
