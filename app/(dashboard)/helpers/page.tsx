import type { Metadata } from "next";
import { Plus } from "lucide-react";
import { HelperRepository } from "@/lib/repositories/helper.repository";
import { toPlainObject } from "@/lib/utils";
import { PageHeader } from "@/components/layout/page-header";
import { HelperFormDialog } from "@/components/helpers/helper-form-dialog";
import { HelperList } from "@/components/helpers/helper-list";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Ayudantes" };

export default async function HelpersPage() {
  const helpers = await new HelperRepository().findAllWithWork();

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Ayudantes"
        description="Quiénes descargan el camión y cuánto han bajado"
        action={
          <HelperFormDialog
            trigger={
              <Button className="touch-target">
                <Plus className="size-4" aria-hidden />Nuevo
              </Button>
            }
          />
        }
      />

      <HelperList helpers={toPlainObject(helpers)} />
    </div>
  );
}
