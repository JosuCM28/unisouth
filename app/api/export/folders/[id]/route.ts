import { requirePermission } from "@/lib/core/session";
import { enforceRateLimit, EXPORT_LIMIT } from "@/lib/core/rate-limit";
import { OrderFolderRepository } from "@/lib/repositories/order-folder.repository";
import {
  toXlsxDocument,
  xlsxResponse,
  type SheetRow,
} from "@/lib/export/xlsx";
import { formatDate } from "@/lib/utils";

/**
 * EL CONCENTRADO del pedido: una columna por orden, un renglón por talla.
 *
 * Es la hoja que la fábrica ya hacía a mano. Llegan cinco órdenes del mismo
 * cliente, cada una con su número de compra y su desglose por talla, y lo que
 * se necesita para tender la tela no es ninguna de las cinco: es la suma.
 * Sumarlas a mano talla por talla es donde se cuela el error que luego se
 * corta de más.
 *
 * Sale con lo PEDIDO y no con lo cortado: el concentrado se usa ANTES de
 * cortar, para saber cuánto hay que tender. El avance se consulta en la ficha
 * de cada orden, que es donde vive.
 *
 * Los totales viajan como FÓRMULA, no como número. Quien lo recibe casi
 * siempre corrige una talla antes de mandarlo a la mesa, y con el total
 * congelado esa corrección deja la hoja mintiendo sin que se note.
 *
 * La rejilla, con N órdenes:
 *
 *   A       B          C          …   (1+N)      (2+N)
 *   Talla   Orden 1    Orden 2    …   Orden N    A cortar
 */

/** Ancho de la primera columna y de la de totales; las de en medio, parejas. */
const SIZE_WIDTH = 16;
const ORDER_WIDTH = 15;
const TOTAL_WIDTH = 16;

/**
 * Tope de órdenes que caben en la hoja.
 *
 * No es un límite del negocio sino de la hoja: pasando de esto el concentrado
 * deja de leerse de un vistazo —que es su única razón de existir— y se vuelve
 * una tabla que hay que recorrer de lado. El aviso sale en la hoja, no en
 * silencio.
 */
const MAX_ORDERS = 30;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  // Recorre el pedido entero con todas sus tallas: sin tope es un vector de
  // denegación, igual que las demás descargas.
  await enforceRateLimit("export:folder", EXPORT_LIMIT);
  /* La misma llave que abre el pedido: quien puede contestar "¿cómo va?" puede
     mandar el concentrado, aunque no capture nada. */
  await requirePermission("orders:browse");

  const { id } = await params;

  const folder = await new OrderFolderRepository().findForConcentrate(id);
  if (!folder) return new Response("Pedido no encontrado", { status: 404 });

  const shown = folder.orders.slice(0, MAX_ORDERS);
  const hidden = folder.orders.length - shown.length;

  const grid = buildGrid(shown);

  /* El encabezado se arma PRIMERO y su largo es lo que le dice a la tabla en
     qué fila de Excel empieza. Contar esos renglones a mano es el error que se
     paga caro: un dato de más arriba recorre la rejilla, las fórmulas siguen
     sumando y suman otras celdas, y la hoja sale con totales creíbles y
     falsos. */
  const header: SheetRow[] = [
    ...headerRows(folder, shown.length),
    ...orderHeaderRows(shown),
  ];

  const rows: SheetRow[] = [
    ...header,
    ...sizeRows(grid, shown.length, header.length + 1),
    ...noteRows(grid),
    ...hiddenNotice(hidden),
  ];

  const widths = [
    SIZE_WIDTH,
    ...shown.map(() => ORDER_WIDTH),
    TOTAL_WIDTH,
  ];

  return xlsxResponse(
    toXlsxDocument(rows, widths, "Total a cortar"),
    `total-a-cortar-${folder.code}`,
  );
}

// ═══════════════════════════════════════════════════════════════════════════
//  Tipos de lectura
// ═══════════════════════════════════════════════════════════════════════════

type Folder = NonNullable<
  Awaited<ReturnType<OrderFolderRepository["findForConcentrate"]>>
>;
type Order = Folder["orders"][number];

/** Un renglón de la rejilla: una talla y lo que pide cada orden de ella. */
interface SizeRow {
  code: string;
  order: number;
  /** Indexado por posición de la orden en la hoja. Sin pedir = `undefined`. */
  quantities: (number | undefined)[];
  /** Las anotaciones de esa talla, con la orden de la que salieron. */
  notes: { orderCode: string; text: string }[];
}

/** La primera columna de datos. La A es la talla. */
const FIRST_ORDER_COLUMN = 2;

/** Columna de Excel: 1 → A, 27 → AA. */
function columnName(index: number): string {
  let name = "";
  let n = index;

  while (n > 0) {
    const remainder = (n - 1) % 26;
    name = String.fromCharCode(65 + remainder) + name;
    n = Math.floor((n - 1) / 26);
  }

  return name;
}

/**
 * Cruza las órdenes en una rejilla de talla × orden.
 *
 * Se agrupa por CÓDIGO de talla y no por id porque el concentrado es la hoja
 * del piso: dos catálogos distintos que dicen "38" son la misma talla para
 * quien tiende la tela, y partirlas en dos renglones sería justo el error que
 * esta hoja viene a evitar.
 *
 * Una orden puede traer la misma talla en dos renglones —con foleos
 * distintos— y sus cantidades se SUMAN en la celda: la columna dice cuánto
 * pide esa orden de esa talla, no cuántos renglones capturó.
 */
function buildGrid(orders: Order[]): SizeRow[] {
  const bySize = new Map<string, SizeRow>();

  orders.forEach((order, index) => {
    for (const line of order.lines) {
      const row = bySize.get(line.size.code) ?? {
        code: line.size.code,
        order: line.size.order,
        quantities: Array.from({ length: orders.length }, () => undefined),
        notes: [],
      };

      row.quantities[index] =
        (row.quantities[index] ?? 0) + line.orderedQuantity;

      if (line.notes) {
        row.notes.push({ orderCode: order.code, text: line.notes });
      }

      bySize.set(line.size.code, row);
    }
  });

  /* En el orden del catálogo, que es el de la talla física: 28, 30, 32. Por
     código alfabético la 30 caería antes que la 4. */
  return [...bySize.values()].sort(
    (a, b) => a.order - b.order || a.code.localeCompare(b.code),
  );
}

// ═══════════════════════════════════════════════════════════════════════════
//  Bloques de la hoja
// ═══════════════════════════════════════════════════════════════════════════

/** El membrete del pedido. Lo que se lee antes de mirar un solo número. */
function headerRows(folder: Folder, orderCount: number): SheetRow[] {
  const last = FIRST_ORDER_COLUMN + orderCount;

  const pairs: [string, string][] = [
    ["Pedido", `${folder.code} · ${folder.name}`],
    ["Cliente", folder.client?.name ?? "Fábrica"],
    ["Orden del cliente", folder.reference ?? "—"],
    ["Entrega", folder.dueDate ? formatDate(folder.dueDate) : "—"],
    ["Órdenes", String(orderCount)],
  ];

  return [
    [
      { at: 1, value: "UNISOUTH", style: "title", mergeTo: last },
    ],
    [
      { at: 1, value: "Total a cortar · concentrado por talla", style: "section", mergeTo: last },
    ],
    [],
    ...pairs.map(
      ([label, value]): SheetRow => [
        { at: 1, value: `${label}:`, style: "label" },
        { at: FIRST_ORDER_COLUMN, value, mergeTo: last },
      ],
    ),
  ];
}

/**
 * Los tres renglones que encabezan cada columna: orden, O.C. y prenda.
 *
 * La O.C. es la que pide el cliente por teléfono y la que va escrita en el
 * papel que llegó; el folio interno es con el que se busca en el sistema. Las
 * dos hacen falta y ninguna sustituye a la otra.
 *
 * La prenda va porque un pedido junta órdenes de prendas distintas —camisa,
 * pantalón— y sin ella el concentrado suma tallas de cosas que no se tienden
 * juntas sin avisar de qué son.
 */
function orderHeaderRows(orders: Order[]): SheetRow[] {
  const totalColumn = FIRST_ORDER_COLUMN + orders.length;

  function labelled(
    label: string,
    pick: (order: Order) => string,
  ): SheetRow {
    return [
      { at: 1, value: label, style: "label" },
      ...orders.map((order, index) => ({
        at: FIRST_ORDER_COLUMN + index,
        value: pick(order),
      })),
    ];
  }

  return [
    [],
    labelled("Orden", (order) => order.code),
    labelled("O.C. del cliente", (order) => order.reference ?? "—"),
    labelled("Prenda", (order) => order.description ?? "—"),
    labelled(
      "Tela",
      (order) => order.material?.name ?? order.cutFabricText ?? "—",
    ),
    labelled("Molde", (order) => order.cutPattern ?? "—"),
    [],
    [
      { at: 1, value: "TALLA", style: "tableHeader" },
      ...orders.map((_, index) => ({
        at: FIRST_ORDER_COLUMN + index,
        value: `CANTIDAD ${index + 1}`,
        style: "tableHeaderRight" as const,
      })),
      { at: totalColumn, value: "A CORTAR", style: "tableHeaderRight" },
    ],
  ];
}

/**
 * El cuerpo de la rejilla y su renglón de totales.
 *
 * @param firstRow Fila de Excel donde cae la primera talla. La calcula quien
 * arma la hoja contando los renglones que ya escribió, porque la fórmula
 * apunta a filas REALES y no hay forma de saberlas desde aquí.
 */
function sizeRows(
  grid: SizeRow[],
  orderCount: number,
  firstRow: number,
): SheetRow[] {
  /* Un pedido recién creado no tiene órdenes, y una orden recién capturada
     puede no tener tallas todavía. Sin esto la hoja saldría con rangos al
     revés —`SUM(B17:A17)`— que Excel marca como error y dejan el archivo
     inservible justo cuando alguien lo abre por primera vez. */
  if (grid.length === 0 || orderCount === 0) {
    return [
      [
        {
          at: 1,
          value: "Este pedido todavía no tiene tallas capturadas.",
          style: "label",
        },
      ],
    ];
  }

  const totalColumn = FIRST_ORDER_COLUMN + orderCount;
  const totalLetter = columnName(totalColumn);
  const firstLetter = columnName(FIRST_ORDER_COLUMN);
  const lastLetter = columnName(totalColumn - 1);

  const lastRow = firstRow + grid.length - 1;

  const body = grid.map((size, index): SheetRow => {
    const row = firstRow + index;

    return [
      { at: 1, value: size.code, style: "label" },
      ...size.quantities.map((quantity, column) => ({
        at: FIRST_ORDER_COLUMN + column,
        // Vacío y no cero: una columna de ceros esconde las tallas que esa
        // orden sí pidió, que es lo único que se busca al leer de lado.
        value: quantity ?? "",
        kind: "number" as const,
      })),
      {
        at: totalColumn,
        formula: `SUM(${firstLetter}${row}:${lastLetter}${row})`,
        style: "totalNumber",
      },
    ];
  });

  const totals: SheetRow = [
    { at: 1, value: "TOTAL", style: "total" },
    ...Array.from({ length: orderCount }, (_, column) => {
      const letter = columnName(FIRST_ORDER_COLUMN + column);
      return {
        at: FIRST_ORDER_COLUMN + column,
        formula: `SUM(${letter}${firstRow}:${letter}${lastRow})`,
        style: "totalNumber" as const,
      };
    }),
    {
      at: totalColumn,
      formula: `SUM(${totalLetter}${firstRow}:${totalLetter}${lastRow})`,
      style: "totalNumber",
    },
  ];

  return [
    ...body,
    totals,
    [],
    [
      { at: 1, value: "TOTAL A CORTAR", style: "section" },
      {
        at: FIRST_ORDER_COLUMN,
        formula: `${totalLetter}${lastRow + 1}`,
        style: "total",
      },
    ],
  ];
}

/**
 * Las anotaciones de talla, al pie y con la orden de la que salieron.
 *
 * No caben en la rejilla —son texto libre y la celda es una cifra— pero no
 * pueden quedarse fuera: "la 38 va sin serigrafiar" es justo lo que se pierde
 * al concentrar cinco papeles en uno, y perderlo significa cortarlas mal.
 */
function noteRows(grid: SizeRow[]): SheetRow[] {
  const withNotes = grid.filter((size) => size.notes.length > 0);
  if (withNotes.length === 0) return [];

  return [
    [],
    [{ at: 1, value: "Anotaciones por talla", style: "section" }],
    [
      { at: 1, value: "Talla", style: "tableHeader" },
      { at: FIRST_ORDER_COLUMN, value: "Orden", style: "tableHeader" },
      { at: FIRST_ORDER_COLUMN + 1, value: "Anotación", style: "tableHeader" },
    ],
    ...withNotes.flatMap((size) =>
      size.notes.map(
        (note): SheetRow => [
          { at: 1, value: size.code, style: "label" },
          { at: FIRST_ORDER_COLUMN, value: note.orderCode },
          { at: FIRST_ORDER_COLUMN + 1, value: note.text },
        ],
      ),
    ),
  ];
}

/** El aviso de lo que no cupo. Nunca en silencio. */
function hiddenNotice(hidden: number): SheetRow[] {
  if (hidden <= 0) return [];

  return [
    [],
    [
      {
        at: 1,
        value: `Este pedido tiene ${hidden} ${hidden === 1 ? "orden más que no cupo" : "órdenes más que no cupieron"} en la hoja. Se muestran las primeras ${MAX_ORDERS} por fecha.`,
        style: "label",
      },
    ],
  ];
}
