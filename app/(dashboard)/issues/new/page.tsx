import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requirePermission } from "@/lib/core/session";
import { roleHasPermission } from "@/lib/constants/roles";
import { getIssueFormOptions } from "@/lib/issue-form-options";
import { PageHeader } from "@/components/layout/page-header";
import { IssueForm } from "@/components/issues/issue-form";

export const metadata: Metadata = { title: "Nueva salida" };

export default async function NewIssuePage() {
  // Ocultar el enlace es comodidad visual, no seguridad: el registro de
  // salidas lo ven los roles de sólo lectura y desde ahí se alcanza esta
  // ruta escribiéndola. La barrera real es ésta.
  const user = await requirePermission("inventory:write");

  /* Corregir el metraje de un rollo desde el vale es un reconteo, y eso pesa
     más que armar la salida: se resuelve aquí, en el servidor, y el
     formulario sólo recibe el sí o el no. */
  const canAdjust = roleHasPermission(user.role, "inventory:adjust");

  const options = await getIssueFormOptions();

  return (
    <div className="flex flex-col gap-4">
      <Link
        href="/issues"
        className="touch-target flex w-fit items-center gap-1.5 text-sm text-muted-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Salidas
      </Link>

      <PageHeader
        title="Nueva salida"
        description="Qué material se lleva producción"
      />

      <IssueForm
        materials={options.materials}
        products={options.products}
        sizes={options.sizes}
        cutSizes={options.sizes}
        cutTags={options.cutTags}
        clients={options.clients}
        productionRuns={options.productionRuns}
        canAdjust={canAdjust}
      />
    </div>
  );
}
