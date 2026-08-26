import { revalidatePath } from "next/cache";
import { ZodError, type ZodType } from "zod";
import type { Permission } from "@/lib/constants/roles";
import { toPlainObject } from "@/lib/utils";
import { AuditService, type AuditContext } from "./audit.service";
import { DomainError } from "./errors";
import { enforceRateLimit, WRITE_LIMIT, type RateLimitOptions } from "./rate-limit";
import { fail, ok, type ActionResult } from "./result";
import { buildAuditContext, requirePermission, type CurrentUser } from "./session";

/** Lo que el handler recibe ya resuelto: datos validados y quién los manda. */
export interface ActionContext<TInput> {
  input: TInput;
  user: CurrentUser;
  audit: AuditService;
  /** Rastro de la petición (usuario, IP, equipo) para construir el servicio. */
  auditContext: AuditContext;
}

export interface ActionConfig<TInput, TOutput> {
  /** El MISMO esquema que usa el formulario. Zod valida en los dos lados. */
  schema: ZodType<TInput>;
  /** Capacidad exigida antes de ejecutar nada. */
  permission: Permission;
  /** Rutas a refrescar si todo sale bien. */
  revalidate?: string[];
  handler: (context: ActionContext<TInput>) => Promise<TOutput>;
  successMessage?: string;
  /** Límite propio. Por omisión, el de escritura. */
  rateLimit?: RateLimitOptions;
}

/**
 * Envoltura de toda Server Action.
 *
 * Concentra lo que si no se repetiría —y se olvidaría— en cada action:
 * permiso, validación, revalidación y traducción de errores. Así las actions
 * quedan en tres líneas y no pueden saltarse la autorización por descuido.
 *
 * Atrapa cualquier `DomainError` sin conocer su subclase: cada uno trae su
 * propio `code` y su propio `field`, y aquí se tratan todos igual.
 */
export async function executeAction<TInput, TOutput>(
  rawInput: unknown,
  config: ActionConfig<TInput, TOutput>,
): Promise<ActionResult<TOutput>> {
  try {
    // El límite va primero: frena el abuso automatizado sin gastar una
    // consulta a la base.
    await enforceRateLimit(
      `action:${config.permission}`,
      config.rateLimit ?? WRITE_LIMIT,
    );

    const user = await requirePermission(config.permission);

    // El formulario ya validó, pero una action es un endpoint HTTP:
    // cualquiera puede llamarla sin pasar por la interfaz.
    const input = config.schema.parse(rawInput);

    const auditContext = await buildAuditContext(user);
    const output = await config.handler({
      input,
      user,
      audit: new AuditService(auditContext),
      auditContext,
    });

    for (const path of config.revalidate ?? []) {
      revalidatePath(path);
    }

    // toPlainObject porque el resultado cruza al cliente y los Decimal de
    // Prisma no son serializables.
    return ok(toPlainObject(output) as TOutput, config.successMessage);
  } catch (error) {
    return handleError(error);
  }
}

function handleError(error: unknown): ActionResult<never> {
  // Falló el esquema: se devuelve el primer problema con su campo, para que
  // el formulario lo marque en rojo donde corresponde.
  if (error instanceof ZodError) {
    const issue = error.issues[0];
    return fail(
      issue?.message ?? "Los datos enviados no son válidos.",
      "VALIDATION_ERROR",
      issue?.path.join(".") || undefined,
    );
  }

  // Error esperado del dominio: su mensaje ya está redactado para el usuario.
  if (error instanceof DomainError) {
    return fail(error.message, error.code, error.field);
  }

  // Cualquier otra cosa es un bug o una falla de infraestructura. Se registra
  // completo en el servidor y al usuario se le da un mensaje genérico: un
  // stack trace o un error de Postgres en pantalla filtra detalles internos.
  console.error("[executeAction] Error no controlado:", error);
  return fail(
    "Ocurrió un error inesperado. Intenta de nuevo o avisa al administrador.",
    "INTERNAL_ERROR",
  );
}
