import { CUTTING_ORDER_ORIGIN_LABELS } from "@/lib/constants/labels";
import { OrderFolderRepository } from "@/lib/repositories/order-folder.repository";
import { formatDate } from "@/lib/utils";
import type { PrintSetup, SheetRow } from "./xlsx";

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
 * Los totales van con su NÚMERO ya calculado y además con la fórmula que los
 * produce: se leen de inmediato en cualquier visor, y siguen moviéndose si
 * quien recibe la hoja corrige una talla antes de mandarla a la mesa.
 *
 * Vive aquí y no dentro de la ruta —igual que `cut-report-sheet`— porque el
 * armado de la hoja es la parte que se revisa y se prueba; la ruta sólo cuida
 * el permiso, el tope de descargas y la respuesta.
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

/** La hoja lista para empaquetar: renglones, anchos y cómo sale en papel. */
export interface ConcentrateSheet {
  rows: SheetRow[];
  widths: number[];
  print: PrintSetup;
}

export function buildConcentrateSheet(folder: Folder): ConcentrateSheet {
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

  return {
    rows: [
      ...header,
      ...sizeRows(grid, shown.length, header.length + 1),
      ...noteRows(grid),
      ...hiddenNotice(hidden),
    ],
    widths: [SIZE_WIDTH, ...shown.map(() => ORDER_WIDTH), TOTAL_WIDTH],
    print: {
      /* Horizontal y ajustada al ancho: con una columna por orden, en vertical
         un pedido de ocho se parte a la mitad y las últimas órdenes salen en
         una segunda hoja, separadas de sus tallas. */
      landscape: true,
      fitToWidth: true,
      /* El membrete y los encabezados se repiten en cada página. Una rejilla
         de muchas tallas se parte hacia abajo, y sin esto la segunda hoja
         llega con puros números y sin decir de qué orden es cada columna. */
      repeatRows: `$1:$${header.length}`,
    },
  };
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

  /* Cuadriculadas igual que la tabla: el bloque de encabezados y la rejilla
     son UNA sola caja en el papel, y dejar estos renglones sin borde parte la
     hoja en dos a la vista justo donde no hay corte. */
  function labelled(
    label: string,
    pick: (order: Order) => string,
  ): SheetRow {
    return [
      { at: 1, value: label, style: "gridTotal" },
      ...orders.map((order, index) => ({
        at: FIRST_ORDER_COLUMN + index,
        value: pick(order),
        style: "cell" as const,
      })),
      { at: totalColumn, value: "", style: "cell" as const },
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
    /* De qué planta salió cada columna, y SÓLO cuando el pedido de verdad
       mezcla las dos. Un renglón que dice "Esta planta" en las ocho columnas
       gasta el alto que la hoja necesita para caber en una página, y esta
       hoja existe para leerse de un vistazo. */
    ...(orders.some((order) => order.origin === "PLANT")
      ? [labelled("Planta", (order) => CUTTING_ORDER_ORIGIN_LABELS[order.origin])]
      : []),
    [
      { at: 1, value: "TALLA", style: "gridHeader" },
      ...orders.map((_, index) => ({
        at: FIRST_ORDER_COLUMN + index,
        value: `CANTIDAD ${index + 1}`,
        style: "gridHeader" as const,
      })),
      { at: totalColumn, value: "A CORTAR", style: "gridHeader" },
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

  /* Cada total va con su NÚMERO ya calculado además de la fórmula. La fórmula
     sola deja la celda vacía en todo lo que no recalcula al abrir —el visor de
     Windows, la vista previa de Drive, Excel del celular—, y la columna "A
     cortar" es justo la que se busca al abrir la hoja. Con el número escrito
     se lee de inmediato, y la fórmula sigue viva para cuando alguien corrija
     una talla. */
  const body = grid.map((size, index): SheetRow => {
    const row = firstRow + index;

    return [
      { at: 1, value: size.code, style: "cellStrong" },
      ...size.quantities.map((quantity, column) => ({
        at: FIRST_ORDER_COLUMN + column,
        // Vacío y no cero: una columna de ceros esconde las tallas que esa
        // orden sí pidió, que es lo único que se busca al leer de lado. La
        // celda igual lleva su cuadro, para que el renglón no salga partido.
        value: quantity ?? "",
        kind: "number" as const,
        style: "cellNumber" as const,
      })),
      {
        at: totalColumn,
        formula: `SUM(${firstLetter}${row}:${lastLetter}${row})`,
        value: rowTotal(size),
        kind: "number",
        style: "gridTotalNumber",
      },
    ];
  });

  const grandTotal = grid.reduce((sum, size) => sum + rowTotal(size), 0);

  const totals: SheetRow = [
    { at: 1, value: "TOTAL", style: "gridTotal" },
    ...Array.from({ length: orderCount }, (_, column) => {
      const letter = columnName(FIRST_ORDER_COLUMN + column);
      return {
        at: FIRST_ORDER_COLUMN + column,
        formula: `SUM(${letter}${firstRow}:${letter}${lastRow})`,
        value: columnTotal(grid, column),
        kind: "number" as const,
        style: "gridTotalNumber" as const,
      };
    }),
    {
      at: totalColumn,
      formula: `SUM(${totalLetter}${firstRow}:${totalLetter}${lastRow})`,
      value: grandTotal,
      kind: "number",
      style: "gridTotalNumber",
    },
  ];

  return [
    ...body,
    totals,
    [],
    /* La caja del papel: rótulo y cifra, los dos cuadriculados. Es lo que se
       busca primero al recoger la hoja de la impresora. */
    [
      { at: 1, value: "TOTAL A CORTAR", style: "gridHeader" },
      {
        at: FIRST_ORDER_COLUMN,
        formula: `${totalLetter}${lastRow + 1}`,
        value: grandTotal,
        kind: "number",
        style: "gridTotalNumber",
      },
    ],
  ];
}

/** Lo que suma una talla entre todas las órdenes: la columna "A cortar". */
function rowTotal(size: SizeRow): number {
  /* El acumulador se declara: las celdas son `number | undefined` —una orden
     que no pidió esa talla no tiene celda— y sin el tipo, TypeScript arrastra
     el `undefined` al resultado. */
  return size.quantities.reduce<number>(
    (sum, quantity) => sum + (quantity ?? 0),
    0,
  );
}

/** Lo que suma una orden entre todas sus tallas: el pie de su columna. */
function columnTotal(grid: SizeRow[], column: number): number {
  return grid.reduce((sum, size) => sum + (size.quantities[column] ?? 0), 0);
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
      { at: 1, value: "Talla", style: "gridHeader" },
      { at: FIRST_ORDER_COLUMN, value: "Orden", style: "gridHeader" },
      { at: FIRST_ORDER_COLUMN + 1, value: "Anotación", style: "gridHeader" },
    ],
    ...withNotes.flatMap((size) =>
      size.notes.map(
        (note): SheetRow => [
          { at: 1, value: size.code, style: "cellStrong" },
          { at: FIRST_ORDER_COLUMN, value: note.orderCode, style: "cell" },
          { at: FIRST_ORDER_COLUMN + 1, value: note.text, style: "cell" },
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
