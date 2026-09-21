import Link from "next/link";
import { MessageSquare } from "lucide-react";
import type { CuttingOrderStatus } from "@prisma/client";
import {
  CUTTING_ORDER_STATUS_LABELS,
  CUTTING_ORDER_STATUS_STYLES,
} from "@/lib/constants/labels";
import { cn, cutTotals, formatDate } from "@/lib/utils";
import { OrderDeleteButton } from "./order-delete-button";

/** Lo mínimo que la tarjeta necesita saber de una orden. */
export interface OrderListEntry {
  id: string;
  code: string;
  status: CuttingOrderStatus;
  description: string | null;
  reference: string | null;
  orderedAt: Date;
  dueDate: Date | null;
  client: { name: string } | null;
  material: { name: string } | null;
  /**
   * La tela apuntada a mano, cuando no existe en el catálogo.
   *
   * Convive con `material` porque el pedido no espera al alta del material:
   * se escribe el nombre y se sigue. Para pintarla, usa `orderFabric`.
   */
  cutFabricText: string | null;
  lines: Array<{ orderedQuantity: number; cutQuantity: number }>;
  /**
   * Cuántos comentarios internos trae.
   *
   * Opcional porque no toda lista los pide, y ausente se lee como cero: una
   * pantalla que no los consulta no debe pintar un contador en blanco.
   */
  _count?: { comments: number };
  /**
   * Cuándo se jaló al concentrado de la casa.
   *
   * Opcional porque sólo el módulo de la otra planta lo pregunta: las órdenes
   * de acá nacen agregadas y pintar ese semáforo en Órdenes sería un chip
   * verde idéntico en cada renglón, que no informa nada.
   */
  addedAt?: Date | null;
}

/**
 * Con qué tela se corta la orden.
 *
 * El material del catálogo manda; si no lo hay, se cae a la tela escrita a
 * mano. Sin esa caída la columna sale vacía en órdenes que SÍ tienen tela,
 * sólo que capturada como texto porque todavía no existe como material.
 */
export function orderFabric(
  order: Pick<OrderListEntry, "material" | "cutFabricText">,
): string | null {
  if (order.material) return order.material.name;
  const handwritten = order.cutFabricText?.trim();
  return handwritten ? handwritten : null;
}

interface Props {
  order: OrderListEntry;
  /** Pedido al que pertenece. Sólo se pinta donde no sea obvio. */
  folderName?: string | null;
  /**
   * A dónde lleva la tarjeta al picarla.
   *
   * El módulo de la otra planta pinta LAS MISMAS órdenes pero su ficha vive
   * en otra ruta: sin esto, quien captura allá abajo acababa en `/orders`, que
   * no tiene permiso de abrir.
   */
  basePath?: string;
  /**
   * El semáforo de agregada y su botón. Sólo lo manda el módulo de planta.
   *
   * Llega ya construido y no como datos: así la tarjeta no tiene que saber
   * nada de pedidos ni de permisos para pintarlo.
   */
  adoptSlot?: React.ReactNode;
  /**
   * Si se ofrece borrar la orden.
   *
   * Por omisión NO, para que quien sólo consulta nunca vea el bote de basura
   * aunque una pantalla nueva se olvide de pasarlo.
   */
  canWrite?: boolean;
}

/**
 * Una orden en una lista.
 *
 * Vive aparte porque la pintan dos pantallas —la lista general y la ficha del
 * pedido— y si cada una la dibujara por su cuenta acabarían mostrando cosas
 * distintas de la misma orden.
 */
export function OrderListItem({
  order,
  folderName,
  basePath = "/orders",
  adoptSlot,
  canWrite = false,
}: Props) {
  /* Talla por talla: con el neto, las 67 piezas que sobran de la 32 se comían
     67 de las que faltan de la 34 y la tarjeta enseñaba un pendiente menor al
     real. Lo que falta es EL número de esta lista y no puede venir descontado
     por un excedente. */
  const { ordered, cut, pending, surplus } = cutTotals(order.lines);
  // Sin nada pendiente, el excedente toma el lugar del número grande.
  const onlySurplus = pending === 0 && surplus > 0;
  const commentCount = order._count?.comments ?? 0;
  const fabric = orderFabric(order);

  return (
    <div className="flat-surface relative flex flex-col gap-2 p-3 transition-colors active:bg-accent">
      {/* El enlace va como capa sobre toda la tarjeta en vez de envolverla:
          un <button> dentro de un <a> no es HTML válido, y el botón de borrar
          tiene que quedar fuera del área que navega. */}
      <Link
        href={`${basePath}/${order.id}`}
        className="absolute inset-0 z-10"
        aria-label={`Abrir ${order.code}`}
      />

      <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="tabular text-sm font-medium">{order.code}</span>
          <span
            className={cn(
              "rounded px-1.5 py-0.5 text-xs",
              CUTTING_ORDER_STATUS_STYLES[order.status],
            )}
          >
            {CUTTING_ORDER_STATUS_LABELS[order.status]}
          </span>
        </div>

        <p className="truncate text-sm">
          {order.description ?? "Sin descripción"}
        </p>

        <p className="truncate text-xs text-muted-foreground">
          {order.client?.name ?? "Sin cliente"}
          {fabric && ` · ${fabric}`}
          {` · ${formatDate(order.orderedAt)}`}
        </p>

        <div className="mt-1 flex flex-wrap items-center gap-1.5">
          {folderName && (
            <span className="rounded border border-border px-1.5 py-0.5 text-xs text-muted-foreground">
              {folderName}
            </span>
          )}

          {order.reference && (
            <span className="tabular rounded border border-border px-1.5 py-0.5 text-xs text-muted-foreground">
              Ref. {order.reference}
            </span>
          )}

          {/* Que la orden trae notas de planeación, sin sacarlas a la lista:
              son internas y a veces largas. Lo que resuelve el chip es saber
              cuáles ya se planearon sin abrirlas una por una. */}
          {commentCount > 0 && (
            <span className="flex items-center gap-1 rounded border border-border px-1.5 py-0.5 text-xs text-muted-foreground">
              <MessageSquare className="size-3" aria-hidden />
              <span className="tabular">{commentCount}</span>
              <span className="sr-only">
                {commentCount === 1
                  ? "comentario interno"
                  : "comentarios internos"}
              </span>
            </span>
          )}

          {/* La entrega se destaca en rojo si ya se pasó y la orden sigue
              abierta: es lo que convierte la lista en una alerta y no en un
              archivo. */}
          {order.dueDate && (
            <span
              className={cn(
                "tabular rounded border px-1.5 py-0.5 text-xs",
                isLate(order.dueDate, pending)
                  ? "border-state-defective text-state-defective"
                  : "border-border text-muted-foreground",
              )}
            >
              Entrega {formatDate(order.dueDate)}
            </span>
          )}
        </div>
      </div>

      {/* Lo que falta es el número que se busca al abrir la lista. Sin nada
          pendiente, el excedente pasa a ser el dato: un cero escondería que
          sobran piezas. Y si hay de las dos, el excedente va DEBAJO del
          faltante en vez de reemplazarlo —ninguno de los dos se tapa—. */}
      <div className="flex shrink-0 items-start gap-1">
        <div className="text-right">
          <p
            className={cn(
              "tabular text-lg font-bold leading-none",
              onlySurplus && "text-state-remnant",
            )}
          >
            {onlySurplus ? `+${surplus}` : pending}
          </p>
          <p className="tabular text-xs text-muted-foreground">
            {onlySurplus ? "sobran" : `de ${ordered}`}
          </p>
          {pending > 0 && surplus > 0 && (
            <p className="tabular text-xs text-state-remnant">
              +{surplus} sobran
            </p>
          )}
          {/* Cuánto se lleva cortado: sin esto, "faltan 300" no distingue una
              orden recién abierta de una casi lista. */}
          <p className="tabular mt-0.5 text-xs text-muted-foreground">
            {cut} cortadas
          </p>
        </div>

        {/* Por encima de la capa del enlace, o el toque abriría la orden. */}
        {canWrite && (
          <OrderDeleteButton
            orderId={order.id}
            orderCode={order.code}
            cutQuantity={cut}
            className="relative z-20"
          />
        )}
      </div>
      </div>

      {/* El semáforo del concentrado, en su propio renglón y por encima de la
          capa del enlace: lleva un botón, y dentro del área que navega el
          toque abriría la orden en vez de agregarla. */}
      {adoptSlot && (
        <div className="relative z-20 flex flex-wrap items-center gap-2 border-t border-border pt-2">
          {adoptSlot}
        </div>
      )}
    </div>
  );
}

/**
 * ¿Se pasó la fecha de entrega con trabajo pendiente?
 *
 * Se exige que FALTE algo: una orden entregada tarde pero ya terminada no
 * necesita alarma, y pintarla de rojo para siempre haría que el color dejara
 * de significar "hay que correr".
 */
function isLate(dueDate: Date, pending: number): boolean {
  return pending > 0 && dueDate.getTime() < Date.now();
}
