"use client";

import { useState } from "react";
import { AlertTriangle, Plus, Trash2, X } from "lucide-react";
import type { Unit } from "@prisma/client";
import {
  availableLotsAction,
  type IssueLotOption,
} from "@/app/actions/issue.actions";
import type { OrderIssueTarget } from "@/lib/repositories/order-fabric.repository";
import { UNIT_SHORT_LABELS } from "@/lib/constants/labels";
import { formatQuantity } from "@/lib/utils";
import { runAction } from "@/lib/offline/run-action";
import { FormSelectField } from "@/components/shared/form-field";
import { ResponsiveFormDialog } from "@/components/shared/responsive-form-dialog";
import { SearchSelect } from "@/components/shared/search-select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { IssueLotPicker, type PickerState } from "./issue-lot-picker";

export interface MultiIssueMaterial {
  id: string;
  code: string;
  name: string;
  lotCount: number;
}

/** Un rollo asignado a una orden y cuánto se lleva. */
export interface MultiIssueLine {
  lotId: string;
  lotCode: string;
  materialName: string;
  shade: string | null;
  ownerName: string | null;
  /** Disponible del rollo completo, sin descontar lo que tomaron las otras órdenes. */
  available: number;
  unit: Unit;
  /** Texto, no número: el input vive a medio teclear. */
  quantity: string;
}

interface Props {
  order: OrderIssueTarget;
  lines: MultiIssueLine[];
  materials: MultiIssueMaterial[];
  /** Lo que las OTRAS órdenes ya tomaron de cada rollo. */
  takenElsewhere: Map<string, number>;
  onLinesChange: (lines: MultiIssueLine[]) => void;
  onRemove: () => void;
}

/**
 * Una orden dentro de la salida múltiple: su encabezado y sus rollos.
 *
 * El selector abre ya con la tela de la orden cargada: es casi siempre de esa
 * tela de la que se va a sacar, y elegirla otra vez por cada orden son toques
 * de más.
 */
export function MultiOrderIssueBlock({
  order,
  lines,
  materials,
  takenElsewhere,
  onLinesChange,
  onRemove,
}: Props) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [materialId, setMaterialId] = useState("");
  const [pickerState, setPickerState] = useState<PickerState>({ kind: "idle" });

  /**
   * Los rollos del material, con lo que de verdad le queda a ESTA orden.
   *
   * Un rollo se puede partir entre órdenes, así que lo que ya tomaron las
   * otras se le resta al disponible: si no, el selector propondría el rollo
   * entero dos veces y el exceso saltaría hasta guardar.
   */
  async function loadLots(nextMaterialId: string) {
    setMaterialId(nextMaterialId);
    setPickerState({ kind: "loading" });

    const result = await runAction(() =>
      availableLotsAction({ materialId: nextMaterialId }),
    );

    if (!result.success) {
      setPickerState({ kind: "error", message: result.error });
      return;
    }

    const lots = result.data
      .map((lot) => ({
        ...lot,
        available: lot.available - (takenElsewhere.get(lot.id) ?? 0),
      }))
      .filter((lot) => lot.available > 0);

    setPickerState({ kind: "ready", lots });
  }

  function openPicker() {
    setPickerOpen(true);
    if (order.materialId) void loadLots(order.materialId);
  }

  function closePicker() {
    setPickerOpen(false);
    setMaterialId("");
    setPickerState({ kind: "idle" });
  }

  /* Se propone lo que le queda al rollo para esta orden: lo habitual es
     llevárselo entero, y el que sale a medias se corrige tecleando encima. */
  function handlePick(lot: IssueLotOption) {
    onLinesChange([
      ...lines,
      {
        lotId: lot.id,
        lotCode: lot.code,
        materialName: lot.materialName,
        shade: lot.shade,
        ownerName: lot.ownerName,
        available: lot.available + (takenElsewhere.get(lot.id) ?? 0),
        unit: lot.unit as Unit,
        quantity: String(lot.available),
      },
    ]);
  }

  function updateQuantity(index: number, value: string) {
    onLinesChange(
      lines.map((line, position) =>
        position === index ? { ...line, quantity: value } : line,
      ),
    );
  }

  function removeLine(index: number) {
    onLinesChange(lines.filter((_, position) => position !== index));
  }

  return (
    <section className="flat-surface flex flex-col gap-3 p-4">
      <OrderHeader order={order} onRemove={onRemove} />

      {lines.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Todavía no le asignas rollos a esta orden.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {lines.map((line, index) => (
            <li key={line.lotId}>
              <LineRow
                line={line}
                orderClient={order.clientName}
                onQuantityChange={(value) => updateQuantity(index, value)}
                onRemove={() => removeLine(index)}
              />
            </li>
          ))}
        </ul>
      )}

      <ResponsiveFormDialog
        open={pickerOpen}
        onOpenChange={(open) => (open ? openPicker() : closePicker())}
        title={`Rollos para ${order.code}`}
        description="Marca los rollos que se lleva esta orden."
        trigger={
          <Button type="button" variant="outline" className="touch-target w-fit">
            <Plus className="size-4" aria-hidden />
            Agregar rollos
          </Button>
        }
      >
        <div className="flex flex-col gap-4">
          <FormSelectField id={`material-${order.id}`} label="Material">
            <SearchSelect
              id={`material-${order.id}`}
              options={materials
                .filter((material) => material.lotCount > 0)
                .map((material) => ({
                  value: material.id,
                  label: material.name,
                  hint: `${material.code} · ${material.lotCount} ${material.lotCount === 1 ? "rollo" : "rollos"}`,
                  keywords: material.code,
                }))}
              value={materialId}
              onChange={(next) => void loadLots(next)}
              placeholder="Elige el material"
              searchPlaceholder="Buscar por código o nombre…"
              emptyMessage="No hay material en bodega."
            />
          </FormSelectField>

          <IssueLotPicker
            key={materialId}
            state={pickerState}
            excludeLotIds={lines.map((line) => line.lotId)}
            hasClientFilter={false}
            onPick={handlePick}
          />

          <Button type="button" className="touch-target" onClick={closePicker}>
            Listo
            {lines.length > 0 && ` · ${lines.length} rollo(s)`}
          </Button>
        </div>
      </ResponsiveFormDialog>
    </section>
  );
}

function OrderHeader({
  order,
  onRemove,
}: {
  order: OrderIssueTarget;
  onRemove: () => void;
}) {
  const details = [order.clientName, order.description, order.materialName]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="tabular text-sm font-semibold">
          {order.code}
          {order.reference && (
            <span className="font-normal text-muted-foreground">
              {" "}
              · {order.reference}
            </span>
          )}
        </p>
        {details && (
          <p className="truncate text-xs text-muted-foreground">{details}</p>
        )}
      </div>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="touch-target shrink-0"
        onClick={onRemove}
        aria-label={`Quitar ${order.code} de la salida`}
      >
        <X className="size-4" aria-hidden />
      </Button>
    </div>
  );
}

function LineRow({
  line,
  orderClient,
  onQuantityChange,
  onRemove,
}: {
  line: MultiIssueLine;
  orderClient: string | null;
  onQuantityChange: (value: string) => void;
  onRemove: () => void;
}) {
  /* La tela de un cliente no se le surte a la orden de otro. No se bloquea
     —el selector abre con todos los dueños a propósito, por los rollos que
     se dieron de alta sin dueño—, pero se dice en el renglón para que nadie
     lo haga sin darse cuenta. */
  const foreignOwner =
    Boolean(orderClient) && line.ownerName !== orderClient;

  return (
    <div className="flex flex-col gap-2 border border-border p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="tabular text-sm font-medium">{line.lotCode}</p>
          <p className="truncate text-xs text-muted-foreground">
            {line.materialName}
            {line.shade && ` · Tono ${line.shade}`}
          </p>
          {foreignOwner && (
            <p className="flex items-center gap-1 text-xs text-state-reserved">
              <AlertTriangle className="size-3" aria-hidden />
              {line.ownerName
                ? `Rollo de ${line.ownerName}`
                : "Rollo sin dueño asignado"}
            </p>
          )}
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="touch-target shrink-0"
          onClick={onRemove}
          aria-label={`Quitar ${line.lotCode}`}
        >
          <Trash2 className="size-4" aria-hidden />
        </Button>
      </div>

      <div className="flex items-center gap-2">
        <Input
          value={line.quantity}
          onChange={(event) => onQuantityChange(event.target.value)}
          inputMode="decimal"
          className="touch-target tabular w-32"
          aria-label={`Cantidad de ${line.lotCode}`}
        />
        <span className="tabular text-xs text-muted-foreground">
          de{" "}
          {formatQuantity(line.available, {
            unit: UNIT_SHORT_LABELS[line.unit],
          })}
        </span>
      </div>
    </div>
  );
}
