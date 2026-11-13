import { z } from "zod";
import { batchProgressSchema } from "./cutting-order.schema";

/**
 * Un corte capturado sin internet, tal como llega al subirlo.
 *
 * Envuelve al MISMO `batchProgressSchema` de la captura en línea en vez de
 * copiar sus reglas: es un corte normal que llegó tarde, y si mañana cambia
 * qué exige una captura, las dos cambian juntas.
 *
 * Sin `batchId`: sin señal no se conocen los cortes de la orden, así que
 * siempre estrena uno. Mandarlo lleno sería meter bultos a ciegas en un
 * corte que alguien pudo corregir mientras tanto.
 */
export const offlineCutSchema = z
  .object({
    offlineId: z.string().uuid("Identificador de captura inválido"),
    batch: batchProgressSchema,
  })
  .refine((input) => !input.batch.batchId, {
    path: ["batch", "batchId"],
    message: "Sin conexión el corte siempre es uno nuevo.",
  });

export type OfflineCutInput = z.infer<typeof offlineCutSchema>;
