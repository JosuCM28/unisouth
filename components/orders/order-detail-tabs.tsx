"use client";

import type { ReactNode } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export type OrderDetailTab = "order" | "fabric";

interface Props {
  defaultTab: OrderDetailTab;
  /** Vales de tela de la orden, para el contador de la pestaña. */
  fabricCount: number;
  order: ReactNode;
  fabric: ReactNode;
}

/**
 * Las dos caras de la ficha: la orden (tallas, cortes, talleres) y la tela
 * que se le ha sacado.
 *
 * La tela vivía mezclada con todo lo demás y se perdía en la pantalla. Va en
 * su propia pestaña, pero el contenido sigue armándose en el servidor: aquí
 * sólo se decide cuál se ve.
 */
export function OrderDetailTabs({
  defaultTab,
  fabricCount,
  order,
  fabric,
}: Props) {
  /* La pestaña queda en la dirección para que al volver de la salida —o al
     recargar— se abra donde se estaba. `replaceState` y no `router.replace`:
     cambiar de pestaña no tiene por qué volver a pedir la orden al servidor. */
  function handleChange(value: string) {
    const url = new URL(window.location.href);
    if (value === "fabric") url.searchParams.set("tab", "fabric");
    else url.searchParams.delete("tab");
    window.history.replaceState(null, "", url);
  }

  return (
    <Tabs defaultValue={defaultTab} onValueChange={handleChange}>
      <TabsList className="w-full">
        <TabsTrigger value="order" className="touch-target flex-1">
          Orden
        </TabsTrigger>
        <TabsTrigger value="fabric" className="touch-target flex-1">
          <span className="tabular">
            Salidas de tela{fabricCount > 0 && ` (${fabricCount})`}
          </span>
        </TabsTrigger>
      </TabsList>

      <TabsContent value="order" className="mt-2 flex flex-col gap-4">
        {order}
      </TabsContent>
      <TabsContent value="fabric" className="mt-2 flex flex-col gap-4">
        {fabric}
      </TabsContent>
    </Tabs>
  );
}
