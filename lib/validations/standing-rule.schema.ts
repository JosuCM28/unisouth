import { z } from "zod";
import { StandingRuleTopic } from "@prisma/client";
import { optionalCuid, optionalText, requiredText } from "./common";

/**
 * Una regla que SIEMPRE aplica. Sin empresa = regla de la casa.
 *
 * Sólo el texto es obligatorio: si para registrar "la 38 siempre lleva
 * refuerzo" hubiera que elegir cliente y clasificarla, nadie la registraría y
 * el dato seguiría viviendo en la cabeza de una sola persona.
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
 * Los opcionales son `string` porque un input vacío entrega `""`: la
 * conversión a `undefined` la hace el esquema del servidor.
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
