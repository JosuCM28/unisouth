"use client";

import { useState } from "react";
import { estimatedAvailable } from "@/lib/offline/local-stock";
import type { OfflineLot } from "@/lib/offline/snapshot.types";
import type { DraftLine } from "./offline-issue-lines";
import { EMPTY_DETAILS, type IssueDetails } from "./offline-issue-details";

/**
 * El borrador de la salida que se está capturando, en memoria.
 *
 * Cambiar de cliente vacía los renglones a propósito: los rollos son del
 * dueño, y dejar los del cliente anterior en una salida del nuevo sería
 * justo surtir tela de uno a la producción de otro.
 */
export function useIssueDraft() {
  const [clientId, setClientIdState] = useState("");
  const [lines, setLines] = useState<DraftLine[]>([]);
  const [details, setDetails] = useState<IssueDetails>(EMPTY_DETAILS);

  function setClientId(next: string) {
    setClientIdState(next);
    setLines([]);
  }

  function addLot(lot: OfflineLot, pendingByLot: Map<string, number>) {
    setLines((current) => [
      ...current,
      { lot, quantity: "", available: estimatedAvailable(lot, pendingByLot) },
    ]);
  }

  function changeQuantity(lotId: string, quantity: string) {
    setLines((current) =>
      current.map((line) => (line.lot.id === lotId ? { ...line, quantity } : line)),
    );
  }

  function removeLot(lotId: string) {
    setLines((current) => current.filter((line) => line.lot.id !== lotId));
  }

  /** Tras guardar: se queda el cliente, que suele repetirse en la siguiente. */
  function reset() {
    setLines([]);
    setDetails(EMPTY_DETAILS);
  }

  return {
    clientId,
    setClientId,
    lines,
    addLot,
    changeQuantity,
    removeLot,
    details,
    setDetails,
    reset,
  };
}
