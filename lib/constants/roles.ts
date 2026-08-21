/**
 * Fuente única de verdad de roles y permisos.
 *
 * `User.role` es String en la base porque el plugin admin de BetterAuth lo
 * exige. La seguridad de tipos se recupera aquí: nadie debe escribir el
 * nombre de un rol a mano en otro archivo.
 */

export const ROLES = [
  "ADMIN",
  "WAREHOUSE",
  "PRODUCTION",
  "PURCHASING",
  "MANAGEMENT",
  "READ_ONLY",
] as const;

export type Role = (typeof ROLES)[number];

/** Copia mutable, para iterar en selects sin pelear con el `readonly`. */
export const ROLE_VALUES: Role[] = [...ROLES];

export const ROLE_LABELS: Record<Role, string> = {
  ADMIN: "Administrador",
  WAREHOUSE: "Almacén",
  PRODUCTION: "Producción",
  PURCHASING: "Compras",
  MANAGEMENT: "Dirección",
  READ_ONLY: "Sólo lectura",
};

/**
 * Los permisos son capacidades, no pantallas.
 *
 * Amarrarlos a pantallas obliga a tocar la matriz cada vez que se mueve un
 * botón de lugar; amarrarlos a capacidades deja la matriz estable.
 */
export const PERMISSIONS = [
  "inventory:read",
  "inventory:write",
  "inventory:adjust",
  "catalog:write",
  "bom:write",
  "calculation:run",
  "purchase:request",
  "purchase:approve",
  "audit:read",
  "user:manage",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

export const PERMISSION_VALUES: Permission[] = [...PERMISSIONS];

/**
 * Matriz de la sección 8 del contrato.
 *
 * Todos los roles pueden leer inventario: hasta el de sólo lectura entra a
 * consultar existencias, que es el 80% del uso del sistema.
 */
export const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  // Todo, incluido usuarios y configuración.
  ADMIN: PERMISSIONS,

  /* Es quien mueve el material: entradas, salidas, cortes, conteos, ajustes.
     Llega a todo el menú salvo Auditoría —de ahí que traiga `bom:write`,
     `calculation:run` y `purchase:request`— porque en la práctica el auxiliar
     es quien detecta que falta tela y quien levanta la requisición.

     Lo que NO tiene y no debe tener:
     · `audit:read`   — la bitácora de "quién metió mano" existe para vigilar
                        justo a quien captura; que la vea el capturista la
                        vuelve inútil.
     · `purchase:approve` — pedir no es autorizar. Quien detecta el faltante no
                        firma su propia compra.
     · `user:manage`  — con esto podría subirse a ADMIN y entrar a la
                        auditoría por la puerta de atrás. */
  WAREHOUSE: [
    "inventory:read",
    "inventory:write",
    "inventory:adjust",
    "catalog:write",
    "bom:write",
    "calculation:run",
    "purchase:request",
  ],

  // Consulta inventario, mantiene fichas técnicas y corre cálculos.
  PRODUCTION: ["inventory:read", "bom:write", "calculation:run"],

  PURCHASING: ["inventory:read", "purchase:request", "purchase:approve"],

  // Dirección no captura: mira, reportea y audita.
  MANAGEMENT: ["inventory:read", "audit:read"],

  READ_ONLY: ["inventory:read"],
};

/** Convierte el String de la base a un Role válido. */
export function toRole(value: string | null | undefined): Role {
  return ROLES.includes(value as Role) ? (value as Role) : "READ_ONLY";
}

export function roleHasPermission(
  role: string | null | undefined,
  permission: Permission,
): boolean {
  return ROLE_PERMISSIONS[toRole(role)].includes(permission);
}
