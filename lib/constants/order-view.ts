/** Las pestañas de Órdenes: las órdenes sueltas o los pedidos. */
export type OrderView = "orders" | "folders";

/** Lo que va en la URL: en español, porque es lo que se lee en la barra. */
export const ORDER_VIEW_PARAMS: Record<OrderView, string> = {
  orders: "sueltas",
  folders: "pedidos",
};

/**
 * Viene de la URL: lo que no se reconozca abre las órdenes. Los pedidos no
 * son lo primero que se busca al entrar; se piden con la pestaña.
 */
export function parseOrderView(value: string | undefined): OrderView {
  return value === ORDER_VIEW_PARAMS.folders ? "folders" : "orders";
}
