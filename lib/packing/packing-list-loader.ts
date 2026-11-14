import { roleHasPermission } from "@/lib/constants/roles";
import { ForbiddenError, NotFoundError } from "@/lib/core/errors";
import { requireUser } from "@/lib/core/session";
import { PackingRepository } from "@/lib/repositories/packing.repository";
import { toPackingList, type PackingList } from "./packing-list";

/**
 * La barrera y la lectura que comparten las dos descargas: quien ve los
 * pedidos (`finished-goods:browse`) baja su packing list, y nadie más.
 */
export async function loadPackingList(id: string): Promise<PackingList> {
  const user = await requireUser();
  if (!roleHasPermission(user.role, "finished-goods:browse")) throw new ForbiddenError();

  const order = await new PackingRepository().findDetail(id);
  if (!order) throw new NotFoundError("el pedido de empaque");
  return toPackingList(order);
}
