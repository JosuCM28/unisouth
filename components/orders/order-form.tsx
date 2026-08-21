"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  createCuttingOrderAction,
  updateCuttingOrderAction,
} from "@/app/actions/cutting-order.actions";
import { todayInputValue } from "@/lib/utils";
import { FormSection } from "@/components/shared/form-section";
import { FormSelectField } from "@/components/shared/form-field";
import { SearchSelect } from "@/components/shared/search-select";
import { SubmitButton } from "@/components/shared/submit-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export interface OrderOption {
  id: string;
  name: string;
  hint?: string;
}

export interface SizeOption {
  id: string;
  code: string;
  name: string;
  group: string | null;
}

export interface TagOption {
  id: string;
  name: string;
  color: string;
}

/** Un renglón a medio teclear: talla y cuántas piden. */
interface LineDraft {
  key: string;
  sizeId: string;
  orderedQuantity: string;
  tagId: string;
  notes: string;
  /** Ya tiene avance capturado: no se puede quitar sin perder su historial. */
  locked?: boolean;
}

export interface EditableOrder {
  id: string;
  clientId: string | null;
  materialId: string | null;
  productionRunId: string | null;
  folderId: string | null;
  description: string | null;
  reference: string | null;
  orderedAt: string;
  dueDate: string | null;
  notes: string | null;
  lines: LineDraft[];
}

interface Props {
  clients: OrderOption[];
  materials: OrderOption[];
  productionRuns: OrderOption[];
  sizes: SizeOption[];
  tags: TagOption[];
  folders: OrderOption[];
  order?: EditableOrder;
  /**
   * Pedido y cliente precargados al entrar desde la ficha de una carpeta.
   *
   * Se pasan aparte de `order` porque no es una orden existente: es un alta
   * que ya sabe a qué pedido va, para no obligar a elegirlo otra vez.
   */
  defaults?: { folderId?: string; clientId?: string; dueDate?: string };
}

/**
 * Alta y corrección de una orden de corte.
 *
 * Captura lo que el cliente PIDIÓ, que es el número contra el que se mide
 * todo después. El avance no se toca aquí: se registra desde la ficha, corte
 * por corte, para que quede el historial.
 */
export function OrderForm({
  clients,
  materials,
  productionRuns,
  sizes,
  tags,
  folders,
  order,
  defaults,
}: Props) {
  const router = useRouter();
  const isEditing = Boolean(order);

  const [clientId, setClientId] = useState(
    order?.clientId ?? defaults?.clientId ?? "",
  );
  const [folderId, setFolderId] = useState(
    order?.folderId ?? defaults?.folderId ?? "",
  );
  const [materialId, setMaterialId] = useState(order?.materialId ?? "");
  const [productionRunId, setProductionRunId] = useState(
    order?.productionRunId ?? "",
  );
  const [description, setDescription] = useState(order?.description ?? "");
  const [reference, setReference] = useState(order?.reference ?? "");
  const [orderedAt, setOrderedAt] = useState(
    order?.orderedAt ?? todayInputValue(),
  );
  const [dueDate, setDueDate] = useState(
    order?.dueDate ?? defaults?.dueDate ?? "",
  );
  const [notes, setNotes] = useState(order?.notes ?? "");
  const [lines, setLines] = useState<LineDraft[]>(order?.lines ?? []);
  const [isSubmitting, setIsSubmitting] = useState(false);

  function addLine() {
    setLines((current) => [
      ...current,
      {
        key: crypto.randomUUID(),
        sizeId: "",
        orderedQuantity: "",
        tagId: "",
        notes: "",
      },
    ]);
  }

  function updateLine(key: string, patch: Partial<LineDraft>) {
    setLines((current) =>
      current.map((line) => (line.key === key ? { ...line, ...patch } : line)),
    );
  }

  function removeLine(key: string) {
    const line = lines.find((item) => item.key === key);

    if (line?.locked) {
      toast.error(
        "Esa talla ya tiene avance. Registra un avance negativo si el conteo estaba mal.",
      );
      return;
    }

    setLines((current) => current.filter((item) => item.key !== key));
  }

  // Las tallas ya usadas no se vuelven a ofrecer: dos renglones de la misma
  // talla en una orden son un error de captura, no un caso real.
  function optionsFor(currentSizeId: string) {
    const used = new Set(
      lines.map((line) => line.sizeId).filter((id) => id !== currentSizeId),
    );

    return sizes
      .filter((size) => !used.has(size.id))
      .map((size) => ({
        value: size.id,
        label: size.code,
        hint: size.name,
        keywords: size.group ?? undefined,
      }));
  }

  const total = lines.reduce(
    (sum, line) => sum + (Number(line.orderedQuantity) || 0),
    0,
  );

  async function handleSubmit() {
    const valid = lines.filter(
      (line) => line.sizeId && Number(line.orderedQuantity) > 0,
    );

    if (valid.length === 0) {
      toast.error("Agrega al menos una talla con cantidad.");
      return;
    }

    setIsSubmitting(true);

    const payload = {
      clientId: clientId || undefined,
      materialId: materialId || undefined,
      productionRunId: productionRunId || undefined,
      folderId: folderId || undefined,
      description: description || undefined,
      reference: reference || undefined,
      orderedAt: orderedAt || undefined,
      dueDate: dueDate || undefined,
      notes: notes || undefined,
      lines: valid.map((line) => ({
        sizeId: line.sizeId,
        orderedQuantity: Number(line.orderedQuantity),
        tagId: line.tagId || undefined,
        notes: line.notes || undefined,
      })),
    };

    const result = order
      ? await updateCuttingOrderAction({ id: order.id, data: payload })
      : await createCuttingOrderAction(payload);

    setIsSubmitting(false);

    if (!result.success) {
      toast.error(result.error);
      return;
    }

    toast.success(isEditing ? "Orden actualizada" : "Orden creada");
    router.push(
      isEditing ? `/orders/${order!.id}` : `/orders/${result.data.id}`,
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flat-surface flex flex-col gap-4 p-4">
        {/* El pedido va primero: cuando la orden es parte de uno, es el dato
            que el auxiliar ya trae en la cabeza al abrir el formulario. */}
        <FormSelectField
          id="order-folder"
          label="Pedido"
          hint="Agrupa esta orden con las demás del mismo pedido. Opcional."
        >
          <SearchSelect
            id="order-folder"
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
        </FormSelectField>

        <FormSelectField
          id="order-client"
          label="Cliente"
          hint="De quién es el pedido y su tela."
        >
          <SearchSelect
            id="order-client"
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

        <FormSelectField id="order-material" label="Material">
          <SearchSelect
            id="order-material"
            options={materials.map((material) => ({
              value: material.id,
              label: material.name,
              hint: material.hint,
              keywords: material.hint,
            }))}
            value={materialId}
            onChange={setMaterialId}
            placeholder="Sin material"
            searchPlaceholder="Buscar material…"
            clearLabel="Sin material"
          />
        </FormSelectField>

        <div className="flex flex-col gap-2">
          <Label htmlFor="order-description">Descripción</Label>
          <Input
            id="order-description"
            placeholder="Blusa manga larga"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            className="touch-target"
          />
        </div>
      </div>

      <div className="flat-surface p-4">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold">Tallas pedidas</h2>
          {lines.length > 0 && (
            <p className="tabular text-sm text-muted-foreground">
              {total} piezas
            </p>
          )}
        </div>

        {lines.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Agrega las tallas que pidieron y cuántas de cada una.
          </p>
        )}

        <ul className="flex flex-col gap-3">
          {lines.map((line) => (
            <li key={line.key} className="flat-surface flex flex-col gap-2 p-3">
              <div className="flex items-center gap-2">
                <div className="min-w-0 flex-1">
                  <SearchSelect
                    options={optionsFor(line.sizeId)}
                    value={line.sizeId}
                    onChange={(value) => updateLine(line.key, { sizeId: value })}
                    placeholder="Talla"
                    searchPlaceholder="Buscar talla…"
                    // Cambiar la talla de un renglón con avance movería su
                    // historial a otra talla: se bloquea.
                    disabled={line.locked}
                  />
                </div>

                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="touch-target shrink-0"
                  onClick={() => removeLine(line.key)}
                  aria-label="Quitar talla"
                >
                  <Trash2 className="size-4" aria-hidden />
                </Button>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <label className="flex flex-col gap-1">
                  <span className="text-xs text-muted-foreground">
                    Cantidad pedida
                  </span>
                  <Input
                    inputMode="numeric"
                    value={line.orderedQuantity}
                    onChange={(event) =>
                      updateLine(line.key, {
                        orderedQuantity: event.target.value,
                      })
                    }
                    className="tabular touch-target text-right"
                  />
                </label>

                <div className="flex flex-col gap-1">
                  <span className="text-xs text-muted-foreground">Foleo</span>
                  <div className="flex items-center gap-2">
                    <div className="min-w-0 flex-1">
                      <SearchSelect
                        options={tags.map((tag) => ({
                          value: tag.id,
                          label: tag.name,
                        }))}
                        value={line.tagId}
                        onChange={(value) =>
                          updateLine(line.key, { tagId: value })
                        }
                        placeholder="Sin foleo"
                        searchPlaceholder="Buscar color…"
                        clearLabel="Sin foleo"
                      />
                    </div>
                    {line.tagId && (
                      <span
                        className="size-6 shrink-0 border border-border"
                        style={{
                          backgroundColor: tags.find((t) => t.id === line.tagId)
                            ?.color,
                        }}
                        aria-hidden
                      />
                    )}
                  </div>
                </div>
              </div>

              <Input
                value={line.notes}
                onChange={(event) =>
                  updateLine(line.key, { notes: event.target.value })
                }
                placeholder="Anotaciones"
                className="touch-target"
              />
            </li>
          ))}
        </ul>

        <Button
          type="button"
          variant="outline"
          className="touch-target mt-3"
          onClick={addLine}
        >
          <Plus className="size-4" aria-hidden />
          Agregar talla
        </Button>
      </div>

      <div className="flat-surface p-4">
        <FormSection title="Detalles del pedido">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="order-reference">Orden del cliente</Label>
              <Input
                id="order-reference"
                placeholder="Número de orden que trae el papel"
                value={reference}
                onChange={(event) => setReference(event.target.value)}
                className="touch-target"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="order-date">Fecha del pedido</Label>
                <Input
                  id="order-date"
                  type="date"
                  value={orderedAt}
                  onChange={(event) => setOrderedAt(event.target.value)}
                  className="touch-target"
                />
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="order-due">Fecha de entrega</Label>
                <Input
                  id="order-due"
                  type="date"
                  value={dueDate}
                  onChange={(event) => setDueDate(event.target.value)}
                  className="touch-target"
                />
              </div>
            </div>

            <FormSelectField id="order-run" label="Producción">
              <SearchSelect
                id="order-run"
                options={productionRuns.map((run) => ({
                  value: run.id,
                  label: run.name,
                  hint: run.hint,
                }))}
                value={productionRunId}
                onChange={setProductionRunId}
                placeholder="Sin producción"
                searchPlaceholder="Buscar producción…"
                clearLabel="Sin producción"
              />
            </FormSelectField>

            <div className="flex flex-col gap-2">
              <Label htmlFor="order-notes">Notas</Label>
              <Textarea
                id="order-notes"
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
        {isEditing ? "Guardar cambios" : "Crear orden"}
      </SubmitButton>
    </div>
  );
}
