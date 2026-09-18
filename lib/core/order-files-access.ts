import type { CuttingOrderOrigin } from "@prisma/client";
import { roleHasPermission } from "@/lib/constants/roles";

/**
 * Quién puede subir o quitar archivos de una orden.
 *
 * No alcanza con una sola llave porque las órdenes son de dos plantas y quien
 * captura en cada una no tiene nada que hacer en la otra:
 *
 * · Una orden de la CASA la trabaja quien lleva este almacén, y eso es
 *   `inventory:write`.
 * · Una orden de PLANTA la captura quien está allá abajo, con
 *   `plant-orders:write` — pero también la puede tocar quien lleva este
 *   almacén, porque en cuanto se agrega al concentrado es aquí donde se
 *   corta y es aquí donde alguien fotografía el papel que llegó con el bulto.
 *
 * Lo que esto CIERRA: quien captura en planta no puede colgarle un archivo a
 * una orden de la casa. Sin esta función, darle permiso de subir sus fichas
 * le habría abierto de pilón los archivos de todas las órdenes del sistema.
 *
 * Vive en `core/` y no en el servicio porque la consultan dos rutas de API y
 * una Server Action: es una regla de acceso, y la de acceso se resuelve antes
 * de llegar al dominio.
 */
export function canWriteOrderFiles(
  role: string | null | undefined,
  origin: CuttingOrderOrigin,
): boolean {
  if (roleHasPermission(role, "inventory:write")) return true;

  return origin === "PLANT" && roleHasPermission(role, "plant-orders:write");
}
