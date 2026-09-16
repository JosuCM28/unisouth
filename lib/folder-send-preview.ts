import { sumBundlePieces, sumBundles } from "./bundles";
import { toCutLines, type CutEntry, type CutSourceLine } from "./cut-lines";

/**
 * Lo que va a salir del pedido, calculado ANTES de crear nada.
 *
 * El vale global y los envíos a taller nacen con folio propio: enterarse
 * después de que salieron con las tallas equivocadas obliga a cancelarlos. Por
 * eso la pantalla enseña primero qué viaja, y lo calcula con la MISMA función
 * que después arma los renglones —`toCutLines`—, para que lo que se ve y lo
 * que se crea no puedan diferir.
 *
 * Es puro: recibe lo ya leído y no consulta nada.
 */

/** Una talla del resumen: cuántas piezas y en cuántos bultos viaja. */
export interface PreviewSize {
  sizeId: string;
  sizeCode: string;
  pieces: number;
  bundles: number;
}

/** Un corte que no viaja porque ya salió, y en qué vale salió. */
export interface PreviewSkip {
  orderCode: string;
  batch: string;
  issueCode: string;
}

export interface FolderSendPreview {
  /** La salida global: sólo los cortes que NO han salido todavía. */
  issue: {
    sizes: PreviewSize[];
    pieces: number;
    bundles: number;
    orders: number;
    skipped: PreviewSkip[];
  };
  /**
   * El envío a taller: TODO lo cortado, se haya mandado antes o no.
   *
   * No filtra por "ya salió" a propósito: lo que va a un taller son paneles y
   * las mismas piezas pasan por bordado y luego por armado. Un filtro aquí
   * impediría la segunda etapa, que es trabajo normal.
   */
  workshop: {
    sizes: PreviewSize[];
    pieces: number;
    bundles: number;
    orders: number;
    /** Órdenes sin nada cortado. No hay qué mandar de ellas. */
    skippedOrders: string[];
  };
  /** Clientes distintos entre las órdenes. Con más de uno el vale no procede. */
  clients: number;
}

/** La forma mínima que necesita el resumen. La da `findSendableCuts`. */
export interface SendableOrder {
  code: string;
  clientId: string | null;
  lines: (CutSourceLine & { size: { code: string; order: number } })[];
  batches: {
    number: number;
    label: string | null;
    entries: CutEntry[];
    issues: { code: string }[];
    folderIssues: { code: string }[];
  }[];
}

export function buildFolderSendPreview(
  orders: SendableOrder[],
  batchLabel: (number: number, label: string | null) => string,
): FolderSendPreview {
  const issueRows: { sizeId: string; quantity: number; bundles: number }[] = [];
  const workshopRows: typeof issueRows = [];
  const skipped: PreviewSkip[] = [];
  const skippedOrders: string[] = [];
  const issueOrders = new Set<string>();
  const workshopOrders = new Set<string>();

  for (const order of orders) {
    /* Todo lo cortado de la orden, de un solo cruce: es lo que va al taller y
       la base contra la que se decide si hay algo que mandar. */
    const allEntries = order.batches.flatMap((batch) => batch.entries);
    const allCut = toCutLines(order.lines, allEntries);

    if (allCut.length === 0) {
      skippedOrders.push(order.code);
    } else {
      workshopRows.push(...allCut);
      workshopOrders.add(order.code);
    }

    for (const batch of order.batches) {
      const live = batch.issues[0] ?? batch.folderIssues[0];

      if (live) {
        skipped.push({
          orderCode: order.code,
          batch: batchLabel(batch.number, batch.label),
          issueCode: live.code,
        });
        continue;
      }

      const lines = toCutLines(order.lines, batch.entries);
      if (lines.length === 0) continue;

      issueRows.push(...lines);
      issueOrders.add(order.code);
    }
  }

  const codes = sizeCodes(orders);

  return {
    issue: {
      sizes: groupBySize(issueRows, codes),
      pieces: sumBundlePieces(issueRows),
      bundles: sumBundles(issueRows),
      orders: issueOrders.size,
      skipped,
    },
    workshop: {
      sizes: groupBySize(workshopRows, codes),
      pieces: sumBundlePieces(workshopRows),
      bundles: sumBundles(workshopRows),
      orders: workshopOrders.size,
      skippedOrders,
    },
    /* Sin dueño cuenta como uno: son órdenes de la propia fábrica y entre
       ellas no hay material cruzado que proteger. */
    clients: new Set(orders.map((order) => order.clientId ?? "—")).size,
  };
}

/** Código y posición de cada talla, para nombrarla y para ordenarla. */
function sizeCodes(
  orders: SendableOrder[],
): Map<string, { code: string; order: number }> {
  const codes = new Map<string, { code: string; order: number }>();

  for (const order of orders) {
    for (const line of order.lines) {
      codes.set(line.sizeId, {
        code: line.size.code,
        order: line.size.order,
      });
    }
  }

  return codes;
}

/**
 * Suma por talla, en el orden del catálogo.
 *
 * El resumen se lee talla por talla —es contra lo que se cuentan los bultos al
 * subirlos— y no orden por orden, que es como vienen los renglones.
 */
function groupBySize(
  rows: { sizeId: string; quantity: number; bundles: number }[],
  codes: Map<string, { code: string; order: number }>,
): PreviewSize[] {
  const bySize = new Map<string, PreviewSize>();

  for (const row of rows) {
    const size = bySize.get(row.sizeId) ?? {
      sizeId: row.sizeId,
      sizeCode: codes.get(row.sizeId)?.code ?? "—",
      pieces: 0,
      bundles: 0,
    };

    size.pieces += row.quantity * row.bundles;
    size.bundles += row.bundles;
    bySize.set(row.sizeId, size);
  }

  return [...bySize.values()].sort(
    (a, b) =>
      (codes.get(a.sizeId)?.order ?? 0) - (codes.get(b.sizeId)?.order ?? 0) ||
      a.sizeCode.localeCompare(b.sizeCode),
  );
}
