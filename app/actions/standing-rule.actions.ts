"use server";

import { z } from "zod";
import { executeAction } from "@/lib/core/action-handler";
import { cuidSchema, removeSchema } from "@/lib/validations/common";
import { standingRuleSchema } from "@/lib/validations/standing-rule.schema";
import { StandingRuleService } from "@/lib/services/standing-rule.service";
import {
  StandingRuleRepository,
  type StandingRuleWithClient,
} from "@/lib/repositories/standing-rule.repository";

/* La salida se revalida porque ahí se muestran las reglas del cliente al
   capturar: si se acaba de corregir una, el vale que se está armando tiene
   que verla ya corregida y no la versión vieja en caché. */
const REVALIDATE = ["/rules", "/issues", "/issues/new"];

const updateStandingRuleSchema = z.object({
  id: cuidSchema,
  data: standingRuleSchema,
});

const toggleSchema = z.object({ id: cuidSchema, active: z.boolean() });

export async function createStandingRuleAction(input: unknown) {
  return executeAction(input, {
    schema: standingRuleSchema, permission: "catalog:write", revalidate: REVALIDATE,
    successMessage: "Regla registrada",
    handler: ({ input, auditContext }) => new StandingRuleService(auditContext).create(input),
  });
}

export async function updateStandingRuleAction(input: unknown) {
  return executeAction(input, {
    schema: updateStandingRuleSchema, permission: "catalog:write", revalidate: REVALIDATE,
    successMessage: "Regla actualizada",
    handler: ({ input, auditContext }) => new StandingRuleService(auditContext).update(input.id, input.data),
  });
}

/** Apagar es lo normal para dejar de verla; borrar es para las que sobran. */
export async function toggleStandingRuleAction(input: unknown) {
  return executeAction(input, {
    schema: toggleSchema, permission: "catalog:write", revalidate: REVALIDATE,
    handler: ({ input, auditContext }) => new StandingRuleService(auditContext).toggle(input.id, input.active),
  });
}

export async function removeStandingRuleAction(input: unknown) {
  return executeAction(input, {
    schema: removeSchema, permission: "catalog:write", revalidate: REVALIDATE,
    successMessage: "Regla eliminada",
    handler: ({ input, auditContext }) => new StandingRuleService(auditContext).remove(input.id, input.reason),
  });
}

const applicableSchema = z.object({
  /** Vacío = todavía no se sabe de quién es el trabajo. */
  clientId: z.union([cuidSchema, z.literal("")]).optional(),
});

/**
 * Las reglas que aplican al trabajo que se está capturando.
 *
 * Es una action y no una lectura del Server Component porque la empresa se
 * elige DESPUÉS de que la pantalla cargó: no hay forma de resolver de
 * antemano las reglas de un cliente que todavía no se sabe cuál es.
 *
 * De sólo lectura: no escribe nada, por eso pide `inventory:read`.
 */
export async function applicableRulesAction(input: unknown) {
  return executeAction(input, {
    schema: applicableSchema,
    permission: "inventory:read",
    handler: ({ input }): Promise<StandingRuleWithClient[]> =>
      new StandingRuleRepository().findApplicable(input.clientId || undefined),
  });
}
