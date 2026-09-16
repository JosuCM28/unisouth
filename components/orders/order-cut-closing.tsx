"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/** Lo que se mide cuando la mesa termina el corte. */
export interface OrderCutClosingDraft {
  clientPo: string;
  metersDelivered: string;
  metersSpread: string;
  smallRemnant: string;
}

/** Cierre en blanco: el estado de una orden que todavía no se corta. */
export const EMPTY_ORDER_CUT_CLOSING: OrderCutClosingDraft = {
  clientPo: "",
  metersDelivered: "",
  metersSpread: "",
  smallRemnant: "",
};

interface Props {
  value: OrderCutClosingDraft;
  onChange: (value: OrderCutClosingDraft) => void;
}

/**
 * El cierre del corte: los metros que alimentan el reporte general.
 *
 * Va aparte del encabezado del corte porque responden a momentos distintos.
 * El encabezado —molde, versión, notas— se sabe al tomar el pedido y VIAJA al
 * vale de salida. Esto se mide cuando la mesa ya terminó y no viaja a ningún
 * lado: es el insumo del reporte. Mezclarlos en un solo bloque obligaría a
 * abrir la orden con cuatro campos que nadie puede contestar todavía.
 *
 * Sólo se capturan los CUATRO datos crudos. El excedente, el promedio real,
 * el porcentaje de retacería y el sobrante salen de estos al exportar: pedir
 * un promedio a mano junto a los metros de los que sale es invitar a que un
 * día se contradigan y a que nadie sepa cuál de los dos creer.
 */
export function OrderCutClosing({ value, onChange }: Props) {
  function patch(changes: Partial<OrderCutClosingDraft>) {
    onChange({ ...value, ...changes });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="order-client-po">PO del cliente</Label>
        <Input
          id="order-client-po"
          placeholder="Opcional"
          value={value.clientPo}
          onChange={(event) => patch({ clientPo: event.target.value })}
          className="touch-target"
        />
      </div>

      {/* Los tres metrajes van juntos y en decimal: se capturan de corrido
          leyendo la misma hoja de la mesa. */}
      <div className="grid gap-4 md:grid-cols-3">
        <div className="flex flex-col gap-2">
          <Label htmlFor="order-meters-delivered">Metros entregados</Label>
          <Input
            id="order-meters-delivered"
            inputMode="decimal"
            placeholder="0"
            value={value.metersDelivered}
            onChange={(event) =>
              patch({ metersDelivered: event.target.value })
            }
            className="tabular touch-target"
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="order-meters-spread">Metros tendidos</Label>
          <Input
            id="order-meters-spread"
            inputMode="decimal"
            placeholder="0"
            value={value.metersSpread}
            onChange={(event) => patch({ metersSpread: event.target.value })}
            className="tabular touch-target"
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="order-small-remnant">Retacería chica</Label>
          <Input
            id="order-small-remnant"
            inputMode="decimal"
            placeholder="0"
            value={value.smallRemnant}
            onChange={(event) => patch({ smallRemnant: event.target.value })}
            className="tabular touch-target"
          />
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        El promedio real, el % de retacería y el sobrante se calculan solos en
        el reporte de corte.
      </p>
    </div>
  );
}
