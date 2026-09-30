"use server";

import { executeAction } from "@/lib/core/action-handler";
import { returnFabricSchema } from "@/lib/validations/order-fabric.schema";
import { OrderFabricService } from "@/lib/services/order-fabric.service";

/**
 * Regresar tela de una orden al almacén.
 *
 * Pide `inventory:write`: es lo mismo que aplicar cualquier vale de entrada.
 * Revalida también /lots y /documents porque el saldo del rollo y el vale
 * nuevo tienen que verse sin recargar.
 */
export async function returnOrderFabricAction(input: unknown) {
  return executeAction(input, {
    schema: returnFabricSchema,
    permission: "inventory:write",
    revalidate: ["/orders", "/lots", "/documents", "/issues", "/dashboard"],
    successMessage: "Devolución registrada",
    handler: ({ input, auditContext }) =>
      new OrderFabricService(auditContext).returnFabric(input),
  });
}
