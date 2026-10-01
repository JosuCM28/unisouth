import { attributeBundles, type AllocationTarget } from "./folder-cut-allocation";
import { mergeLegacyFragments } from "./legacy-global-cut";
import type { SplitBundle } from "./workshop-split";

/** Un corte que se puede incluir en el reparto a talleres. */
export interface SplitCut {
  id: string;
  /** "PO-2026-0109 · 1er corte", o "Corte global · Corte conjunto". */
  label: string;
  /**
   * El nombre del corte SIN la orden ("2º corte"). Junta los cortes del mismo
   * número de todas las órdenes del pedido: lo normal es repartir "el segundo
   * corte de cada orden", no ir palomeando orden por orden.
   */
  round?: string;
  bundles: SplitBundle[];
  /**
   * Corte global capturado antes de guardarse sus bultos reales: sus bultos
   * se RECONSTRUYEN de los pedazos por orden y conviene confirmarlos.
   */
  partial?: boolean;
}

/** La forma mínima que se lee de cada orden. La da `findSendableCuts`. */
interface SourceOrder {
  id: string;
  code: string;
  lines: {
    id: string;
    sizeId: string;
    tagId: string | null;
    notes: string | null;
    size: { code: string };
  }[];
  batches: {
    id: string;
    number: number;
    label: string | null;
    groupId: string | null;
    entries: {
      lineId: string;
      quantity: number;
      bundles: number;
      tagId: string | null;
    }[];
  }[];
}

/** Un renglón de la captura física de un corte global. */
interface CapturedRow {
  groupId: string;
  sizeCode: string;
  quantity: number;
  bundles: number;
  tagId: string | null;
}

type Line = SourceOrder["lines"][number];

/**
 * Los cortes del pedido listos para el reparto a talleres, con BULTOS REALES.
 *
 * Un corte global se reparte entre órdenes partiendo bultos —un bulto de 101
 * queda en 60 para una orden y 41 para otra—, y esos pedazos no son lo que se
 * carga en el camión. Por eso, cuando el corte guardó su captura física, el
 * reparto trabaja con ella, y cada bulto lleva dicho qué parte es de qué orden
 * para que el envío a taller siga naciendo por orden.
 *
 * Sin captura (cortes globales de antes) se cae a los pedazos y se avisa.
 */
export function buildFolderSplitCuts(
  orders: SourceOrder[],
  captured: CapturedRow[],
  batchLabel: (number: number, label: string | null) => string,
): SplitCut[] {
  const capturedByGroup = groupRows(captured);
  const globals = new Map<string, GlobalCut>();
  const cuts: SplitCut[] = [];

  for (const order of orders) {
    const lineById = new Map(order.lines.map((line) => [line.id, line]));

    for (const batch of order.batches) {
      const label = batchLabel(batch.number, batch.label);

      if (!batch.groupId) {
        cuts.push({
          id: batch.id,
          label: `${order.code} · ${label}`,
          round: label,
          bundles: fragments(order, batch.entries, lineById),
        });
        continue;
      }

      const global: GlobalCut = globals.get(batch.groupId) ?? {
        id: batch.groupId,
        label: `Corte global · ${label}`,
        round: label,
        targets: [],
        fragments: [],
        lines: new Map(),
      };

      for (const line of order.lines) {
        const share = batch.entries
          .filter((entry) => entry.lineId === line.id)
          .reduce((sum, entry) => sum + entry.quantity * entry.bundles, 0);
        if (share <= 0) continue;

        global.targets.push({
          orderId: order.id,
          orderCode: order.code,
          lineId: line.id,
          sizeKey: line.size.code,
          pending: share,
        });
        global.lines.set(line.id, line);
      }

      /* El respaldo sin captura: los pedazos vueltos a juntar, porque el
         repartidor de antes partía un bulto en "lo que faltaba + lo que
         sobró" dentro de la misma orden. */
      global.fragments.push(
        ...fragments(order, mergeLegacyFragments(batch.entries), lineById),
      );
      globals.set(batch.groupId, global);
    }
  }

  for (const global of globals.values()) {
    cuts.push(toGlobalCut(global, capturedByGroup.get(global.id) ?? []));
  }

  return cuts.filter((cut) => cut.bundles.length > 0);
}

/** Lo que se junta de un corte global mientras se recorren sus órdenes. */
interface GlobalCut {
  id: string;
  label: string;
  round: string;
  /** Lo que CADA renglón recibió de este corte: contra eso se reparte. */
  targets: AllocationTarget[];
  /** Los pedazos tal como quedaron por orden: el respaldo sin captura. */
  fragments: SplitBundle[];
  lines: Map<string, Line>;
}

/**
 * Un corte global con sus bultos físicos, o con sus pedazos si no hay captura
 * o si la captura ya no cuadra con lo que tienen las órdenes (alguien corrigió
 * el corte de una orden por su lado): un reparto sobre bultos que no suman lo
 * mismo que las órdenes mandaría al taller piezas que no existen.
 */
function toGlobalCut(global: GlobalCut, rows: CapturedRow[]): SplitCut {
  const fallback = {
    id: global.id,
    label: global.label,
    round: global.round,
    bundles: global.fragments,
    partial: true,
  };
  if (rows.length === 0 || !sameTotals(global.targets, rows)) return fallback;

  const physical = attributeBundles(
    global.targets,
    rows.map((row) => ({
      sizeKey: row.sizeCode,
      quantity: row.quantity,
      bundles: row.bundles,
      tagId: row.tagId ?? undefined,
    })),
  );

  const bundles: SplitBundle[] = physical.map((bundle) => {
    const first = global.lines.get(bundle.parts[0]?.lineId ?? "");

    return {
      sizeCode: bundle.sizeKey,
      pieces: bundle.quantity,
      count: 1,
      sizeId: first?.sizeId,
      tagId: bundle.tagId ?? first?.tagId ?? null,
      note: first?.notes ?? null,
      parts: bundle.parts.map((part) => {
        const line = global.lines.get(part.lineId);
        return {
          orderId: part.orderId,
          orderCode: part.orderCode,
          sizeId: line?.sizeId ?? "",
          pieces: part.pieces,
          note: line?.notes ?? null,
        };
      }),
    };
  });

  return { id: global.id, label: global.label, round: global.round, bundles };
}

/** Si la captura suma, talla por talla, lo mismo que recibieron las órdenes. */
function sameTotals(targets: AllocationTarget[], rows: CapturedRow[]): boolean {
  const balance = new Map<string, number>();

  for (const target of targets) {
    balance.set(target.sizeKey, (balance.get(target.sizeKey) ?? 0) + target.pending);
  }
  for (const row of rows) {
    const pieces = row.quantity * row.bundles;
    balance.set(row.sizeCode, (balance.get(row.sizeCode) ?? 0) - pieces);
  }

  return [...balance.values()].every((value) => value === 0);
}

/** Las capturas de una orden tal como están guardadas, una por renglón. */
function fragments(
  order: SourceOrder,
  entries: SourceOrder["batches"][number]["entries"],
  lineById: Map<string, Line>,
): SplitBundle[] {
  return entries.flatMap((entry) => {
    const line = lineById.get(entry.lineId);
    if (!line) return [];

    return [
      {
        sizeCode: line.size.code,
        pieces: entry.quantity,
        count: entry.bundles,
        sizeId: line.sizeId,
        orderId: order.id,
        orderCode: order.code,
        // Igual que en el vale: el foleo del bulto manda sobre el del renglón.
        tagId: entry.tagId ?? line.tagId,
        note: line.notes,
      },
    ];
  });
}

function groupRows(rows: CapturedRow[]): Map<string, CapturedRow[]> {
  const map = new Map<string, CapturedRow[]>();
  for (const row of rows) map.set(row.groupId, [...(map.get(row.groupId) ?? []), row]);
  return map;
}
