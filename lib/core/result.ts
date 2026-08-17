/**
 * Resultado de una Server Action.
 *
 * Son objetos PLANOS a propósito, no clases: cruzan la frontera
 * servidor → cliente y React sólo serializa datos. Una instancia de clase
 * llegaría al navegador convertida en un objeto sin métodos.
 *
 * Es una unión discriminada por `success`, así que después de un `if`
 * TypeScript ya sabe si hay `data` o hay `error`.
 */
export type ActionResult<T = void> =
  | { success: true; data: T; message?: string }
  | {
      success: false;
      error: string;
      code: string;
      /** Campo del formulario a marcar en rojo, si el error apunta a uno. */
      field?: string;
    };

export function ok<T>(data: T, message?: string): ActionResult<T> {
  return { success: true, data, message };
}

export function fail(
  error: string,
  code = "ERROR",
  field?: string,
): ActionResult<never> {
  return { success: false, error, code, field };
}

/**
 * Type guard: estrecha el tipo al ramo exitoso.
 *
 * Sirve para no repetir `result.success === true` en cada componente y
 * para que TypeScript exponga `data` sin castear.
 */
export function isOk<T>(
  result: ActionResult<T>,
): result is { success: true; data: T; message?: string } {
  return result.success;
}
