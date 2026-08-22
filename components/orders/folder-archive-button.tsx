"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Archive, ArchiveRestore } from "lucide-react";
import { toast } from "sonner";
import {
  archiveOrderFolderAction,
  unarchiveOrderFolderAction,
} from "@/app/actions/order-folder.actions";
import { runAction } from "@/lib/offline/run-action";
import { Button } from "@/components/ui/button";

interface Props {
  folderId: string;
  isArchived: boolean;
}

/**
 * Archiva el pedido o lo saca del archivo.
 *
 * No hay confirmación porque no se pierde nada: archivar sólo lo quita de la
 * lista diaria y el mismo botón lo devuelve. El servidor es el que impide
 * archivar un pedido con órdenes todavía abiertas.
 */
export function FolderArchiveButton({ folderId, isArchived }: Props) {
  const router = useRouter();
  const [isSaving, setIsSaving] = useState(false);

  async function handleClick() {
    setIsSaving(true);

    const result = isArchived
      ? await runAction(() => unarchiveOrderFolderAction({ id: folderId }))
      : await runAction(() => archiveOrderFolderAction({ id: folderId }));

    setIsSaving(false);

    if (!result.success) {
      toast.error(result.error);
      return;
    }

    toast.success(isArchived ? "Pedido reabierto" : "Pedido archivado");
    router.refresh();
  }

  return (
    <Button
      variant="outline"
      className="touch-target"
      onClick={handleClick}
      disabled={isSaving}
    >
      {isArchived ? (
        <ArchiveRestore className="size-4" aria-hidden />
      ) : (
        <Archive className="size-4" aria-hidden />
      )}
      {isArchived ? "Reabrir" : "Archivar"}
    </Button>
  );
}
