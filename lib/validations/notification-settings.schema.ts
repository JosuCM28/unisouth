import { z } from "zod";

/**
 * Por qué canales sale el vale al aplicar una salida.
 *
 * Los dos pueden quedar apagados: entonces la salida se aplica sin ofrecer
 * envío, igual que antes de que existiera ninguno.
 */
export const notificationChannelsSchema = z.object({
  whatsapp: z.boolean(),
  email: z.boolean(),
});

export type NotificationChannels = z.infer<typeof notificationChannelsSchema>;

export type NotificationChannel = keyof NotificationChannels;
