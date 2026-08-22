"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  createOrderFolderAction,
  updateOrderFolderAction,
} from "@/app/actions/order-folder.actions";
import { runAction } from "@/lib/offline/run-action";
import { FormSection } from "@/components/shared/form-section";
import { FormSelectField } from "@/components/shared/form-field";
import { SearchSelect } from "@/components/shared/search-select";
import { SubmitButton } from "@/components/shared/submit-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { OrderOption } from "./order-form";

export interface EditableFolder {
  id: string;
  name: string;
  clientId: string | null;
  reference: string | null;
  dueDate: string | null;
  notes: string | null;
}

interface Props {
  clients: OrderOption[];
  folder?: EditableFolder;
}

/**
 * Alta y corrección de una carpeta de pedido.
 *
 * Sólo el nombre es obligatorio: la carpeta se crea en el momento en que el
 * cliente llama, cuando todavía no se sabe ni cuántas prendas ni de qué tela.
 * Todo lo demás se completa después, si hace falta.
 */
export function FolderForm({ clients, folder }: Props) {
  const router = useRouter();
  const isEditing = Boolean(folder);

  const [name, setName] = useState(folder?.name ?? "");
  const [clientId, setClientId] = useState(folder?.clientId ?? "");
  const [reference, setReference] = useState(folder?.reference ?? "");
  const [dueDate, setDueDate] = useState(folder?.dueDate ?? "");
  const [notes, setNotes] = useState(folder?.notes ?? "");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit() {
    if (!name.trim()) {
      toast.error("Ponle un nombre al pedido.");
      return;
    }

    setIsSubmitting(true);

    const payload = {
      name: name.trim(),
      clientId: clientId || undefined,
      reference: reference || undefined,
      dueDate: dueDate || undefined,
      notes: notes || undefined,
    };

    const result = folder
      ? await runAction(() => updateOrderFolderAction({ id: folder.id, data: payload }))
      : await runAction(() => createOrderFolderAction(payload));

    setIsSubmitting(false);

    if (!result.success) {
      toast.error(result.error);
      return;
    }

    toast.success(isEditing ? "Pedido actualizado" : "Pedido creado");
    router.push(`/orders/folders/${isEditing ? folder!.id : result.data.id}`);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flat-surface flex flex-col gap-4 p-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="folder-name">Nombre del pedido</Label>
          <Input
            id="folder-name"
            placeholder="Pedido Ternium marzo"
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="touch-target"
            autoFocus={!isEditing}
          />
        </div>

        <FormSelectField
          id="folder-client"
          label="Cliente"
          hint="Las órdenes nuevas del pedido lo heredan."
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
      </div>

      <div className="flat-surface p-4">
        <FormSection title="Detalles del pedido">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="folder-reference">Orden del cliente</Label>
              <Input
                id="folder-reference"
                placeholder="Número de pedido que trae el papel"
                value={reference}
                onChange={(event) => setReference(event.target.value)}
                className="touch-target"
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="folder-due">Fecha de entrega</Label>
              <Input
                id="folder-due"
                type="date"
                value={dueDate}
                onChange={(event) => setDueDate(event.target.value)}
                className="touch-target"
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="folder-notes">Notas</Label>
              <Textarea
                id="folder-notes"
                rows={3}
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
              />
            </div>
          </div>
        </FormSection>
      </div>

      <SubmitButton
        isSubmitting={isSubmitting}
        onClick={handleSubmit}
        className="h-12 w-full"
      >
        {isEditing ? "Guardar cambios" : "Crear pedido"}
      </SubmitButton>
    </div>
  );
}
