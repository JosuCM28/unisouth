import { z } from "zod";
import { OFFLINE_TABLES } from "@/lib/constants/offline-tables";

/** Qué tabla de la copia sin conexión se pide bajar. */
export const downloadOfflineTableSchema = z.object({
  table: z.enum(OFFLINE_TABLES),
});

export type DownloadOfflineTableInput = z.infer<typeof downloadOfflineTableSchema>;
