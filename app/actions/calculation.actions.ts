"use server";

import { executeAction } from "@/lib/core/action-handler";
import { calculationFormSchema } from "@/lib/validations/calculation.schema";
import { CalculationService } from "@/lib/services/calculation.service";

/**
 * Corre el motor de cálculo y guarda el snapshot.
 *
 * Exige `calculation:run`: correr un cálculo no mueve inventario, pero sí
 * decide qué se compra.
 */
export async function runCalculationAction(input: unknown) {
  return executeAction(input, {
    schema: calculationFormSchema,
    permission: "calculation:run",
    revalidate: ["/calculations", "/dashboard"],
    successMessage: "Cálculo generado",
    handler: ({ input, auditContext }) =>
      new CalculationService(auditContext).run(input),
  });
}
