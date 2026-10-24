"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { issueFabricToOrdersAction } from "@/app/actions/order-fabric.actions";
import type { OrderIssueTarget } from "@/lib/repositories/order-fabric.repository";
import { runAction } from "@/lib/offline/run-action";
import { FormSelectField } from "@/components/shared/form-field";
import { SearchSelect } from "@/components/shared/search-select";
import { UnsavedChangesGuard } from "@/components/shared/unsaved-changes-guard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  MultiOrderIssueBlock,
  type MultiIssueLine,
  type MultiIssueMaterial,
} from "./multi-order-issue-block";

interface Props {
  orders: OrderIssueTarget[];
  materials: MultiIssueMaterial[];
}

interface TargetDraft {
  order: OrderIssueTarget;
  lines: MultiIssueLine[];
}

/**
 * Salida de tela a VARIAS órdenes en una sola captura.
 *
 * Se eligen las órdenes y a cada una se le asignan sus rollos. Al guardar
 * nace un vale en borrador por orden —el mismo que saldría desde su ficha—,
 * así que el consumo de cada orden queda igual de claro. Nada descuenta
 * hasta aplicar cada vale.
 */
export function MultiOrderIssueForm({ orders, materials }: Props) {
  const router = useRouter();
  const [targets, setTargets] = useState<TargetDraft[]>([]);
  const [receivedBy, setReceivedBy] = useState("");
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const chosenIds = new Set(targets.map((target) => target.order.id));
  const orderOptions = orders
    .filter((order) => !chosenIds.has(order.id))
    .map((order) => ({
      value: order.id,
      label: order.code,
      hint: [order.reference, order.clientName, order.description]
        .filter(Boolean)
        .join(" · "),
      keywords: [order.reference, order.clientName, order.description]
        .filter(Boolean)
        .join(" "),
    }));

  /* Cuánto se lleva cada orden de cada rollo. Con esto cada bloque sabe lo
     que las demás ya tomaron y no ofrece el mismo metraje dos veces. */
  const takenByOrder = useMemo(
    () =>
      new Map(
        targets.map((target) => [
          target.order.id,
          sumByLot(target.lines),
        ]),
      ),
    [targets],
  );

  function takenOutside(orderId: string): Map<string, number> {
    const total = new Map<string, number>();
    for (const [id, taken] of takenByOrder) {
      if (id === orderId) continue;
      for (const [lotId, quantity] of taken) {
        total.set(lotId, (total.get(lotId) ?? 0) + quantity);
      }
    }
    return total;
  }

  function addOrder(orderId: string) {
    const order = orders.find((item) => item.id === orderId);
    if (!order) return;
    setTargets((current) => [...current, { order, lines: [] }]);
  }

  function updateLines(orderId: string, lines: MultiIssueLine[]) {
    setTargets((current) =>
      current.map((target) =>
        target.order.id === orderId ? { ...target, lines } : target,
      ),
    );
  }

  function removeOrder(orderId: string) {
    setTargets((current) =>
      current.filter((target) => target.order.id !== orderId),
    );
  }

  async function handleSubmit() {
    const problem = findProblem(targets);
    if (problem) {
      toast.error(problem);
      return;
    }

    setIsSubmitting(true);

    const result = await runAction(() =>
      issueFabricToOrdersAction({
        receivedBy: receivedBy || undefined,
        notes: notes || undefined,
        orders: targets.map((target) => ({
          orderId: target.order.id,
          lines: target.lines.map((line) => ({
            lotId: line.lotId,
            quantity: Number(line.quantity),
            unit: line.unit,
          })),
        })),
      }),
    );

    if (!result.success) {
      setIsSubmitting(false);
      toast.error(result.error);
      return;
    }

    const codes = result.data
      .map((voucher) => `${voucher.orderCode} → ${voucher.code}`)
      .join(" · ");
    toast.success(`Borradores creados: ${codes}. Aplícalos para descontar.`);
    router.push("/issues");
  }

  const hasUnsaved = !isSubmitting && targets.length > 0;
  const rollCount = targets.reduce((sum, target) => sum + target.lines.length, 0);

  return (
    <div className="flex flex-col gap-4">
      <UnsavedChangesGuard
        when={hasUnsaved}
        description="Se perderán las órdenes y los rollos que llevas asignados."
      />

      <section className="flat-surface flex flex-col gap-3 p-4">
        <FormSelectField id="multi-order" label="Agregar orden">
          <SearchSelect
            id="multi-order"
            options={orderOptions}
            value=""
            onChange={addOrder}
            placeholder="Elige el número de orden"
            searchPlaceholder="Folio, número del cliente, empresa…"
            emptyMessage="No hay más órdenes que agregar."
          />
        </FormSelectField>
      </section>

      {targets.map((target) => (
        <MultiOrderIssueBlock
          key={target.order.id}
          order={target.order}
          lines={target.lines}
          materials={materials}
          takenElsewhere={takenOutside(target.order.id)}
          onLinesChange={(lines) => updateLines(target.order.id, lines)}
          onRemove={() => removeOrder(target.order.id)}
        />
      ))}

      {targets.length > 0 && (
        <section className="flat-surface flex flex-col gap-3 p-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="multi-received-by">Quién recibe</Label>
            <Input
              id="multi-received-by"
              value={receivedBy}
              onChange={(event) => setReceivedBy(event.target.value)}
              className="touch-target"
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="multi-notes">Notas</Label>
            <Textarea
              id="multi-notes"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Se copian a cada vale. Nace un borrador por orden y ninguno
            descuenta hasta aplicarlo.
          </p>
        </section>
      )}

      <Button
        type="button"
        onClick={handleSubmit}
        disabled={isSubmitting || targets.length === 0}
        className="h-12 w-full"
      >
        {submitLabel(isSubmitting, targets.length, rollCount)}
      </Button>
    </div>
  );
}

function submitLabel(
  isSubmitting: boolean,
  orders: number,
  rolls: number,
): string {
  if (isSubmitting) return "Guardando…";

  const ordersText = orders === 1 ? "1 salida" : `${orders} salidas`;
  const rollsText = rolls === 1 ? "1 rollo" : `${rolls} rollos`;
  return `Guardar ${ordersText} · ${rollsText}`;
}

function sumByLot(lines: MultiIssueLine[]): Map<string, number> {
  const total = new Map<string, number>();
  for (const line of lines) {
    const quantity = Number(line.quantity) || 0;
    total.set(line.lotId, (total.get(line.lotId) ?? 0) + quantity);
  }
  return total;
}

/**
 * Lo que impediría guardar, dicho antes de mandar.
 *
 * El servidor lo vuelve a revisar, pero enterarse ahí obliga a buscar cuál
 * de todos los renglones fue.
 */
function findProblem(targets: TargetDraft[]): string | null {
  for (const target of targets) {
    if (target.lines.length === 0) {
      return `${target.order.code} no tiene rollos. Agrégale o quítala.`;
    }
    const invalid = target.lines.find((line) => !(Number(line.quantity) > 0));
    if (invalid) {
      return `Escribe cuánto se lleva ${target.order.code} del rollo ${invalid.lotCode}.`;
    }
  }

  /* Un rollo partido entre órdenes: la suma no puede pasar de lo que tiene. */
  const total = sumByLot(targets.flatMap((target) => target.lines));
  for (const line of targets.flatMap((target) => target.lines)) {
    if ((total.get(line.lotId) ?? 0) > line.available + 0.0001) {
      return `Entre todas las órdenes le sacas más de lo que tiene al rollo ${line.lotCode}.`;
    }
  }

  return null;
}
