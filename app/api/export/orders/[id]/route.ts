import type { CutVersion, CuttingOrderStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/core/session";
import { enforceRateLimit, EXPORT_LIMIT } from "@/lib/core/rate-limit";
import {
  toXlsxWithNotice,
  xlsxResponse,
  type XlsxColumn,
} from "@/lib/export/xlsx";
import {
  CUT_VERSION_LABELS,
  CUTTING_ORDER_STATUS_LABELS,
} from "@/lib/constants/labels";
import { cutProgress, formatDate } from "@/lib/utils";

/**
 * Una orden en Excel, con la MISMA estructura de la hoja impresa.
 *
 * No es el reporte de órdenes: aquél lleva una fila por talla de muchas
 * órdenes para pivotear. Éste es UNA orden completa —encabezado, notas del
 * corte, desglose por talla e historial—, que es lo que se manda por correo a
 * quien pregunta por su trabajo. Hasta ahora la única forma de darlo era
 * imprimir la hoja y escanearla.
 *
 * Las secciones caben en una sola tabla porque Excel abre UN archivo. La
 * columna "Sección" las separa: se filtra por ella para quedarse con el
 * desglose, o se deja completa para leerla como la hoja de papel.
 */
interface Row {
  section: string;
  concept: string;
  detail: string;
  /* Sólo la usa el historial. Va como fecha de verdad y no como texto para
     poder ordenar por ella, que es para lo que se abre el historial. */
  date: Date | null;
  ordered: number | "";
  cut: number | "";
  pending: number | "";
  surplus: number | "";
  /* El avance de UN registro, con signo. Va aparte de "Cortadas" a propósito:
     el historial de una talla suma exactamente su acumulado, así que en la
     misma columna el total de la hoja saldría al doble. */
  delta: number | "";
  who: string;
  notes: string;
}

const COLUMNS: XlsxColumn<Row>[] = [
  { header: "Sección", value: (r) => r.section, width: 22 },
  { header: "Concepto", value: (r) => r.concept, width: 26 },
  { header: "Detalle", value: (r) => r.detail, width: 32 },
  { header: "Fecha", value: (r) => r.date, kind: "datetime", width: 18 },
  { header: "Pedidas", value: (r) => r.ordered, kind: "number" },
  { header: "Cortadas", value: (r) => r.cut, kind: "number" },
  { header: "Faltan", value: (r) => r.pending, kind: "number" },
  { header: "Sobran", value: (r) => r.surplus, kind: "number" },
  { header: "Avance", value: (r) => r.delta, kind: "number" },
  { header: "Quién", value: (r) => r.who, width: 20 },
  { header: "Notas", value: (r) => r.notes, width: 34 },
];

/** Lo que la hoja necesita de la orden. Prisma devuelve más; sobra y no estorba. */
interface OrderSheet {
  code: string;
  status: CuttingOrderStatus;
  orderedAt: Date;
  dueDate: Date | null;
  description: string | null;
  reference: string | null;
  cutFabricText: string | null;
  cutPattern: string | null;
  cutVersion: CutVersion | null;
  cutVersionNotes: string | null;
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

/** Fila vacía salvo lo que se le pase. Evita repetir once campos por renglón. */
function row(partial: Partial<Row> & { section: string }): Row {
  return {
    concept: "",
    detail: "",
    date: null,
    ordered: "",
    cut: "",
    pending: "",
    surplus: "",
    delta: "",
    who: "",
    notes: "",
    ...partial,
  };
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

  const rows: Row[] = [
    ...headerRows(order),
    ...cutNoteRows(order.cutNotes),
    ...sizeRows(order.lines),
    ...historyRows(order.lines),
    ...orderNoteRows(order.notes),
  ];

  return xlsxResponse(
    toXlsxWithNotice(rows, COLUMNS, "Orden"),
    `orden-${order.code}`,
  );
}

/**
 * El encabezado, en el mismo orden en que se lee impreso.
 *
 * A diferencia del papel —que esconde los campos vacíos— aquí salen todos con
 * un guion: en una hoja de cálculo la forma estable vale más que la corta,
 * porque quien la recibe compara dos órdenes poniéndolas una junto a otra y
 * los renglones tienen que caer a la misma altura.
 */
function headerRows(order: OrderSheet): Row[] {
  const meta: [string, string][] = [
    ["Folio", order.code],
    ["Fecha", formatDate(order.orderedAt)],
    ["Estado", CUTTING_ORDER_STATUS_LABELS[order.status]],
    ["Cliente", order.client?.name ?? "Fábrica"],
    ["Descripción", order.description ?? "—"],
    ["Orden del cliente", order.reference ?? "—"],
    ["Entrega", order.dueDate ? formatDate(order.dueDate) : "—"],
    [
      "Material",
      order.material ? `${order.material.code} · ${order.material.name}` : "—",
    ],
    [
      "Producción",
      order.productionRun
        ? `${order.productionRun.code} · ${order.productionRun.name ?? ""}`
        : "—",
    ],
    ["Capturó", order.createdBy?.name ?? "—"],
    ["Tela (a mano)", order.cutFabricText ?? "—"],
    ["Molde", order.cutPattern ?? "—"],
    ["Versión", order.cutVersion ? CUT_VERSION_LABELS[order.cutVersion] : "—"],
    ["Cambios de la versión", order.cutVersionNotes ?? "—"],
  ];

  return meta.map(([concept, detail]) =>
    row({ section: "Orden", concept, detail }),
  );
}

/** Numeradas igual que en el papel, para irlas palomeando en el taller. */
function cutNoteRows(notes: string[]): Row[] {
  return notes.map((note, index) =>
    row({ section: "Notas del corte", concept: `${index + 1}.`, detail: note }),
  );
}

/** El desglose por talla: la tabla principal de la hoja. */
function sizeRows(lines: Line[]): Row[] {
  const rows = lines.map((line) => {
    const { pending, surplus } = cutProgress(
      line.orderedQuantity,
      line.cutQuantity,
    );

    return row({
      section: "Tallas",
      concept: line.size.code,
      detail: line.cutTag?.name ?? "",
      ordered: line.orderedQuantity,
      cut: line.cutQuantity,
      // El cero se deja vacío como en el papel: una columna de ceros esconde
      // los dos renglones que de verdad deben algo.
      pending: pending > 0 ? pending : "",
      surplus: surplus > 0 ? surplus : "",
      notes: line.notes ?? "",
    });
  });

  const ordered = lines.reduce((sum, line) => sum + line.orderedQuantity, 0);
  const cut = lines.reduce((sum, line) => sum + line.cutQuantity, 0);
  const total = cutProgress(ordered, cut);

  /* El total va en su PROPIA sección y no dentro de "Tallas": en el papel es
     el renglón de abajo, pero en Excel una fila de totales mezclada con los
     datos se vuelve a sumar sin que nadie lo note. */
  return [
    ...rows,
    row({
      section: "Total",
      concept: "Total",
      ordered,
      cut,
      pending: total.pending > 0 ? total.pending : "",
      surplus: total.surplus > 0 ? total.surplus : "",
    }),
  ];
}

/**
 * El historial completo, del avance más viejo al más nuevo.
 *
 * Va entero y no sólo el acumulado por la misma razón que en la hoja que se
 * archiva: meses después la pregunta no es "cuántas se cortaron" sino "quién
 * cortó estas y cuándo", y un total no puede responderla.
 */
function historyRows(lines: Line[]): Row[] {
  return lines
    .flatMap((line) =>
      line.progress.map((entry) => ({ entry, sizeCode: line.size.code })),
    )
    .sort((a, b) => a.entry.createdAt.getTime() - b.entry.createdAt.getTime())
    .map(({ entry, sizeCode }) =>
      row({
        section: "Historial de cortes",
        concept: sizeCode,
        date: entry.createdAt,
        delta: entry.quantity,
        who: entry.user?.name ?? "",
        notes: entry.notes ?? "",
      }),
    );
}

/** Las notas de la orden, que en el papel van al pie. */
function orderNoteRows(notes: string | null): Row[] {
  if (!notes) return [];

  return [row({ section: "Notas", detail: notes })];
}
