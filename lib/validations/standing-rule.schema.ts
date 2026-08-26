import { z } from "zod";
import { StandingRuleTopic } from "@prisma/client";
import { optionalCuid, optionalText, requiredText } from "./common";

/**
 * Una regla que SIEMPRE aplica.
 *
 * Sólo el texto de la regla es obligatorio. La empresa y el tema son
 * opcionales a propósito: si para registrar "la 38 siempre lleva refuerzo"
 * hubiera que elegir cliente y clasificarla, nadie la registraría y el dato
 * seguiría viviendo en la cabeza de una sola persona.
 *
 * Sin empresa = regla de la casa: aplica a todos los clientes.
 */
export const standingRuleSchema = z.object({
  title: requiredText("La regla", 200),
  detail: optionalText,
  /** Vacío = aplica a todas las empresas. */
  clientId: optionalCuid,
  topic: z.nativeEnum(StandingRuleTopic).default("GENERAL"),
  critical: z.boolean().default(false),
  active: z.boolean().default(true),
});

export type StandingRuleInput = z.infer<typeof standingRuleSchema>;

/**
 * El mismo contrato del lado del formulario.
 *
 * Los opcionales son `string` y no `string | undefined` porque un input
 * vacío entrega `""`: la conversión a `undefined` la hace el esquema del
 * servidor, que es el que escribe en la base.
 */
export const standingRuleFormSchema = z.object({
  title: z.string().trim().min(1, "Escribe la regla").max(200),
  detail: z.string().optional(),
  clientId: z.string().optional(),
  topic: z.nativeEnum(StandingRuleTopic),
  critical: z.boolean(),
  active: z.boolean(),
});

export type StandingRuleFormValues = z.infer<typeof standingRuleFormSchema>;
