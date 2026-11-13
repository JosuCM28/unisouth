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
  "WORKSHOP_ACATLAN",
  "WORKSHOP_SITEX",
  "WORKSHOP_BRODERIE",
  "WORKSHOP_ALLENDE",
  "SHIPPING",
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
  WORKSHOP_ACATLAN: "Taller Acatlán",
  WORKSHOP_SITEX: "Taller Sitex",
  WORKSHOP_BRODERIE: "Taller Broderie",
  WORKSHOP_ALLENDE: "Taller Allende",
  SHIPPING: "Embarques",
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
  /* Ver las órdenes de corte y cómo van: qué pidió el cliente, cuánto se ha
     cortado en cada tanda y qué falta.

     Se separó de `inventory:browse` porque hay quien entra SÓLO a mirar el
     avance —quien contesta el teléfono cuando el cliente pregunta por su
     pedido— y no tiene nada que hacer en los rollos, los catálogos ni los
     documentos. Mientras las órdenes pidieron `inventory:browse`, abrir esa
     pantalla obligaba a abrir de pilón los otros trece destinos que cuelgan
     de la misma llave. */
  "orders:browse",
  /* El módulo de la OTRA PLANTA: sus órdenes de corte, capturadas allá.

     Va aparte de `orders:browse` porque son dos pantallas de públicos
     opuestos. Allá abajo capturan lo suyo y no tienen por qué ver el pedido
     de Ternium que se está cortando acá; y quien contesta el teléfono aquí
     mira las órdenes de la casa sin que le aparezca el trabajo de la otra
     planta mezclado. */
  "plant-orders:browse",
  "plant-orders:write",
  /* Jalar una orden de la otra planta al concentrado de la casa.

     Llave propia y no `inventory:write`: la otra planta SÍ escribe —captura
     sus órdenes— pero no decide qué se corta aquí. Si "agregar" colgara de
     la misma llave con la que capturan, se meterían solos al concentrado. */
  "plant-orders:adopt",
  "inventory:write",
  /* Capturar cortes en una orden: abrir el corte, meter sus tallas y
     registrar avance por talla. Se separó de `inventory:write` porque
     Producción cuenta lo que se corta en la mesa pero no mueve el almacén:
     con `inventory:write` también podría editar, cancelar o mandar la orden
     a Salidas. */
  "cuts:write",
  /* Corregir los cortes de una orden YA TERMINADA sin pedir permiso, y
     autorizar o rechazar a quien lo pide. Sólo ADMIN: si la llevara quien
     captura, el candado de la orden terminada se lo abriría él mismo. */
  "cuts:unlock",
  /* Consultar el catálogo de Prendas. Va aparte de `inventory:browse` por la
     misma razón que `orders:browse`: esa llave abre de golpe rollos,
     catálogos y documentos, y Producción sólo necesita mirar las prendas. */
  "garments:browse",
  "inventory:adjust",
  "catalog:write",
  /* El marco de CÓMO se produce: ficha técnica, escalado de tallas, folio del
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
  /* A quién le llega el vale y por dónde: los números de WhatsApp, los
     correos y qué canales están prendidos. Sólo la administra ADMIN: esos
     destinatarios reciben datos del cliente, y quien captura puede MANDAR el
     vale al aplicarlo —eso cuelga de `inventory:write`— pero no decidir a
     quién le llega. */
  "notifications:write",
  /* La copia de la base en el navegador para trabajar sin internet: bajarla,
     ver qué quedó pendiente de subir y borrarla del equipo. La llevan
     ADMIN y WAREHOUSE. Esta llave dice "puede usar la copia", NO "puede ver todas las
     tablas": cada tabla se sigue cobrando con la llave de su pantalla (ver
     OFFLINE_TABLE_PERMISSIONS), así que dársela a otro rol nunca le enseña
     más de lo que ya ve en línea. */
  "offline:manage",
  /* Las entregas que le mandaron a UN taller: verlas, reimprimir su vale y
     confirmar que llegaron. Qué taller es lo decide el rol de quien entra, y
     el filtro por taller se aplica en el servidor en cada lectura. */
  "workshop-orders:access",
  /* Capturar la SALIDA de un taller: lo que saca de su saldo —piezas
     bordadas hacia otro taller, o de regreso a planta— y cancelarla con
     motivo. Aparte de `workshop-orders:access` porque ver y confirmar lo que
     llega no es lo mismo que declarar lo que sale; un taller de sólo
     consulta mañana no tendría por qué poder sacar piezas. Igual que
     aquélla, ADMIN no la lleva: la salida se le carga al taller del rol que
     entra, y ADMIN no es un taller. */
  "workshop-output:write",
  /* El inventario de PRENDA TERMINADA de Embarques: verlo y leer su kárdex.
     Aparte de `inventory:browse` porque son dos bodegas distintas —tela del
     cliente contra prenda lista para empacar— y quien empaca no tiene nada
     que hacer entre los rollos, ni el auxiliar entre las cajas. */
  "finished-goods:browse",
  /* Entradas y salidas MANUALES de prenda terminada, siempre con motivo: la
     carga inicial de lo que ya estaba en la bodega y los reconteos. Aparte de
     ver porque mover un saldo sin papel detrás es lo que se vigila. */
  "finished-goods:adjust",
  /* Un tablero por taller, con llave propia cada uno: son pantallas distintas
     y uno no tiene por qué ver el del otro. */
  "workshop-board:acatlan",
  "workshop-board:sitex",
  "workshop-board:broderie",
  "workshop-board:allende",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

export const PERMISSION_VALUES: Permission[] = [...PERMISSIONS];

/**
 * Matriz de la sección 8 del contrato.
 */
export const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  /* Todo, incluido usuarios y configuración, menos ser un taller: la lista de
     entregas se arma con el taller del rol que entra y ADMIN no tiene uno. Lo
     que confirman los talleres lo ve en la ficha de cada orden. */
  ADMIN: PERMISSIONS.filter(
    (permission) =>
      permission !== "workshop-orders:access" &&
      permission !== "workshop-output:write",
  ),

  /* Es quien MUEVE EL MATERIAL, y nada más: recibe, acomoda, surte y
     documenta. Su menú son doce destinos —Tablero, Inventario, Escanear,
     Tareas, Materiales, Prendas, Ubicaciones, Clientes, Proveedores,
     Recepciones, Salidas y Órdenes— y dentro de ellos puede todo:
     dar de alta rollos, cortar, recontar, ajustar y mantener los catálogos
     que se eligen al capturar.

     Lo que NO tiene y por qué:
     · `production:browse/write` — no decide cómo se hace la prenda. Fichas
                        técnicas, tallas, folios, talleres, reglas y
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
    "orders:browse",
    "inventory:write",
    "cuts:write",
    "garments:browse",
    "inventory:adjust",
    "catalog:write",
    /* Es quien trabaja sin señal en el piso, así que es quien necesita la
       copia en su celular. No le enseña nada nuevo: cada tabla se sigue
       cobrando con la llave de su pantalla en línea. */
    "offline:manage",
  ],

  /* Igual que Sólo lectura —mira las órdenes de corte completas y nada
     más— con dos añadidos: captura cortes en cada orden (`cuts:write`) y
     consulta el catálogo de Prendas (`garments:browse`, sólo lectura: editarlo
     exige `catalog:write`, que no lleva).

     Antes veía casi todo el almacén y los reportes. Se recortó porque quien
     corta en la mesa no necesita recorrer rollos ni kárdex, y `cuts:write`
     existe aparte de `inventory:write` justo para que capture el corte sin
     poder editar, cancelar ni mandar la orden a Salidas. */
  PRODUCTION: ["orders:browse", "cuts:write", "garments:browse"],

  PURCHASING: [
    "inventory:read",
    "inventory:browse",
    "garments:browse",
    "orders:browse",
    "production:browse",
    "reporting:read",
    "staff:browse",
    "purchase:request",
    "purchase:approve",
  ],

  /* SEIS destinos: Órdenes, Órdenes de planta y los cuatro tableros de
     taller. Nada más.

     Es el rol de la OTRA PLANTA. Mira cómo van los pedidos de la casa igual
     que Sólo lectura —las pantallas de ver piden `orders:browse` y las de
     escribir `inventory:write`, que no lleva, así que ahí dentro no se le
     pinta un solo botón de captura— y captura lo suyo en su propio módulo.

     Lo que PERDIÓ y por qué. Escanear, Tareas, Cálculo y Ayudantes eran de
     cuando este rol era "Dirección" y vivía de este lado. Ahora es quien
     trabaja allá abajo: no toca rollos de esta bodega, no mueve el pizarrón
     de este almacén, no corre cálculos contra este inventario y el padrón de
     ayudantes de descarga no es suyo. Dejarle esas llaves era darle escritura
     sobre la operación de una planta en la que no está.

     NO lleva `plant-orders:adopt`: jalar una orden al concentrado de la
     casa es decidir qué se tiende en la mesa de acá, y eso es de quien
     administra el almacén. Si colgara de la misma llave con la que captura,
     se agregaría solo.

     Tampoco lleva `audit:read`: la bitácora queda sólo en ADMIN.

     Los cuatro tableros de taller, en SÓLO LECTURA: ve qué se le mandó a
     cada taller y si ya lo confirmó, como ADMIN. No puede confirmar nada por
     dos candados: el botón sólo se pinta al taller dueño del tablero
     (`isOwner`), y la acción de recibir pide `workshop-orders:access`, que
     este rol no lleva. */
  MANAGEMENT: [
    "orders:browse",
    "plant-orders:browse",
    "plant-orders:write",
    "workshop-board:acatlan",
    "workshop-board:sitex",
    "workshop-board:broderie",
    "workshop-board:allende",
  ],

  /* Una sola pantalla: las órdenes de corte, y de ahí no se mueve.

     Es el rol del que entra a MIRAR cómo va un pedido —cuánto se cortó, qué
     falta, qué ya salió a taller— sin tener nada que ver con la operación del
     almacén. Por eso no lleva `inventory:browse`: esa llave abre de golpe
     rollos, catálogos, recepciones, salidas y documentos, y aquí la idea es
     justo la contraria.

     Tampoco lleva `inventory:write`, que es lo que hace que la pantalla se
     pinte sin un solo botón de captura: ve la orden completa —tallas, cortes,
     envíos, comentarios— y no puede tocar nada. La barrera real sigue siendo
     `executeAction`; esconder los botones sólo evita ofrecerle lo que le va a
     rebotar. */
  READ_ONLY: ["orders:browse"],

  /* Un taller externo: sus entregas y su tablero, nada más. Sin
     `orders:browse` a propósito: esa llave abre TODAS las órdenes de la casa,
     de todos los clientes, y aquí sólo debe verse lo que le mandaron a él. */
  WORKSHOP_ACATLAN: ["workshop-orders:access", "workshop-output:write", "workshop-board:acatlan"],
  WORKSHOP_SITEX: ["workshop-orders:access", "workshop-output:write", "workshop-board:sitex"],
  WORKSHOP_BRODERIE: ["workshop-orders:access", "workshop-output:write", "workshop-board:broderie"],
  WORKSHOP_ALLENDE: ["workshop-orders:access", "workshop-output:write", "workshop-board:allende"],

  /* EMBARQUES: la prenda terminada que mandan los talleres de confección,
     las cajas y el packing list. Nada del almacén de tela, ni órdenes, ni
     tableros de taller: su trabajo empieza cuando la prenda ya está hecha. */
  SHIPPING: ["finished-goods:browse", "finished-goods:adjust"],
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
