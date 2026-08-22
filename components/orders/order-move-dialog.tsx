"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FolderInput } from "lucide-react";
import { toast } from "sonner";
import { moveOrderToFolderAction } from "@/app/actions/order-folder.actions";
import { runAction } from "@/lib/offline/run-action";
import { ResponsiveFormDialog } from "@/components/shared/responsive-form-dialog";
import { SearchSelect } from "@/components/shared/search-select";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import type { OrderOption } from "./order-form";

interface Props {
  orderId: string;
  orderCode: string;
  currentFolderId: string | null;
  folders: OrderOption[];
}

/**
 * Mueve una orden a un pedido, o la saca del que tiene.
 *
 * Existe aparte del formulario porque acomodar es su propia tarea: las
 * órdenes capturadas antes de que hubiera carpetas se archivan de una en una
 * sin tener que abrir la edición completa y arriesgar sus renglones.
 */
export function OrderMoveDialog({
  orderId,
  orderCode,
  currentFolderId,
  folders,
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [folderId, setFolderId] = useState(currentFolderId ?? "");
  const [isSaving, setIsSaving] = useState(false);

  async function handleMove() {
    setIsSaving(true);
    const result = await runAction(() => moveOrderToFolderAction({
      orderId,
      folderId: folderId || undefined,
    }));
    setIsSaving(false);

    if (!result.success) {
      toast.error(result.error);
      return;
    }

    toast.success(folderId ? "Orden movida" : "Orden fuera del pedido");
    setOpen(false);
    router.refresh();
  }

  return (
    <ResponsiveFormDialog
      open={open}
      onOpenChange={setOpen}
      title={`Mover ${orderCode}`}
      description="Elige el pedido al que pertenece. Sin pedido, la orden queda suelta."
      trigger={
        <Button variant="outline" className="touch-target">
          <FolderInput className="size-4" aria-hidden />
          Mover
        </Button>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="move-folder">Pedido</Label>
          <SearchSelect
            id="move-folder"
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
        </div>

        <Button
          onClick={handleMove}
          disabled={isSaving || folderId === (currentFolderId ?? "")}
          className="h-12 w-full"
        >
          {isSaving ? "Moviendo…" : "Mover orden"}
        </Button>
      </div>
    </ResponsiveFormDialog>
  );
}
