import { EvolutionClient } from "@/lib/core/evolution-client";
import { ResendClient } from "@/lib/core/resend-client";
import { EmailContactRepository } from "@/lib/repositories/email-contact.repository";
import { WhatsappContactRepository } from "@/lib/repositories/whatsapp-contact.repository";
import { NotificationSettingsService } from "@/lib/services/notification-settings.service";

/**
 * Todo lo que la ficha de una salida necesita para ofrecer el envío: qué
 * canales prendió ADMIN, cuáles tienen sus variables en el servidor y a
 * quién se le puede mandar por cada uno.
 *
 * Junto en un solo lugar porque la ficha y cualquier otra pantalla que algún
 * día aplique salidas tienen que ofrecer exactamente lo mismo.
 */
export async function loadVoucherDeliveryOptions() {
  const [channels, whatsappContacts, emailContacts] = await Promise.all([
    new NotificationSettingsService().getChannels(),
    new WhatsappContactRepository().findAll(),
    new EmailContactRepository().findAll(),
  ]);

  return {
    whatsapp: {
      enabled: channels.whatsapp,
      configured: EvolutionClient.isConfigured(),
      contacts: whatsappContacts,
    },
    email: {
      enabled: channels.email,
      configured: ResendClient.isConfigured(),
      contacts: emailContacts,
    },
  };
}
