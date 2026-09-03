"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  createPlacementAction,
  updatePlacementAction,
} from "@/app/actions/garment.actions";
import { runAction } from "@/lib/offline/run-action";
import { FormField } from "@/components/shared/form-field";
import { ResponsiveFormDialog } from "@/components/shared/responsive-form-dialog";
import { SubmitButton } from "@/components/shared/submit-button";
import { PhotoInput, type PhotoValue } from "./photo-input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export interface PlacementDefaults {
  id: string;
  name: string;
  notes: string | null;
  photoId: string | null;
}

interface Props {
  garmentId: string;
  placement?: PlacementDefaults;
  trigger: ReactNode;
}

/**
 * Alta y corrección de un marcado: dónde va el bordado o la serigrafía.
 *
 * El nombre lleva la técnica dentro —"Manga izquierda bordado"— y no hay
 * desplegable de técnicas: así es como ya se escribe en el piso, y un catálogo
 * de técnicas obligaría a clasificar antes de poder anotar lo que se ve.
 */
export function PlacementFormDialog({ garmentId, placement, trigger }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const isEditing = Boolean(placement);

  const [name, setName] = useState(placement?.name ?? "");
  const [notes, setNotes] = useState(placement?.notes ?? "");
  const [photo, setPhoto] = useState<PhotoValue>("keep");
  const [isSaving, setIsSaving] = useState(false);

  function reset() {
    setName(placement?.name ?? "");
    setNotes(placement?.notes ?? "");
    setPhoto("keep");
  }

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) reset();
  }

  async function handleSave() {
    if (!name.trim()) {
      toast.error("Escribe dónde va el marcado.");
      return;
    }

    const payload = {
      name: name.trim(),
      notes: notes || undefined,
      photo,
    };

    setIsSaving(true);
    const result = await runAction(() =>
      isEditing
        ? updatePlacementAction({ id: placement!.id, data: payload })
        : createPlacementAction({ ...payload, garmentId }),
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
      title={isEditing ? "Editar marcado" : "Nuevo marcado"}
      description="Dónde va y cómo se ve. La foto es lo que el taller mira."
    >
      <div className="flex flex-col gap-4">
        <FormField
          id="placement-name"
          label="Dónde va"
          placeholder="Manga izquierda bordado"
          value={name}
          onChange={(event) => setName(event.target.value)}
        />

        <PhotoInput
          label="Foto del marcado"
          value={photo}
          onChange={setPhoto}
          currentPhotoId={placement?.photoId}
          hint="Opcional: la lista sirve aunque las fotos lleguen después."
        />

        <div className="flex flex-col gap-2">
          <Label htmlFor="placement-notes">Notas</Label>
          <Textarea
            id="placement-notes"
            rows={2}
            placeholder="Medidas, hilo, a cuántos centímetros del cuello…"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
          />
        </div>

        <SubmitButton
          isSubmitting={isSaving}
          onClick={handleSave}
          className="h-12 w-full"
        >
          {isEditing ? "Guardar cambios" : "Agregar marcado"}
        </SubmitButton>
      </div>
    </ResponsiveFormDialog>
  );
}
