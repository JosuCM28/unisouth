import type { Metadata } from "next";
import { Plus } from "lucide-react";
import { requirePermission } from "@/lib/core/session";
import { loadVoucherDeliveryOptions } from "@/lib/vouchers/voucher-delivery-options";
import { PageHeader } from "@/components/layout/page-header";
import { ChannelSection } from "@/components/notifications/channel-section";
import { ChannelSettings } from "@/components/notifications/channel-settings";
import { EmailContactFormDialog } from "@/components/notifications/email-contact-form-dialog";
import { EmailContactList } from "@/components/notifications/email-contact-list";
import { ContactFormDialog } from "@/components/whatsapp/contact-form-dialog";
import { ContactList } from "@/components/whatsapp/contact-list";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Notificaciones" };

/**
 * Por dónde y a quién le llega el vale al aplicar una salida.
 *
 * No se pagina: son los cuatro o cinco destinatarios de siempre.
 */
export default async function NotificationsPage() {
  await requirePermission("notifications:write");

  const { whatsapp, email } = await loadVoucherDeliveryOptions();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Notificaciones"
        description="Por dónde y a quién se manda el vale al aplicar una salida"
      />

      <ChannelSection
        title="Canales"
        description="Apagado, el canal no se ofrece al aplicar"
      >
        <ChannelSettings
          channels={{ whatsapp: whatsapp.enabled, email: email.enabled }}
          configured={{ whatsapp: whatsapp.configured, email: email.configured }}
        />
      </ChannelSection>

      <ChannelSection
        title="Correos"
        description="Reciben el PDF adjunto y el encabezado en el cuerpo"
        action={<EmailContactFormDialog trigger={<NewButton />} />}
      >
        <EmailContactList contacts={email.contacts} />
      </ChannelSection>

      <ChannelSection
        title="WhatsApp"
        description="Reciben el PDF en el chat"
        action={<ContactFormDialog trigger={<NewButton />} />}
      >
        <ContactList contacts={whatsapp.contacts} />
      </ChannelSection>
    </div>
  );
}

function NewButton() {
  return (
    <Button className="touch-target">
      <Plus className="size-4" aria-hidden />
      Nuevo
    </Button>
  );
}
