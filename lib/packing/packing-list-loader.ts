import { roleHasPermission } from "@/lib/constants/roles";
import { ForbiddenError, NotFoundError } from "@/lib/core/errors";
import { requireUser } from "@/lib/core/session";
import { PackingRepository } from "@/lib/repositories/packing.repository";
import { PackingListSheetRepository } from "@/lib/repositories/packing-list-sheet.repository";
import { dataFromOrder, dataFromSheet } from "./packing-list-data";
import { toPackingList, type PackingList } from "./packing-list";

/**
 * La barrera y la lectura que comparten las dos descargas: quien ve los
 * pedidos (`finished-goods:browse`) baja su packing list, y nadie más.
 *
 * Sale lo GUARDADO si alguien lo editó; si no, lo que dicen las cajas.
 */
export async function loadPackingList(id: string): Promise<PackingList> {
  const user = await requireUser();
  if (!roleHasPermission(user.role, "finished-goods:browse")) throw new ForbiddenError();

  const [order, sheet] = await Promise.all([
    new PackingRepository().findDetail(id),
    new PackingListSheetRepository().findByOrder(id),
  ]);
  if (!order) throw new NotFoundError("el pedido de empaque");

  const data = sheet ? dataFromSheet(sheet) : dataFromOrder(order, user.name ?? null);
  return toPackingList(order, data);
}
