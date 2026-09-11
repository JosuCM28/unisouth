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
  /* Recorrer el inventario y sus catálogos: rollos, materiales, recepciones,
     salidas, movimientos, reportes… Se separó de `inventory:read` —que es
     consultar un dato suelto— porque Dirección entra sólo a lo suyo (escanear,
     tareas, ayudantes, cálculo) y no al grueso del almacén. Sin esta capacidad
     aparte los dos casos eran indistinguibles: 18 destinos del menú pedían
     exactamente el mismo permiso. */
  "inventory:browse",
  "inventory:write",
  "inventory:adjust",
  "catalog:write",
  /* El marco de CÓMO se produce: ficha técnica, escalado de tallas, foleo del
     corte, taller que borda, corrida de producción, las reglas fijas del
     cliente y las bodegas donde se guarda.

     Se separó de `inventory:browse` porque el auxiliar de almacén recibe,
     acomoda y surte, pero no decide cómo se hace la prenda ni dónde se
     definen las bodegas. Sin esta capacidad aparte los dos casos eran
     indistinguibles: una sola llave abría los 18 destinos. */
  "production:browse",
  "production:write",
  /* Mirar hacia atrás sobre el almacén COMPLETO: el kárdex global y los
     reportes. Es distinto de consultar el historial de un rollo concreto
     —eso vive en su ficha y basta con `inventory:browse`—: aquí se recorre
     todo junto, que es trabajo de supervisión, no de captura. */
  "reporting:read",
  /* El padrón de ayudantes de descarga. Va aparte porque no es inventario ni
     producción: es la base con la que se calcula su bonificación, y Dirección
     la administra sin recorrer el almacén. */
  "staff:browse",
  "staff:write",
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

  /* Es quien MUEVE EL MATERIAL, y nada más: recibe, acomoda, surte y
     documenta. Su menú son trece destinos —Tablero, Inventario, Escanear,
     Tareas, Materiales, Prendas, Ubicaciones, Clientes, Proveedores,
     Recepciones, Salidas, Órdenes y Documentos— y dentro de ellos puede todo:
     dar de alta rollos, cortar, recontar, ajustar y mantener los catálogos
     que se eligen al capturar.

     Lo que NO tiene y por qué:
     · `production:browse/write` — no decide cómo se hace la prenda. Fichas
                        técnicas, tallas, foleos, talleres, corridas, reglas y
                        bodegas son del lado de producción.
     · `reporting:read` — el kárdex global y los reportes son supervisión. El
                        historial del rollo que tiene en la mano lo sigue
                        viendo en su ficha, que es lo que necesita en el piso.
     · `staff:browse/write` — el padrón de ayudantes es base de bonificación.
     · `bom:write` / `calculation:run` — no edita fichas ni corre cálculos.
                        La explosión de insumos DENTRO de una salida sí la
                        hace: ésa pide `inventory:write`, porque es surtir.
     · `purchase:request` — levantar requisiciones pasó a Compras.
     · `audit:read`   — la bitácora de "quién metió mano" existe para vigilar
                        justo a quien captura; que la vea el capturista la
                        vuelve inútil.
     · `user:manage`  — con esto podría subirse a ADMIN y entrar a la
                        auditoría por la puerta de atrás. */
  WAREHOUSE: [
    "inventory:read",
    "inventory:browse",
    "inventory:write",
    "inventory:adjust",
    "catalog:write",
  ],

  /* Consulta inventario, mantiene fichas técnicas y corre cálculos. Ve el
     lado de producción y los reportes, pero no los edita: dar de alta un
     taller o una corrida sigue siendo de quien administra. */
  PRODUCTION: [
    "inventory:read",
    "inventory:browse",
    "production:browse",
    "reporting:read",
    "staff:browse",
    "bom:write",
    "calculation:run",
  ],

  PURCHASING: [
    "inventory:read",
    "inventory:browse",
    "production:browse",
    "reporting:read",
    "staff:browse",
    "purchase:request",
    "purchase:approve",
  ],

  /* Dirección tiene un menú corto y a propósito: escanear un rollo, el
     pizarrón de tareas, el padrón de ayudantes y el motor de cálculo. Ahí sí
     captura —mueve tarjetas, da de alta un ayudante, corre un cálculo—, pero
     NO recorre el almacén: sin `inventory:browse` se le caen del menú los
     destinos de rollos, catálogos y documentos, y sin `production:browse`
     tampoco ve el lado de producción.

     Tampoco lleva `audit:read`: la bitácora queda sólo en ADMIN. */
  MANAGEMENT: [
    "inventory:read",
    "inventory:write",
    "catalog:write",
    "calculation:run",
    "staff:browse",
    "staff:write",
  ],

  READ_ONLY: [
    "inventory:read",
    "inventory:browse",
    "production:browse",
    "reporting:read",
    "staff:browse",
  ],
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
