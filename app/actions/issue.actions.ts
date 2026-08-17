"use server";

import { z } from "zod";
import { executeAction } from "@/lib/core/action-handler";
import { cuidSchema, optionalCuid } from "@/lib/validations/common";
import { LotRepository } from "@/lib/repositories/lot.repository";
import { CalculationService } from "@/lib/services/calculation.service";

/**
 * Consultas que alimentan el formulario de salida.
 *
 * Son actions y no lecturas del Server Component porque el auxiliar elige el
 * material DESPUÉS de que la página cargó: los rollos de esa clave no se
 * pueden resolver de antemano sin traerse la bodega entera al navegador.
 *
 * Ambas son de sólo lectura y no mueven inventario. La salida en sí se crea
 * con `createDocumentAction`, que ya existe.
 */

const availableLotsSchema = z.object({
  materialId: cuidSchema,
  /** Con dueño, sólo se ofrecen los rollos de ese cliente. */
  clientId: optionalCuid,
});

export interface IssueLotOption {
  id: string;
  code: string;
  shade: string | null;
  isRemnant: boolean;
  /** Lo que de verdad se puede tomar: saldo menos lo reservado. */
  available: number;
  unit: string;
  locationCode: string | null;
  materialName: string;
}

/** Rollos que se pueden surtir de un material: retazos primero, luego FIFO. */
export async function availableLotsAction(input: unknown) {
  return executeAction(input, {
    schema: availableLotsSchema,
    permission: "inventory:read",
    handler: async ({ input }): Promise<IssueLotOption[]> => {
      const lots = await new LotRepository().findAvailableForIssue({
        materialId: input.materialId,
        clientId: input.clientId,
      });

      return lots
        .map((lot) => ({
          id: lot.id,
          code: lot.code,
          shade: lot.shade,
          isRemnant: lot.isRemnant,
          available:
            Number(lot.currentQuantity) - Number(lot.reservedQuantity),
          unit: lot.unit,
          locationCode: lot.location?.code ?? null,
          materialName: lot.material.name,
        }))
        // Un rollo íntegramente reservado ocupa lugar pero no se puede tomar:
        // ofrecerlo sólo llevaría a un error al aplicar el vale.
        .filter((lot) => lot.available > 0);
    },
  });
}

const explodeSchema = z.object({
  productId: cuidSchema,
  bomId: cuidSchema,
  quantity: z.coerce
    .number({ message: "Escribe cuántas piezas" })
    .int("Las piezas deben ser un número entero")
    .positive("Deben ser más de cero piezas"),
  sizeId: optionalCuid,
  clientId: optionalCuid,
});

/**
 * Explota "3,000 pantalones" en sus insumos con los rollos ya sugeridos.
 *
 * Reutiliza el motor de cálculo en vez de repetir la fórmula: así la salida
 * descuenta exactamente lo mismo que dijo el cálculo, merma incluida. Si las
 * dos fórmulas vivieran por separado, tarde o temprano dirían números
 * distintos y nadie sabría cuál creer.
 */
export async function explodeForIssueAction(input: unknown) {
  return executeAction(input, {
    schema: explodeSchema,
    permission: "calculation:run",
    handler: async ({ input, auditContext }) => {
      const { requirements } = await new CalculationService(auditContext).run({
        // El cálculo queda guardado como simulación con nombre propio: deja
        // el rastro de con qué números se armó esta salida.
        name: "Explosión para salida",
        productionRunId: undefined,
        notes: undefined,
        clientId: input.clientId,
        // La merma ya viene dentro de la ficha técnica, línea por línea.
        // Aquí no se suma ninguna extra: lo que sale del almacén es lo que
        // se va a consumir, no una previsión de compra.
        globalWastePct: 0,
        safetyMarginPct: 0,
        respectOwnership: Boolean(input.clientId),
        includeRemnants: true,
        lines: [
          {
            productId: input.productId,
            bomId: input.bomId,
            quantity: input.quantity,
            sizeId: input.sizeId,
            // La salida no distingue variantes: se surte por material.
            variantId: undefined,
          },
        ],
      });

      return requirements;
    },
  });
}
