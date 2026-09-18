"use client";

import {
  OrderTable,
  type OrderTableRow,
} from "@/components/orders/order-table";
import type { OrderOption } from "@/components/orders/order-form";
import { PlantAdoptControl } from "./plant-adopt-control";

interface Props {
  orders: OrderTableRow[];
  server: {
    page: number;
    totalPages: number;
    total: number;
    pageSize: number;
  };
  /** Los pedidos vivos de la casa, para elegir a cuál entra la orden. */
  folders: OrderOption[];
  /** Si se pintan los botones de agregar y quitar. Sólo con `plant-orders:adopt`. */
  canAdopt?: boolean;
  isFiltered?: boolean;
}

/**
 * Las órdenes de la otra planta, con su semáforo del concentrado.
 *
 * Es una envoltura de cliente sobre `OrderTable` y no una tabla nueva. Existe
 * por una razón concreta: la columna del semáforo se pasa como FUNCIÓN, y una
 * función no cruza de un Server Component a uno de cliente —React sólo
 * serializa datos—. Aquí, ya del lado del cliente, se puede construir.
 *
 * Lo que se gana: las trece columnas, el orden, la paginación y las tarjetas
 * de celular son literalmente las mismas que las de Órdenes. El día que a esa
 * tabla se le agregue una columna, esta pantalla la recibe sola.
 */
export function PlantOrderTable({
  orders,
  server,
  folders,
  canAdopt = false,
  isFiltered = false,
}: Props) {
  return (
    <OrderTable
      orders={orders}
      server={server}
      basePath="/plant-orders"
      showFolder={false}
      isFiltered={isFiltered}
      /* Sin `canWrite`: el bote de basura de esta tabla borra la orden entera
         y eso no es de aquí. Lo que esta pantalla ofrece es agregar y quitar
         del concentrado, que es otra cosa. */
      renderAdopt={(order) => (
        <PlantAdoptControl
          order={{
            orderId: order.id,
            orderCode: order.code,
            addedAt: order.addedAt ?? null,
            folderName: order.folderName,
          }}
          folders={folders}
          canAdopt={canAdopt}
        />
      )}
      emptyTitle={isFiltered ? "Sin resultados" : "Todavía no hay órdenes"}
      emptyDescription={
        isFiltered
          ? "Prueba con otro folio o cliente, o quita el filtro."
          : "Cuando la otra planta capture una orden, aparece aquí para que decidas si entra a tu concentrado."
      }
    />
  );
}
