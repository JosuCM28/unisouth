import { BusinessRuleError } from "@/lib/core/errors";
import { SettingRepository } from "@/lib/repositories/setting.repository";
import {
  notificationChannelsSchema,
  type NotificationChannel,
  type NotificationChannels,
} from "@/lib/validations/notification-settings.schema";
import { NOTIFICATION_CHANNEL_LABELS } from "@/lib/constants/labels";
import { BaseService } from "./base.service";

const CHANNELS_KEY = "notifications.channels";

/**
 * Sin nada guardado, los dos canales van prendidos.
 *
 * Así el WhatsApp que ya funcionaba sigue funcionando el día que se despliega
 * esto, sin que alguien tenga que entrar a prenderlo; y el correo aparece en
 * cuanto se pega la llave de Resend, que es justo lo que se espera.
 */
const DEFAULT_CHANNELS: NotificationChannels = { whatsapp: true, email: true };

/**
 * Qué canales de envío están prendidos.
 *
 * Es la decisión de ADMIN y no del que aplica: "este mes no se manda por
 * WhatsApp" vale para todas las salidas, no se elige vale por vale.
 */
export class NotificationSettingsService extends BaseService {
  async getChannels(): Promise<NotificationChannels> {
    const raw = await new SettingRepository(this.db).findValue(CHANNELS_KEY);

    /* Un valor que no cuadra —editado a mano en la base, o de una versión
       vieja— se toma como el de fábrica en vez de tumbar la ficha del vale. */
    const parsed = notificationChannelsSchema.safeParse(raw);
    return parsed.success ? parsed.data : DEFAULT_CHANNELS;
  }

  async updateChannels(
    input: NotificationChannels,
  ): Promise<NotificationChannels> {
    return this.transaction(async (tx) => {
      const before = await new NotificationSettingsService(
        this.context,
        tx,
      ).getChannels();

      await new SettingRepository(tx).upsertValue(CHANNELS_KEY, input, {
        description: "Canales por los que sale el vale al aplicar una salida",
        group: "notifications",
      });

      await this.auditWith(tx).record({
        entity: "Setting",
        entityId: CHANNELS_KEY,
        action: "UPDATE",
        reference: "Canales de envío",
        oldValue: before,
        newValue: input,
        sensitivity: "MEDIUM",
      });

      return input;
    });
  }

  /**
   * Frena un envío por un canal apagado.
   *
   * La pantalla ya no lo ofrece, pero una action es un endpoint: sin esta
   * revisión en el servidor, apagar WhatsApp sólo escondería el botón.
   */
  async requireEnabled(channel: NotificationChannel): Promise<void> {
    const channels = await this.getChannels();
    if (channels[channel]) return;

    throw new BusinessRuleError(
      `El envío por ${NOTIFICATION_CHANNEL_LABELS[channel]} está deshabilitado. Un administrador lo prende en Administración → Notificaciones.`,
    );
  }
}
