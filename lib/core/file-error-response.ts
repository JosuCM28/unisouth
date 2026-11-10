import {
  DomainError,
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
} from "@/lib/core/errors";

const STATUS_BY_ERROR: [new (...args: never[]) => DomainError, number][] = [
  [UnauthorizedError, 401],
  [ForbiddenError, 403],
  [NotFoundError, 404],
];

/**
 * Una ruta que devuelve un archivo —PDF o Excel— no tiene `executeAction` que
 * traduzca el error: sin esto, "no es tu vale" saldría como un 500 genérico.
 */
export function fileErrorResponse(error: unknown): Response {
  if (!(error instanceof DomainError)) throw error;

  const match = STATUS_BY_ERROR.find(([type]) => error instanceof type);
  return new Response(error.message, {
    status: match ? match[1] : 400,
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
