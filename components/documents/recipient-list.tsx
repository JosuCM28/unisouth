"use client";

import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

/** Un destinatario como lo pinta el diálogo: nombre y número o correo. */
export interface RecipientItem {
  id: string;
  name: string;
  /** El teléfono ya formateado, o la dirección de correo. */
  detail: string;
  active: boolean;
}

/** Los destinatarios de un canal, cada uno con su interruptor. */
export function RecipientList({
  idPrefix,
  items,
  selected,
  onToggle,
}: {
  /** Distingue los ids de WhatsApp de los de correo en el mismo diálogo. */
  idPrefix: string;
  items: RecipientItem[];
  selected: Set<string>;
  onToggle: (id: string, checked: boolean) => void;
}) {
  return (
    <ul className="flex max-h-[30vh] flex-col gap-2 overflow-y-auto">
      {items.map((item) => (
        <li key={item.id}>
          <Label
            htmlFor={`${idPrefix}-${item.id}`}
            className="flat-surface touch-target flex cursor-pointer items-center justify-between gap-3 p-3"
          >
            <span className="flex min-w-0 flex-col">
              <span className="text-sm font-medium">{item.name}</span>
              <span className="tabular truncate text-xs font-normal text-muted-foreground">
                {item.detail}
              </span>
            </span>
            <Switch
              id={`${idPrefix}-${item.id}`}
              checked={selected.has(item.id)}
              onCheckedChange={(checked) => onToggle(item.id, checked)}
            />
          </Label>
        </li>
      ))}
    </ul>
  );
}
