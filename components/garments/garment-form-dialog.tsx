"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  createGarmentAction,
  updateGarmentAction,
} from "@/app/actions/garment.actions";
import { runAction } from "@/lib/offline/run-action";
import { FormField } from "@/components/shared/form-field";
import { ResponsiveFormDialog } from "@/components/shared/responsive-form-dialog";
import { SubmitButton } from "@/components/shared/submit-button";
import { PhotoInput, type PhotoValue } from "./photo-input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export interface GarmentDefaults {
  id: string;
  name: string;
  reference: string | null;
  notes: string | null;
  photoId: string | null;
}

interface Props {
  folderId: string;
  garment?: GarmentDefaults;
  trigger: ReactNode;
}

/**
 * Alta y corrección de una prenda.
 *
 * La foto va en el MISMO guardado que el nombre y no en un paso aparte: con dos
 * llamadas, perder la conexión entre ellas —cosa que en la bodega pasa varias
 * veces al día— dejaría la prenda creada sin su foto y nadie sabría cuál de las
 * dos cosas falló.
 */
export function GarmentFormDialog({ folderId, garment, trigger }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const isEditing = Boolean(garment);

  const [name, setName] = useState(garment?.name ?? "");
  const [reference, setReference] = useState(garment?.reference ?? "");
  const [notes, setNotes] = useState(garment?.notes ?? "");
  const [photo, setPhoto] = useState<PhotoValue>("keep");
  const [isSaving, setIsSaving] = useState(false);

  function reset() {
    setName(garment?.name ?? "");
    setReference(garment?.reference ?? "");
    setNotes(garment?.notes ?? "");
    setPhoto("keep");
  }

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) reset();
  }

  async function handleSave() {
    if (!name.trim()) {
      toast.error("Escribe cómo se llama la prenda.");
      return;
    }

    const payload = {
      name: name.trim(),
      reference: reference || undefined,
      notes: notes || undefined,
      photo,
    };

    setIsSaving(true);
    const result = await runAction(() =>
      isEditing
        ? updateGarmentAction({ id: garment!.id, data: payload })
        : createGarmentAction({ ...payload, folderId }),
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
      title={isEditing ? "Editar prenda" : "Nueva prenda"}
      description="La foto de la prenda completa. Los bordados se agregan dentro."
    >
      <div className="flex flex-col gap-4">
        <FormField
          id="garment-name"
          label="Nombre"
          placeholder="Chamarra ignífuga"
          value={name}
          onChange={(event) => setName(event.target.value)}
        />

        <PhotoInput
          label="Foto de la prenda"
          value={photo}
          onChange={setPhoto}
          currentPhotoId={garment?.photoId}
          hint="Se reduce en el celular antes de subir. Opcional."
        />

        <FormField
          id="garment-reference"
          label="Referencia"
          placeholder="Su clave"
          hint="Opcional. Cómo la llama el cliente."
          value={reference}
          onChange={(event) => setReference(event.target.value)}
        />

        <div className="flex flex-col gap-2">
          <Label htmlFor="garment-notes">Notas</Label>
          <Textarea
            id="garment-notes"
            rows={2}
            placeholder="Tela, color, lo que haya que recordar…"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
          />
        </div>

        <SubmitButton
          isSubmitting={isSaving}
          onClick={handleSave}
          className="h-12 w-full"
        >
          {isEditing ? "Guardar cambios" : "Crear prenda"}
        </SubmitButton>
      </div>
    </ResponsiveFormDialog>
  );
}
