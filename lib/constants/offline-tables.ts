import { roleHasPermission, type Permission } from "./roles";

/**
 * Las tablas que se copian al navegador para trabajar sin internet.
 *
 * El orden importa: es el orden en que se descargan y se muestran. Primero
 * los catálogos y al final lo que apunta a ellos (rollos, recepciones,
 * salidas, órdenes), para que una descarga interrumpida a la mitad deje al
 * menos los catálogos completos y no rollos que apuntan a un material que
 * todavía no llegó.
 */
export const OFFLINE_TABLES = [
  "materials",
  "sizes",
  "cutTags",
  "workshops",
  "locations",
  "clients",
  "suppliers",
  "lots",
  "receipts",
  "issues",
  "orders",
] as const;

export type OfflineTable = (typeof OFFLINE_TABLES)[number];

/**
 * Qué llave hace falta para bajarse cada tabla. Basta con UNA de la lista.
 *
 * La copia local nunca puede enseñar más de lo que la pantalla en línea ya
 * enseña: es el mismo dato, sólo que guardado en el celular. Por eso cada
 * tabla pide la misma llave que su pantalla.
 *
 * Tallas, folios y talleres aceptan además `inventory:write`: son pantallas
 * de producción, pero el auxiliar los ELIGE al capturar una salida a taller
 * y sin ellos el formulario offline quedaría con los selectores vacíos.
 */
export const OFFLINE_TABLE_PERMISSIONS: Record<OfflineTable, readonly Permission[]> = {
  materials: ["inventory:browse"],
  sizes: ["production:browse", "inventory:write"],
  cutTags: ["production:browse", "inventory:write"],
  workshops: ["production:browse", "inventory:write"],
  locations: ["inventory:browse"],
  clients: ["inventory:browse"],
  suppliers: ["inventory:browse"],
  lots: ["inventory:browse"],
  receipts: ["inventory:browse"],
  issues: ["inventory:browse"],
  orders: ["orders:browse"],
};

/** ¿Este rol puede bajarse esta tabla? */
export function canDownloadTable(role: string, table: OfflineTable): boolean {
  return OFFLINE_TABLE_PERMISSIONS[table].some((permission) =>
    roleHasPermission(role, permission),
  );
}

/** Las tablas que le tocan a un rol, en el orden de descarga. */
export function offlineTablesFor(role: string): OfflineTable[] {
  return OFFLINE_TABLES.filter((table) => canDownloadTable(role, table));
}

/**
 * Cuántos días hacia atrás se copian recepciones y salidas.
 *
 * Sin tope, el celular se bajaría años de historial con datos móviles. Lo
 * que se necesita en el piso sin señal es lo reciente: la recepción de esta
 * semana, la salida que se está armando. Lo viejo se consulta con señal.
 */
export const OFFLINE_HISTORY_DAYS = 90;
