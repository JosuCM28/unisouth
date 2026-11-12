"use client";

import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { emptySplit, type PoSplitDraft } from "@/lib/orders/po-split-drafts";

interface Props {
  splits: PoSplitDraft[];
  onChange: (splits: PoSplitDraft[]) => void;
}

/**
 * El PO CLIENTE de una talla, con su reparto.
 *
 * Con una sola parte se ve igual que siempre —un campo de PO— porque es el
 * caso de casi todas las tallas y no tiene por qué costar más toques. Sólo
 * cuando la talla se reparte entre varios PO aparece la lista PO · piezas, y
 * la cantidad pedida de la talla pasa a ser la suma.
 *
 * El PO de cada parte es opcional: la cantidad se guarda aunque el PO
 * todavía no llegue, para que el packing list la tenga ("SIN PO").
 */
export function LinePoSplits({ splits, onChange }: Props) {
  function update(key: string, patch: Partial<PoSplitDraft>) {
    onChange(
      splits.map((split) => (split.key === key ? { ...split, ...patch } : split)),
    );
  }

  function remove(key: string) {
    onChange(splits.filter((split) => split.key !== key));
  }

  function add() {
    onChange([...splits, emptySplit()]);
  }

  if (splits.length <= 1) {
    const [only] = splits;
    return (
      <div className="flex flex-col gap-1">
        <span className="text-xs text-muted-foreground">PO CLIENTE</span>
        <Input
          value={only?.clientPo ?? ""}
          onChange={(event) =>
            only && update(only.key, { clientPo: event.target.value })
          }
          placeholder="Opcional"
          className="tabular touch-target uppercase"
        />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="touch-target self-start"
          onClick={add}
        >
          <Plus className="size-4" aria-hidden />
          Repartir en varios PO
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs text-muted-foreground">
        PO CLIENTE · piezas de cada uno
      </span>
      <ul className="flex flex-col gap-2">
        {splits.map((split) => (
          <li key={split.key} className="flex items-center gap-2">
            <Input
              value={split.clientPo}
              onChange={(event) =>
                update(split.key, { clientPo: event.target.value })
              }
              placeholder="Sin PO"
              aria-label="PO CLIENTE"
              className="tabular touch-target min-w-0 flex-1 uppercase"
            />
            <Input
              inputMode="numeric"
              value={split.quantity}
              onChange={(event) =>
                update(split.key, { quantity: event.target.value })
              }
              placeholder="Piezas"
              aria-label="Piezas de este PO"
              className="tabular touch-target w-24 shrink-0 text-right"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="touch-target shrink-0"
              onClick={() => remove(split.key)}
              aria-label="Quitar este PO"
            >
              <Trash2 className="size-4" aria-hidden />
            </Button>
          </li>
        ))}
      </ul>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="touch-target self-start"
        onClick={add}
      >
        <Plus className="size-4" aria-hidden />
        Otro PO
      </Button>
    </div>
  );
}
