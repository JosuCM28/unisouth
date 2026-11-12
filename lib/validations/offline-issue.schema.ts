import { z } from "zod";
import { documentSchema } from "./document.schema";

/**
 * Una salida capturada sin internet, tal como llega al subirla.
 *
 * Envuelve al MISMO `documentSchema` de la salida en línea en vez de copiar
 * sus reglas: una salida offline es una salida normal que llegó tarde, y si
 * mañana cambia qué exige un vale, las dos cambian juntas.
 *
 * `offlineId` lo genera el celular al capturar (UUID) y es lo que hace
 * seguro reenviarla: el servidor reconoce la que ya aplicó.
 */
export const offlineIssueSchema = z
  .object({
    offlineId: z.string().uuid("Identificador de captura inválido"),
    document: documentSchema,
  })
  .refine((input) => input.document.type === "ISSUE", {
    path: ["document", "type"],
    message: "Sin conexión sólo se pueden capturar salidas.",
  });

export type OfflineIssueInput = z.infer<typeof offlineIssueSchema>;
