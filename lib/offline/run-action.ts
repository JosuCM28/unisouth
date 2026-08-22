"use client";

import type { ActionResult } from "@/lib/core/result";

/**
 * Ejecuta una Server Action sin que un fallo de red deje el formulario colgado.
 *
 * EL PROBLEMA QUE RESUELVE: una Server Action que llega al servidor SIEMPRE
 * devuelve un ActionResult, incluso cuando el dato está mal —executeAction
 * atrapa el error y responde `{success:false}`—. Pero si no hay red, la
 * promesa se RECHAZA y nunca se llega al `if (!result.success)`: el botón se
 * queda en "Guardando…" para siempre, sin toast y sin mensaje. El auxiliar no
 * sabe si guardó o no, y en una bodega con WiFi intermitente eso pasa varias
 * veces al día.
 *
 * Aquí el rechazo se convierte en un ActionResult normal, así que el
 * formulario sigue teniendo un solo camino de error que atender.
 *
 * NO ENCOLA. Es la diferencia con `submitOrQueue`: esto es para operaciones
 * que dependen de un saldo o de una ficha que no se puede releer sin
 * conexión —cortes, recuentos, traspasos, ediciones—. Mandar a ciegas un
 * corte de 50 m contra un rollo que ya sólo tiene 30 corrompería el kárdex,
 * así que fallan de frente y se reintentan con el dato a la vista.
 */
export async function runAction<T>(
  call: () => Promise<ActionResult<T>>,
): Promise<ActionResult<T>> {
  try {
    return await call();
  } catch (error) {
    // Se deja rastro en la consola porque aquí caen DOS cosas distintas: el
    // WiFi caído —lo normal en la bodega— y un bug de la propia pantalla. Al
    // usuario se le dice lo mismo en ambos casos, pero para depurar hace
    // falta poder distinguirlas.
    console.error("[runAction] La acción no llegó al servidor:", error);

    return {
      success: false,
      error:
        "No se pudo guardar. Revisa la conexión e intenta de nuevo; no se registró nada.",
      code: "NETWORK_ERROR",
    };
  }
}
