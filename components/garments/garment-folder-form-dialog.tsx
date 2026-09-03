"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  createGarmentFolderAction,
  updateGarmentFolderAction,
} from "@/app/actions/garment.actions";
import { runAction } from "@/lib/offline/run-action";
import { FormField, FormSelectField } from "@/components/shared/form-field";
import { ResponsiveFormDialog } from "@/components/shared/responsive-form-dialog";
import { SearchSelect } from "@/components/shared/search-select";
import { SubmitButton } from "@/components/shared/submit-button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export interface FolderDefaults {
  id: string;
  name: string;
  clientId: string | null;
  notes: string | null;
}

interface Props {
  clients: { id: string; name: string }[];
  folder?: FolderDefaults;
  trigger: ReactNode;
}

/**
 * Alta y corrección de una carpeta de prendas.
 *
 * Sólo el nombre es obligatorio: la carpeta se escribe en el momento en que
 * alguien tiene una foto que archivar, y pedirle antes que elija un cliente del
 * catálogo es lo que manda la foto a la galería del celular en vez de aquí.
 */
export function GarmentFolderFormDialog({ clients, folder, trigger }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const isEditing = Boolean(folder);

  const [name, setName] = useState(folder?.name ?? "");
  const [clientId, setClientId] = useState(folder?.clientId ?? "");
  const [notes, setNotes] = useState(folder?.notes ?? "");
  const [isSaving, setIsSaving] = useState(false);

  function reset() {
    setName(folder?.name ?? "");
    setClientId(folder?.clientId ?? "");
    setNotes(folder?.notes ?? "");
  }

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) reset();
  }

  async function handleSave() {
    if (!name.trim()) {
      toast.error("Escribe el nombre de la carpeta.");
      return;
    }

    const payload = {
      name: name.trim(),
      clientId: clientId || undefined,
      notes: notes || undefined,
    };

    setIsSaving(true);
    const result = await runAction(() =>
      isEditing
        ? updateGarmentFolderAction({ id: folder!.id, data: payload })
        : createGarmentFolderAction(payload),
    );
    setIsSaving(false);

    if (!result.success) {
      toast.error(result.error);
      return;
    }

    toast.success(result.message ?? "Guardado");
    setOpen(false);
    if (!isEditing) reset();
    router.refresh();
  }

  return (
    <ResponsiveFormDialog
      open={open}
      onOpenChange={handleOpenChange}
      trigger={trigger}
      title={isEditing ? "Editar carpeta" : "Nueva carpeta"}
      description="Agrupa las prendas de un cliente o de una línea."
    >
      <div className="flex flex-col gap-4">
        <FormField
          id="folder-name"
          label="Nombre"
          placeholder="TAMSA"
          value={name}
          onChange={(event) => setName(event.target.value)}
        />

        <FormSelectField
          id="folder-client"
          label="Cliente"
          hint="Opcional. Sólo para saber de quién es la carpeta."
        >
          <SearchSelect
            id="folder-client"
            options={clients.map((client) => ({
              value: client.id,
              label: client.name,
            }))}
            value={clientId}
            onChange={setClientId}
            placeholder="Sin cliente"
            searchPlaceholder="Buscar cliente…"
            clearLabel="Sin cliente"
          />
        </FormSelectField>

        <div className="flex flex-col gap-2">
          <Label htmlFor="folder-notes">Notas</Label>
          <Textarea
            id="folder-notes"
            rows={2}
            placeholder="Lo que haya que recordar de este cliente…"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
          />
        </div>

        <SubmitButton
          isSubmitting={isSaving}
          onClick={handleSave}
          className="h-12 w-full"
        >
          {isEditing ? "Guardar cambios" : "Crear carpeta"}
        </SubmitButton>
      </div>
    </ResponsiveFormDialog>
  );
}
