"use server";

import { executeAction } from "@/lib/core/action-handler";
import { notificationChannelsSchema } from "@/lib/validations/notification-settings.schema";
import { NotificationSettingsService } from "@/lib/services/notification-settings.service";

/** Prende o apaga los canales por los que sale el vale. */
export async function updateNotificationChannelsAction(input: unknown) {
  return executeAction(input, {
    schema: notificationChannelsSchema,
    permission: "notifications:write",
    // La ficha de la salida también: ahí se decide qué canales se ofrecen.
    revalidate: ["/notifications", "/documents"],
    successMessage: "Canales actualizados",
    handler: ({ input, auditContext }) =>
      new NotificationSettingsService(auditContext).updateChannels(input),
  });
}
