import type { CutVersion, CuttingOrderStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/core/session";
import { enforceRateLimit, EXPORT_LIMIT } from "@/lib/core/rate-limit";
import {
  toXlsxDocument,
  xlsxResponse,
  type SheetRow,
} from "@/lib/export/xlsx";
import {
  CUT_VERSION_LABELS,
  CUTTING_ORDER_STATUS_LABELS,
} from "@/lib/constants/labels";
import { cutProgress, formatDate } from "@/lib/utils";

/**
 * Una orden en Excel, con la misma forma de la hoja impresa.
 *
 * No es el reporte de órdenes: aquél lleva una fila por talla de muchas
 * órdenes para pivotear. Éste es UNA orden completa —título, datos, desglose
 * por talla con su total e historial— porque es lo que se manda por correo a
 * quien pregunta por su trabajo, y antes había que imprimir y escanear.
 *
 * Se escribe como documento y no como tabla: una hoja con bloques aplanada a
 * rejilla obliga a inventar una columna "Sección" que en el papel no existe, y
 * quien la abre ya no reconoce el vale que tiene en la mano.
 *
 * Las dos tablas comparten la rejilla porque en una hoja las columnas son las
 * mismas para todo. El ancho se elige para que sirva a las dos:
 *
 *   A            B         C        D         E       F
 *   Talla        Foleo     Pedidas  Cortadas  Faltan  Sobran
 *   Fecha        Talla     Piezas   Quién     Notas
 */
const WIDTHS = [24, 22, 12, 16, 18, 12];

/** Columnas, por nombre, para no contar posiciones al leer el armado. */
const A = 1;
const B = 2;
const C = 3;
const D = 4;
const E = 5;
const F = 6;

interface OrderSheet {
  code: string;
  status: CuttingOrderStatus;
  orderedAt: Date;
  dueDate: Date | null;
  description: string | null;
  reference: string | null;
  notes: string | null;
  cutFabricText: string | null;
  cutPattern: string | null;
  cutVersion: CutVersion | null;
  cutVersionNotes: string | null;
  cutNotes: string[];
  client: { name: string } | null;
  material: { code: string; name: string } | null;
  productionRun: { code: string; name: string | null } | null;
  createdBy: { name: string } | null;
}

interface Line {
  orderedQuantity: number;
  cutQuantity: number;
  notes: string | null;
  size: { code: string };
  cutTag: { name: string } | null;
  progress: {
    quantity: number;
    notes: string | null;
    createdAt: Date;
    user: { name: string } | null;
  }[];
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  // Recorre la orden entera: sin límite es un vector de denegación.
  await enforceRateLimit("export:order", EXPORT_LIMIT);
  await requirePermission("inventory:browse");

  const { id } = await params;

  const order = await prisma.cuttingOrder.findUnique({
    where: { id },
    include: {
      client: { select: { name: true } },
      material: { select: { code: true, name: true } },
      productionRun: { select: { code: true, name: true } },
      createdBy: { select: { name: true } },
      lines: {
        orderBy: { position: "asc" },
        include: {
          size: { select: { code: true } },
          cutTag: { select: { name: true } },
          progress: {
            orderBy: { createdAt: "asc" },
            include: { user: { select: { name: true } } },
          },
        },
      },
    },
  });

  if (!order) return new Response("Orden no encontrada", { status: 404 });

  const rows: SheetRow[] = [
    ...headerRows(order),
    ...cutNoteRows(order.cutNotes),
    ...sizeRows(order.lines),
    ...historyRows(order.lines),
    ...notesRows(order.notes),
  ];

  return xlsxResponse(
    toXlsxDocument(rows, WIDTHS, "Orden"),
    `orden-${order.code}`,
  );
}

/**
 * El membrete y los datos apareados, como en la hoja.
 *
 * Los campos van en dos columnas de "etiqueta: valor" igual que impresos, y a
 * diferencia del papel —que esconde los vacíos— aquí salen todos con un guion:
 * en una hoja de cálculo la forma estable vale más que la corta, porque quien
 * la recibe compara dos órdenes poniéndolas una junto a otra y los renglones
 * tienen que caer a la misma altura.
 */
function headerRows(order: OrderSheet): SheetRow[] {
  const pairs: [string, string][] = [
    ["Cliente", order.client?.name ?? "Fábrica"],
    ["Descripción", order.description ?? "—"],
    ["Orden del cliente", order.reference ?? "—"],
    ["Entrega", order.dueDate ? formatDate(order.dueDate) : "—"],
    [
      "Material",
      order.material ? `${order.material.code} · ${order.material.name}` : "—",
    ],
    ["Capturó", order.createdBy?.name ?? "—"],
    [
      "Producción",
      order.productionRun
        ? `${order.productionRun.code} · ${order.productionRun.name ?? ""}`
        : "—",
    ],
    ["Tela (a mano)", order.cutFabricText ?? "—"],
    ["Molde", order.cutPattern ?? "—"],
    ["Versión", order.cutVersion ? CUT_VERSION_LABELS[order.cutVersion] : "—"],
    ["Cambios de la versión", order.cutVersionNotes ?? "—"],
  ];

  /* De dos en dos, para que se lean en dos columnas como en el papel. El
     último par puede venir sin pareja y esa mitad se queda vacía. */
  const grid: SheetRow[] = [];

  for (let index = 0; index < pairs.length; index += 2) {
    const left = pairs[index];
    const right = pairs[index + 1];
    if (!left) continue;

    const row: SheetRow = [
      { at: A, value: `${left[0]}:`, style: "label" },
      { at: B, value: left[1] },
    ];

    if (right) {
      row.push(
        { at: D, value: `${right[0]}:`, style: "label" },
        { at: E, value: right[1] },
      );
    }

    grid.push(row);
  }

  return [
    [
      { at: A, value: "UNISOUTH", style: "title" },
      { at: F, value: order.code, style: "titleRight" },
    ],
    [
      { at: A, value: "Orden de corte" },
      { at: F, value: formatDate(order.orderedAt), style: "right" },
    ],
    [{ at: F, value: CUTTING_ORDER_STATUS_LABELS[order.status], style: "right" }],
    [],
    ...grid,
  ];
}

/** Numeradas igual que en el papel, para irlas palomeando en el taller. */
function cutNoteRows(notes: string[]): SheetRow[] {
  if (notes.length === 0) return [];

  return [
    [],
    [{ at: A, value: "Notas del corte", style: "section" }],
    ...notes.map(
      (note, index): SheetRow => [
        { at: A, value: `${index + 1}.` },
        { at: B, value: note },
      ],
    ),
  ];
}

/** El desglose por talla: la tabla principal, con su total abajo. */
function sizeRows(lines: Line[]): SheetRow[] {
  const body = lines.map((line): SheetRow => {
    const { pending, surplus } = cutProgress(
      line.orderedQuantity,
      line.cutQuantity,
    );

    return [
      { at: A, value: line.size.code },
      { at: B, value: line.cutTag?.name ?? "" },
      { at: C, value: line.orderedQuantity, kind: "number" },
      { at: D, value: line.cutQuantity, kind: "number" },
      // Cero se deja vacío como en el papel: una columna de ceros esconde los
      // dos renglones que de verdad deben algo.
      { at: E, value: pending > 0 ? pending : "", kind: "number" },
      { at: F, value: surplus > 0 ? surplus : "", kind: "number" },
    ];
  });

  const ordered = lines.reduce((sum, line) => sum + line.orderedQuantity, 0);
  const cut = lines.reduce((sum, line) => sum + line.cutQuantity, 0);
  const total = cutProgress(ordered, cut);

  return [
    [],
    [
      { at: A, value: "Talla", style: "tableHeader" },
      { at: B, value: "Foleo", style: "tableHeader" },
      { at: C, value: "Pedidas", style: "tableHeaderRight" },
      { at: D, value: "Cortadas", style: "tableHeaderRight" },
      { at: E, value: "Faltan", style: "tableHeaderRight" },
      { at: F, value: "Sobran", style: "tableHeaderRight" },
    ],
    ...body,
    [
      { at: A, value: "Total", style: "total" },
      { at: B, value: "", style: "total" },
      { at: C, value: ordered, kind: "number", style: "totalNumber" },
      { at: D, value: cut, kind: "number", style: "totalNumber" },
      {
        at: E,
        value: total.pending > 0 ? total.pending : "",
        kind: "number",
        style: "totalNumber",
      },
      {
        at: F,
        value: total.surplus > 0 ? total.surplus : "",
        kind: "number",
        style: "totalNumber",
      },
    ],
  ];
}

/**
 * El historial completo, del avance más viejo al más nuevo.
 *
 * Va entero y no sólo el acumulado por la misma razón que en la hoja que se
 * archiva: meses después la pregunta no es "cuántas se cortaron" sino "quién
 * cortó estas y cuándo", y un total no puede responderla.
 */
function historyRows(lines: Line[]): SheetRow[] {
  const entries = lines
    .flatMap((line) =>
      line.progress.map((entry) => ({ entry, sizeCode: line.size.code })),
    )
    .sort((a, b) => a.entry.createdAt.getTime() - b.entry.createdAt.getTime());

  if (entries.length === 0) return [];

  return [
    [],
    [{ at: A, value: "Historial de cortes", style: "section" }],
    [
      { at: A, value: "Fecha", style: "tableHeader" },
      { at: B, value: "Talla", style: "tableHeader" },
      { at: C, value: "Piezas", style: "tableHeaderRight" },
      { at: D, value: "Quién", style: "tableHeader" },
      { at: E, value: "Notas", style: "tableHeader" },
    ],
    ...entries.map(
      ({ entry, sizeCode }): SheetRow => [
        { at: A, value: entry.createdAt, kind: "datetime" },
        { at: B, value: sizeCode },
        { at: C, value: entry.quantity, kind: "number" },
        { at: D, value: entry.user?.name ?? "" },
        { at: E, value: entry.notes ?? "" },
      ],
    ),
  ];
}

/** Las notas de la orden, que en el papel van al pie. */
function notesRows(notes: string | null): SheetRow[] {
  if (!notes) return [];

  return [
    [],
    [{ at: A, value: "Notas", style: "section" }],
    [{ at: A, value: notes }],
  ];
}
