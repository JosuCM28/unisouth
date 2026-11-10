import type {
  DeliveryKind,
  DeliveryProgress,
  WorkshopDeliveryState,
} from "@/lib/constants/workshop-access";
import type {
  ShipmentReportRow,
  VoucherReportRow,
} from "@/lib/repositories/workshop-report.repository";
import {
  NO_CLIENT_LABEL,
  NO_DESCRIPTION_LABEL,
  VOUCHER_STAGE_LABEL,
  voucherReference,
} from "@/lib/services/workshop-delivery.service";
import { cutBatchLabel } from "@/lib/constants/labels";
import { toDateInputValue } from "@/lib/utils";
import { deliveryState, voucherDeliveryState } from "@/lib/workshop-delivery";
import type { SearchableDelivery } from "@/lib/workshop-delivery-search";

export interface ReportDeliveryLine {
  sizeCode: string;
  tagName: string;
  bundles: number;
  perBundle: number;
  pieces: number;
  notes: string;
}

/** Una entrega del taller, aplanada para el reporte. */
export interface ReportDelivery extends SearchableDelivery {
  kind: DeliveryKind;
  progress: DeliveryProgress;
  fabric: string | null;
  parts: string | null;
  sentAt: Date;
  dispatchedAt: Date | null;
  receivedAt: Date | null;
  receivedByName: string | null;
  receivedNotes: string | null;
  pieces: number;
  bundles: number;
  /** Días de la salida de planta a la confirmación del taller. */
  daysToReceive: number | null;
  /** Días que lleva esperando, si sigue por recibir. */
  daysWaiting: number | null;
  lines: ReportDeliveryLine[];
}

/** Lo que cada origen aporta; lo demás se calcula igual para los dos. */
interface DeliveryBase extends Omit<
  ReportDelivery,
  "progress" | "pieces" | "bundles" | "daysToReceive" | "daysWaiting"
> {
  state: WorkshopDeliveryState;
}

function dayDiff(from: Date, to: Date): number {
  const start = Date.parse(`${toDateInputValue(from)}T00:00:00Z`);
  const end = Date.parse(`${toDateInputValue(to)}T00:00:00Z`);
  return Math.max(0, Math.round((end - start) / 86_400_000));
}

function progressOf(base: DeliveryBase): DeliveryProgress {
  if (base.state === "CANCELLED") return "CANCELLED";
  if (base.state === "RECEIVED") return "RECEIVED";
  return base.dispatchedAt ? "IN_TRANSIT" : "IN_PLANT";
}

/**
 * Los días se cuentan desde que SALIÓ de la planta, no desde que se capturó:
 * un corte que esperó tres días en la mesa a que vinieran por él no es
 * tardanza del taller. Lo capturado antes de existir el botón Enviar no tiene
 * salida, y ahí se toma la fecha de envío.
 */
function complete(base: DeliveryBase, today: Date): ReportDelivery {
  const start = base.dispatchedAt ?? base.sentAt;
  const progress = progressOf(base);

  return {
    ...base,
    progress,
    pieces: base.lines.reduce((sum, line) => sum + line.pieces, 0),
    bundles: base.lines.reduce((sum, line) => sum + line.bundles, 0),
    daysToReceive: base.receivedAt ? dayDiff(start, base.receivedAt) : null,
    daysWaiting: progress === "IN_TRANSIT" || progress === "IN_PLANT"
      ? dayDiff(start, today)
      : null,
  };
}

/**
 * Una cancelada viaja SIN sus datos, igual que en la pantalla del taller: el
 * folio, la fecha y que se canceló. "No la podrán ver" se cumple también en
 * el Excel, que es justo el archivo que se reenvía.
 */
function cancelled(
  kind: DeliveryKind,
  code: string,
  sentAt: Date,
): ReportDelivery {
  return {
    kind,
    code,
    state: "CANCELLED",
    progress: "CANCELLED",
    orderReference: "",
    clientPo: null,
    clientName: "",
    description: "",
    stageName: "",
    fabric: null,
    parts: null,
    sentAt,
    dispatchedAt: null,
    receivedAt: null,
    receivedByName: null,
    receivedNotes: null,
    pieces: 0,
    bundles: 0,
    daysToReceive: null,
    daysWaiting: null,
    lines: [],
  };
}

export function fromShipment(row: ShipmentReportRow, today: Date): ReportDelivery {
  const state = deliveryState({
    status: row.status,
    documentStatus: row.document?.status ?? null,
    receivedAt: row.receivedAt,
  });
  if (state === "CANCELLED") return cancelled("shipment", row.code, row.sentAt);

  return complete(
    {
      kind: "shipment",
      code: row.code,
      state,
      orderReference: row.order.reference ?? row.order.code,
      clientPo: row.order.clientPo,
      clientName: row.order.client?.name ?? NO_CLIENT_LABEL,
      description: row.order.description ?? NO_DESCRIPTION_LABEL,
      stageName: row.stage.name,
      fabric: row.order.material?.name ?? row.order.cutFabricText,
      parts: row.parts,
      sentAt: row.sentAt,
      dispatchedAt: row.dispatchedAt,
      receivedAt: row.receivedAt,
      receivedByName: row.receivedBy?.name ?? null,
      receivedNotes: row.receivedNotes,
      lines: row.lines.map((line) => ({
        sizeCode: line.size.code,
        tagName: line.cutTag?.name ?? "",
        bundles: line.bundles,
        perBundle: line.sentQuantity,
        pieces: line.sentQuantity * line.bundles,
        notes: line.notes ?? "",
      })),
    },
    today,
  );
}

export function fromVoucher(row: VoucherReportRow, today: Date): ReportDelivery {
  const state = voucherDeliveryState({
    status: row.status,
    receivedAt: row.workshopReceivedAt,
  });
  if (state === "CANCELLED") return cancelled("voucher", row.code, row.date);

  const batch = row.cuttingBatch
    ? ` · ${cutBatchLabel(row.cuttingBatch.number, row.cuttingBatch.label)}`
    : "";

  return complete(
    {
      kind: "voucher",
      code: row.code,
      state,
      orderReference: voucherReference(row),
      // La PO del vale si la trae; si no, la de la orden de donde salió.
      clientPo: row.clientPo ?? row.cuttingOrder?.clientPo ?? null,
      clientName: row.client?.name ?? NO_CLIENT_LABEL,
      description:
        row.cutDescription ??
        row.cuttingOrder?.description ??
        row.concept ??
        NO_DESCRIPTION_LABEL,
      stageName: `${VOUCHER_STAGE_LABEL}${batch}`,
      fabric: row.cutFabric?.name ?? row.cutFabricText,
      parts: null,
      sentAt: row.date,
      dispatchedAt: row.dispatchedAt,
      receivedAt: row.workshopReceivedAt,
      receivedByName: row.workshopReceivedBy?.name ?? null,
      receivedNotes: row.workshopReceivedNotes,
      lines: row.cutLines.map((line) => ({
        sizeCode: line.size.code,
        tagName: line.cutTag?.name ?? "",
        bundles: line.bundles,
        perBundle: line.quantity,
        pieces: line.quantity * line.bundles,
        notes: line.notes ?? "",
      })),
    },
    today,
  );
}
