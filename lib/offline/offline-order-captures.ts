"use client";

import { todayInputValue } from "@/lib/utils";
import { captureWithLocalCode, type CapturedWithCode } from "./capture";

/** Un bulto capturado: el renglón de la orden, piezas por bulto y bultos. */
export interface OfflineCutLine {
  lineId: string;
  quantity: number;
  bundles: number;
  tagId?: string;
}

export interface OfflineCutDraft {
  orderId: string;
  newBatchLabel?: string;
  notes?: string;
  lines: OfflineCutLine[];
}

/** Un bulto que sale al taller: la talla, piezas por bulto y bultos. */
export interface OfflineShipmentLine {
  sizeId: string;
  sentQuantity: number;
  bundles: number;
  tagId?: string;
  notes?: string;
}

export interface OfflineShipmentDraft {
  orderId: string;
  workshopId: string;
  stageId: string;
  sentAt: string;
  parts?: string;
  reference?: string;
  lines: OfflineShipmentLine[];
}

/**
 * Captura un corte que puede no tener señal. Siempre estrena un corte: el
 * número ("3er corte") lo pone el servidor al subirlo, el que siga en la
 * orden en ese momento.
 */
export function captureOfflineCut(
  draft: OfflineCutDraft,
  summary: string,
): Promise<CapturedWithCode<{ code: string }>> {
  return captureWithLocalCode(
    "cut.create",
    (offlineId) => ({ offlineId, batch: draft }),
    summary,
    draft.orderId,
  );
}

/**
 * Captura un envío a taller que puede no tener señal. El folio ENV y el de
 * su vale los pone el servidor al subirlo, los que sigan en la serie.
 *
 * La fecha de salida es la del celular al capturar, igual que la salida: las
 * prendas salieron hoy aunque la señal vuelva mañana.
 */
export function captureOfflineShipment(
  draft: OfflineShipmentDraft,
  summary: string,
): Promise<CapturedWithCode<{ code: string }>> {
  return captureWithLocalCode(
    "shipment.create",
    (offlineId) => ({ offlineId, shipment: { ...draft, sentAt: draft.sentAt || todayInputValue() } }),
    summary,
    draft.orderId,
  );
}
