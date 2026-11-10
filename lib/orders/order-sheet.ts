import type { Prisma } from "@prisma/client";
import { bundlePieces } from "@/lib/bundles";
import {
  CUT_VERSION_LABELS,
  CUTTING_ORDER_STATUS_LABELS,
  cutBatchLabel,
} from "@/lib/constants/labels";
import { cutProgress, cutTotals, formatDate, formatDateTime } from "@/lib/utils";
import type { VoucherField } from "@/lib/vouchers/voucher-sheet";

/**
 * LA HOJA DE LA ORDEN, ya resuelta: lo que dice el papel, sin saber cómo se
 * pinta.
 *
 * Igual que el vale, la orden se dibuja en dos lados —la página de impresión
 * (HTML) y el PDF que abre el taller en el celular (react-pdf)—. Si cada uno
 * decidiera por su cuenta qué campos van o cómo se cuentan los faltantes, el
 * taller leería en el teléfono una hoja distinta de la que tiene en la mesa.
 */

/** Lo que hay que leer de la base para armar la hoja. */
export const ORDER_SHEET_INCLUDE = {
  client: { select: { name: true } },
  material: { select: { code: true, name: true } },
  productionRun: { select: { code: true, name: true } },
  createdBy: { select: { name: true } },
  lines: {
    orderBy: { position: "asc" },
    include: {
      size: { select: { code: true, name: true } },
      cutTag: { select: { name: true } },
      progress: {
        orderBy: { createdAt: "asc" },
        include: {
          user: { select: { name: true } },
          batch: { select: { number: true, label: true } },
        },
      },
    },
  },
} satisfies Prisma.CuttingOrderInclude;

export type SheetOrder = Prisma.CuttingOrderGetPayload<{
  include: typeof ORDER_SHEET_INCLUDE;
}>;

export interface OrderSheetLine {
  id: string;
  sizeCode: string;
  tagName: string;
  ordered: number;
  cut: number;
  /** Vacío cuando no falta nada: en papel, un cero distrae más que un hueco. */
  pending: string;
  surplus: string;
  notes: string;
}

export interface OrderSheetHistoryEntry {
  id: string;
  at: string;
  batch: string;
  sizeCode: string;
  /** "3 × 60" cuando se amarró en varios bultos. */
  bundles: string;
  pieces: string;
  userName: string;
  notes: string;
}

export interface OrderSheet {
  code: string;
  orderedAt: string;
  status: string;
  /** Sólo los campos que traen dato. */
  header: VoucherField[];
  /** Numeradas en el papel: el taller las palomea una por una. */
  cutNotes: string[];
  lines: OrderSheetLine[];
  totals: { ordered: number; cut: number; pending: string; surplus: string };
  history: OrderSheetHistoryEntry[];
  notes: string | null;
}

/** De la orden leída a la hoja que se dibuja. Función pura. */
export function toOrderSheet(order: SheetOrder): OrderSheet {
  const totals = cutTotals(order.lines);

  return {
    code: order.code,
    orderedAt: formatDate(order.orderedAt),
    status: CUTTING_ORDER_STATUS_LABELS[order.status],
    header: headerOf(order),
    cutNotes: order.cutNotes,
    lines: order.lines.map(toLine),
    totals: {
      ordered: totals.ordered,
      cut: totals.cut,
      pending: blankIfZero(totals.pending),
      surplus: totals.surplus > 0 ? `+${totals.surplus}` : "",
    },
    history: historyOf(order),
    notes: order.notes,
  };
}

/** Nombre del archivo: el folio, que es como se busca en el teléfono. */
export function orderSheetFileName(sheet: Pick<OrderSheet, "code">): string {
  return `${sheet.code}.pdf`;
}

function blankIfZero(value: number): string {
  return value > 0 ? String(value) : "";
}

/*
 * El encabezado del corte (tela, molde, versión) va en la MISMA rejilla que
 * el resto: en la hoja el taller lee molde y versión junto a la tela, no en
 * otra parte de la página.
 */
function headerOf(order: SheetOrder): VoucherField[] {
  const fields: [string, string | null | undefined][] = [
    ["Cliente", order.client?.name ?? "Fábrica"],
    ["Descripción", order.description],
    ["Folio de orden", order.reference],
    ["PO cliente", order.clientPo],
    ["Entrega", order.dueDate ? formatDate(order.dueDate) : null],
    ["Lugar de entrega", order.deliveryPlace],
    [
      "Material",
      order.material ? `${order.material.code} · ${order.material.name}` : null,
    ],
    [
      "Producción",
      order.productionRun
        ? `${order.productionRun.code} · ${order.productionRun.name ?? ""}`
        : null,
    ],
    ["Capturó", order.createdBy?.name],
    ["Tela (a mano)", order.cutFabricText],
    ["Molde", order.cutPattern],
    ["Versión", order.cutVersion ? CUT_VERSION_LABELS[order.cutVersion] : null],
    ["Cambios de la versión", order.cutVersionNotes],
  ];

  return fields.flatMap(([label, value]) => (value ? [{ label, value }] : []));
}

function toLine(line: SheetOrder["lines"][number]): OrderSheetLine {
  const progress = cutProgress(line.orderedQuantity, line.cutQuantity);

  return {
    id: line.id,
    sizeCode: line.size.code,
    tagName: line.cutTag?.name ?? "",
    ordered: line.orderedQuantity,
    cut: line.cutQuantity,
    pending: blankIfZero(progress.pending),
    surplus: progress.surplus > 0 ? `+${progress.surplus}` : "",
    // La anotación de la talla ("va sin bolsa") es una instrucción para quien
    // corta: una nota que sólo existe en la pantalla no sirve en la mesa.
    notes: line.notes ?? "",
  };
}

/**
 * El historial completo y no sólo el acumulado: la hoja se guarda, y meses
 * después la pregunta no es "cuántas se cortaron" sino "quién cortó estas y
 * cuándo", que un total no puede responder.
 */
function historyOf(order: SheetOrder): OrderSheetHistoryEntry[] {
  return order.lines
    .flatMap((line) =>
      line.progress.map((entry) => ({ entry, sizeCode: line.size.code })),
    )
    .sort((a, b) => a.entry.createdAt.getTime() - b.entry.createdAt.getTime())
    .map(({ entry, sizeCode }) => ({
      id: entry.id,
      at: formatDateTime(entry.createdAt),
      batch: cutBatchLabel(entry.batch.number, entry.batch.label),
      sizeCode,
      bundles:
        entry.bundles > 1
          ? `${entry.bundles} × ${entry.quantity}`
          : String(entry.bundles),
      pieces: `${entry.quantity > 0 ? "+" : ""}${bundlePieces(entry)}`,
      userName: entry.user?.name ?? "",
      notes: entry.notes ?? "",
    }));
}
