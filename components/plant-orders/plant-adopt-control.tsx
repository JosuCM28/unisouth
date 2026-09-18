"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, FolderInput, Minus, Plus } from "lucide-react";
import { toast } from "sonner";
import {
  adoptPlantOrderAction,
  unadoptPlantOrderAction,
} from "@/app/actions/cutting-order.actions";
import { runAction } from "@/lib/offline/run-action";
import { cn } from "@/lib/utils";
import { ResponsiveFormDialog } from "@/components/shared/responsive-form-dialog";
import { SearchSelect } from "@/components/shared/search-select";
import { SubmitButton } from "@/components/shared/submit-button";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import type { OrderOption } from "@/components/orders/order-form";

export interface PlantAdoptState {
  orderId: string;
  orderCode: string;
  /** Con fecha ya entró al concentrado; sin ella sólo existe allá abajo. */
  addedAt: Date | null;
  /** El pedido al que entró, si entró a alguno. */
  folderName: string | null;
}

interface Props {
  order: PlantAdoptState;
  /** Los pedidos vivos de la casa, para elegir a cuál entra. */
  folders: OrderOption[];
  /**
   * Si se ofrecen los botones.
   *
   * Falso para quien captura allá abajo: ve el semáforo —necesita saber si ya
   * se la tomaron— pero no lo mueve. Esconder el botón es comodidad; la
   * barrera de verdad es `plant-orders:adopt` en `executeAction`.
   */
  canAdopt?: boolean;
}

/**
 * El semáforo de una orden de la otra planta: agregada o no, y el botón.
 *
 * Es lo único que esta pantalla hace distinto de Órdenes, así que vive en su
 * propio componente y no metido en una columna de la tabla: lo pintan la
 * tabla del escritorio y la tarjeta del celular, y si cada una lo dibujara
 * por su cuenta acabarían diciendo cosas distintas de la misma orden.
 */
export function PlantAdoptControl({ order, folders, canAdopt = false }: Props) {
  if (order.addedAt) {
    return (
      <div className="flex items-center gap-2">
        <AdoptedChip folderName={order.folderName} />
        {canAdopt && (
          <UnadoptButton orderId={order.orderId} orderCode={order.orderCode} />
        )}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <PendingChip />
      {canAdopt && <AdoptDialog order={order} folders={folders} />}
    </div>
  );
}

/**
 * "Agregado", y a qué pedido.
 *
 * El pedido va en el mismo chip y no aparte porque son la misma respuesta:
 * "sí, y está en el de Ternium de marzo". Un "Agregado" a secas obliga a
 * abrir la orden para saber dónde quedó.
 */
function AdoptedChip({ folderName }: { folderName: string | null }) {
  return (
    <span className="flex items-center gap-1 rounded bg-state-available px-1.5 py-0.5 text-xs text-state-available-foreground">
      <Check className="size-3.5 shrink-0" aria-hidden />
      Agregado
      {folderName && <span className="truncate">· {folderName}</span>}
    </span>
  );
}

function PendingChip() {
  return (
    <span className="rounded border border-border px-1.5 py-0.5 text-xs text-muted-foreground">
      No agregado
    </span>
  );
}

/**
 * Jala la orden al concentrado, eligiendo a qué pedido entra.
 *
 * El pedido es OPCIONAL: se puede agregar sin elegir carpeta y la orden queda
 * suelta en Órdenes, igual que cualquiera de la casa. Obligarlo forzaría a
 * inventar un pedido para poder tomar una orden que todavía no se sabe con
 * cuáles se va a tender.
 */
function AdoptDialog({
  order,
  folders,
}: {
  order: PlantAdoptState;
  folders: OrderOption[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [folderId, setFolderId] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  async function handleAdopt() {
    setIsSaving(true);
    const result = await runAction(() =>
      adoptPlantOrderAction({
        id: order.orderId,
        folderId: folderId || undefined,
      }),
    );
    setIsSaving(false);

    if (!result.success) {
      toast.error(result.error);
      return;
    }

    toast.success(
      folderId ? "Orden agregada al pedido" : "Orden agregada, sin pedido",
    );
    setOpen(false);
    setFolderId("");
    router.refresh();
  }

  return (
    <ResponsiveFormDialog
      open={open}
      onOpenChange={setOpen}
      title={`Agregar ${order.orderCode}`}
      description="Entra a tus Órdenes y su concentrado la suma. Sigue siendo la misma orden: si allá corrigen una talla, aquí se refleja."
      trigger={
        <Button size="sm" className="touch-target shrink-0">
          <Plus className="size-4" aria-hidden />
          Agregar
        </Button>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="adopt-folder">Pedido</Label>
          <SearchSelect
            id="adopt-folder"
            options={folders.map((folder) => ({
              value: folder.id,
              label: folder.name,
              hint: folder.hint,
              keywords: folder.hint,
            }))}
            value={folderId}
            onChange={setFolderId}
            placeholder="Sin pedido"
            searchPlaceholder="Buscar pedido…"
            clearLabel="Sin pedido"
          />
          <p className="text-xs text-muted-foreground">
            El concentrado de ese pedido la suma como una columna más. Si lo
            dejas vacío, la orden queda suelta y la acomodas después.
          </p>
        </div>

        <SubmitButton
          isSubmitting={isSaving}
          onClick={handleAdopt}
          className="h-12 w-full"
        >
          <FolderInput className="size-5" aria-hidden />
          Agregar al concentrado
        </SubmitButton>
      </div>
    </ResponsiveFormDialog>
  );
}

/**
 * Deshace el agregado.
 *
 * El servidor lo rechaza en cuanto la orden ya trabajó aquí —corte capturado
 * o vale firmado—, así que este botón se pinta siempre y el error explica por
 * qué no se pudo. Calcular esa condición en la lista obligaría a bajar los
 * cortes y los vales de cada renglón para esconder un botón que casi nunca se
 * pica.
 */
function UnadoptButton({
  orderId,
  orderCode,
}: {
  orderId: string;
  orderCode: string;
}) {
  const router = useRouter();
  const [isSaving, setIsSaving] = useState(false);

  async function handleUnadopt() {
    setIsSaving(true);
    const result = await runAction(() => unadoptPlantOrderAction({ id: orderId }));
    setIsSaving(false);

    if (!result.success) {
      toast.error(result.error);
      return;
    }

    toast.success(`${orderCode} salió del concentrado`);
    router.refresh();
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className={cn("touch-target shrink-0", isSaving && "opacity-50")}
      disabled={isSaving}
      onClick={handleUnadopt}
      aria-label={`Quitar ${orderCode} del concentrado`}
      title="Quitar del concentrado"
    >
      <Minus className="size-4" aria-hidden />
    </Button>
  );
}
