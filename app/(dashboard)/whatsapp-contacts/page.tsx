import type { Metadata } from "next";
import { AlertTriangle, Plus } from "lucide-react";
import { requirePermission } from "@/lib/core/session";
import { EvolutionClient } from "@/lib/core/evolution-client";
import { WhatsappContactRepository } from "@/lib/repositories/whatsapp-contact.repository";
import { PageHeader } from "@/components/layout/page-header";
import { ContactFormDialog } from "@/components/whatsapp/contact-form-dialog";
import { ContactList } from "@/components/whatsapp/contact-list";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "WhatsApp" };

/**
 * A quién le llega el vale por WhatsApp.
 *
 * No se pagina: son los cuatro o cinco números de siempre.
 */
export default async function WhatsappContactsPage() {
  await requirePermission("whatsapp:write");

  const contacts = await new WhatsappContactRepository().findAll();

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="WhatsApp"
        description="Los números a los que se manda el vale al aplicar una salida"
        action={
          <ContactFormDialog
            trigger={
              <Button className="touch-target">
                <Plus className="size-4" aria-hidden />
                Nuevo
              </Button>
            }
          />
        }
      />

      {/* Se dice aquí, que es donde lo ve quien puede arreglarlo: en la
          pantalla de la salida sólo se puede lamentar. */}
      {!EvolutionClient.isConfigured() && (
        <p className="flex items-start gap-2 border border-state-reserved bg-card p-3 text-sm">
          <AlertTriangle
            className="size-4 shrink-0 text-state-reserved"
            aria-hidden
          />
          <span>
            WhatsApp todavía no está configurado: faltan las variables{" "}
            <code>EVOLUTION_API_URL</code>, <code>EVOLUTION_API_KEY</code> y{" "}
            <code>EVOLUTION_INSTANCE</code> en el servidor. Los contactos se
            pueden capturar desde ya.
          </span>
        </p>
      )}

      <ContactList contacts={contacts} />
    </div>
  );
}
