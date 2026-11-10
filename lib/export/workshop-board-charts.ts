import {
  DELIVERY_AGE_LABELS,
  DELIVERY_PROGRESS_LABELS,
} from "@/lib/constants/labels";
import type { DeliveryProgress } from "@/lib/constants/workshop-access";
import type {
  NamedTotal,
  WorkshopBoardReport,
} from "@/lib/reports/workshop-board-report";
import type { ChartSpec } from "./xlsx-chart";
import { documentSheetXml, type SheetRow } from "./xlsx";
import type { WorkbookSheet } from "./xlsx-workbook";

export const CHARTS_SHEET = "Gráficas";

/* Los mismos colores que los estados de la app: verde recibido, ámbar lo
   que falta, gris lo que ni ha salido, rojo lo cancelado. Así quien conoce
   la pantalla lee la gráfica sin buscar la leyenda. */
const GREEN = "16A34A";
const AMBER = "D97706";
const SLATE = "64748B";
const RED = "DC2626";
const DARK = "475569";

const PROGRESS_COLORS: Record<DeliveryProgress, string> = {
  RECEIVED: GREEN,
  IN_TRANSIT: AMBER,
  IN_PLANT: SLATE,
  CANCELLED: RED,
};

/** Alto mínimo de cada bloque, en filas: lo que mide la gráfica. */
const CHART_ROWS = 18;
const CHART_FROM_COL = 4;
const CHART_TO_COL = 13;

interface Block {
  title: string;
  headers: string[];
  rows: (string | number)[][];
  chart: Omit<
    ChartSpec,
    "sheet" | "categoryColumn" | "firstRow" | "categories" | "from" | "to"
  >;
}

function namedBlock(title: string, groups: NamedTotal[], label: string): Block {
  return {
    title,
    headers: [label, "Enviadas", "Recibidas"],
    rows: groups.map((group) => [group.name, group.pieces, group.receivedPieces]),
    chart: {
      type: "bar",
      title,
      series: [
        {
          name: "Enviadas",
          column: 2,
          values: groups.map((group) => group.pieces),
          color: DARK,
        },
        {
          name: "Recibidas",
          column: 3,
          values: groups.map((group) => group.receivedPieces),
          color: GREEN,
        },
      ],
    },
  };
}

function timelineBlock(report: WorkshopBoardReport): Block {
  const unit = report.timelineUnit === "day" ? "día" : "semana";
  const title = `Piezas enviadas por ${unit}`;

  return {
    title,
    headers: [unit === "día" ? "Día" : "Semana", "Recibidas", "Por recibir"],
    rows: report.timeline.map((point) => [point.label, point.received, point.pending]),
    chart: {
      type: "column",
      title,
      stacked: true,
      series: [
        {
          name: "Recibidas",
          column: 2,
          values: report.timeline.map((point) => point.received),
          color: GREEN,
        },
        {
          name: "Por recibir",
          column: 3,
          values: report.timeline.map((point) => point.pending),
          color: AMBER,
        },
      ],
    },
  };
}

/** Sin rebanadas en cero: una etiqueta "0" encimada no dice nada. */
function progressBlock(report: WorkshopBoardReport): Block {
  const present = report.byProgress.filter((item) => item.deliveries > 0);
  const title = "Entregas por estado";

  return {
    title,
    headers: ["Estado", "Entregas"],
    rows: present.map((item) => [DELIVERY_PROGRESS_LABELS[item.progress], item.deliveries]),
    chart: {
      type: "doughnut",
      title,
      sliceColors: present.map((item) => PROGRESS_COLORS[item.progress]),
      series: [
        {
          name: "Entregas",
          column: 2,
          values: present.map((item) => item.deliveries),
          color: DARK,
        },
      ],
    },
  };
}

function ageingBlock(report: WorkshopBoardReport): Block {
  const title = "Días para confirmar lo que llega";

  return {
    title,
    headers: ["Tramo", "Recibidas", "Por recibir"],
    rows: report.ageing.map((item) => [
      DELIVERY_AGE_LABELS[item.age],
      item.received,
      item.pending,
    ]),
    chart: {
      type: "column",
      title,
      series: [
        {
          name: "Recibidas (tardó)",
          column: 2,
          values: report.ageing.map((item) => item.received),
          color: GREEN,
        },
        {
          name: "Por recibir (lleva)",
          column: 3,
          values: report.ageing.map((item) => item.pending),
          color: AMBER,
        },
      ],
    },
  };
}

function headerRow(headers: string[]): SheetRow {
  return headers.map((value, index) => ({
    value,
    style: index === 0 ? "tableHeader" : "tableHeaderRight",
  }));
}

/**
 * Cada bloque: su tablita a la izquierda y su gráfica a la derecha, a la
 * altura de la tabla. La tabla se queda a la vista a propósito: es lo que
 * alimenta la gráfica, y corregir ahí un número mueve la barra.
 */
export function buildChartsSheet(report: WorkshopBoardReport): WorkbookSheet {
  /* Sin entregas no se dibujan barras en cero: una gráfica vacía hace creer
     que el archivo salió mal, cuando lo que pasa es que no se mandó nada. */
  if (report.totals.deliveries + report.totals.cancelled === 0) {
    return {
      name: CHARTS_SHEET,
      xml: documentSheetXml(
        [[{ value: "No hubo entregas en este periodo: no hay nada que graficar." }]],
        [60],
      ),
    };
  }

  const blocks = [
    timelineBlock(report),
    progressBlock(report),
    namedBlock("Piezas por cliente", report.byClient, "Cliente"),
    namedBlock("Piezas por prenda", report.byGarment, "Prenda"),
    ageingBlock(report),
  ].filter((block) => block.rows.length > 0);

  const rows: SheetRow[] = [];
  const charts: ChartSpec[] = [];

  for (const block of blocks) {
    const top = rows.length;
    rows.push([{ value: block.title, style: "section", mergeTo: 3 }]);
    rows.push(headerRow(block.headers));
    const firstRow = rows.length + 1;
    for (const values of block.rows) {
      rows.push(values.map((value) => ({ value, kind: typeof value === "number" ? "number" : "text" })));
    }

    const height = Math.max(block.rows.length + 2, CHART_ROWS);
    charts.push({
      ...block.chart,
      sheet: CHARTS_SHEET,
      categoryColumn: 1,
      firstRow,
      categories: block.rows.map((values) => String(values[0])),
      from: [CHART_FROM_COL, top],
      to: [CHART_TO_COL, top + height],
    });

    // Relleno hasta el final de la gráfica más una fila de aire.
    while (rows.length < top + height + 2) rows.push([]);
  }

  return {
    name: CHARTS_SHEET,
    xml: documentSheetXml(rows, [28, 14, 14]),
    charts,
  };
}
