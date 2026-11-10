"use client";

import { useCallback, useRef, useState } from "react";
import {
  acatlanDeliveryDetailAction,
  allendeDeliveryDetailAction,
  broderieDeliveryDetailAction,
  sitexDeliveryDetailAction,
} from "@/app/actions/workshop-board.actions";
import type { WorkshopBoardKey } from "@/lib/constants/workshop-access";
import type { ActionResult } from "@/lib/core/result";
import { runAction } from "@/lib/offline/run-action";
import type { WorkshopDeliveryDetail } from "@/lib/services/workshop-delivery.service";
import { ResponsiveFormDialog } from "@/components/shared/responsive-form-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import {
  CancelledDelivery,
  DeliveryDetail,
} from "@/components/workshop-orders/delivery-detail";

type DetailAction = (
  input: unknown,
) => Promise<ActionResult<WorkshopDeliveryDetail>>;

/* Cada tablero llama a SU action, que exige su propia llave. */
const DETAIL_ACTIONS: Record<WorkshopBoardKey, DetailAction> = {
  acatlan: acatlanDeliveryDetailAction,
  sitex: sitexDeliveryDetailAction,
  broderie: broderieDeliveryDetailAction,
  allende: allendeDeliveryDetailAction,
};

type LoadState =
  | { status: "loading" }
  | { status: "ready"; detail: WorkshopDeliveryDetail }
  | { status: "error"; message: string };

interface OpenedDelivery {
  id: string;
  code: string;
}

/**
 * Qué entrega está abierta y su ficha.
 *
 * La ficha se pide en el MISMO toque que abre la ventana, no en un efecto que
 * reaccione a la apertura: así hay una sola carga por toque y nada que
 * sincronizar después.
 */
export function useBoardDelivery(boardKey: WorkshopBoardKey) {
  const [opened, setOpened] = useState<OpenedDelivery | null>(null);
  const [state, setState] = useState<LoadState>({ status: "loading" });
  // La última pedida: si se abre otra antes de que llegue, la vieja se tira.
  const latest = useRef<string | null>(null);

  const load = useCallback(
    async (id: string) => {
      latest.current = id;
      setState({ status: "loading" });
      const result = await runAction(() => DETAIL_ACTIONS[boardKey]({ id }));
      if (latest.current !== id) return;

      setState(
        result.success
          ? { status: "ready", detail: result.data }
          : { status: "error", message: result.error },
      );
    },
    [boardKey],
  );

  const open = useCallback(
    (delivery: OpenedDelivery) => {
      setOpened(delivery);
      void load(delivery.id);
    },
    [load],
  );

  const close = useCallback(() => {
    latest.current = null;
    setOpened(null);
  }, []);

  return { opened, state, open, close, reload: load };
}

interface Props {
  delivery: ReturnType<typeof useBoardDelivery>;
  /** Sólo el taller dueño confirma; ADMIN nada más mira. */
  isOwner: boolean;
}

/**
 * La ficha completa de una entrega, sin salir del tablero.
 *
 * Se pide al abrir y no viene con el tablero: trae los cortes de la orden, y
 * cargarlos para cada tarjeta haría lento el tablero justo en el celular.
 */
export function BoardDeliveryDialog({ delivery, isOwner }: Props) {
  const { opened, state, close, reload } = delivery;

  return (
    <ResponsiveFormDialog
      open={opened !== null}
      onOpenChange={(open) => !open && close()}
      title={opened ? `Entrega ${opened.code}` : "Entrega"}
      wide
    >
      <DialogBody
        state={state}
        isOwner={isOwner}
        // Recibida desde aquí: se vuelve a leer para enseñar quién y cuándo.
        onReceived={() => opened && void reload(opened.id)}
      />
    </ResponsiveFormDialog>
  );
}

function DialogBody({
  state,
  isOwner,
  onReceived,
}: {
  state: LoadState;
  isOwner: boolean;
  onReceived: () => void;
}) {
  if (state.status === "loading") {
    return (
      <div className="flex flex-col gap-3 pb-4">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (state.status === "error") {
    return <p className="pb-4 text-sm text-muted-foreground">{state.message}</p>;
  }

  if (state.detail.state === "CANCELLED") {
    return <CancelledDelivery code={state.detail.code} />;
  }

  return (
    <div className="pb-4">
      <DeliveryDetail
        delivery={state.detail}
        canReceive={isOwner}
        onReceived={onReceived}
      />
    </div>
  );
}
