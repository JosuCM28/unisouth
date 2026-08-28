/**
 * Tope de filas de un archivo exportado.
 *
 * Alto y explícito, no el de la paginación. La lista en pantalla se topa en
 * 100 filas porque nadie recorre más con el pulgar, pero un Excel que corta en
 * la fila 100 MIENTE por omisión: quien lo recibe por correo no tiene forma de
 * saber que le faltan rollos, y toma decisiones con un inventario incompleto.
 *
 * 5,000 cubre el almacén completo con margen, Excel lo abre sin quejarse y la
 * consulta no ahoga la conexión. Si se alcanza, el archivo lo dice en su
 * última fila en vez de callarse.
 */
export const EXPORT_ROW_LIMIT = 5000;
