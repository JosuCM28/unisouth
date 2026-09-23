import type { CutTag, DocumentType, Prisma } from "@prisma/client";
import {
  CUT_TAG_COLORS,
  CUT_TAG_LABELS,
  CUT_VERSION_LABELS,
  DOCUMENT_STATUS_LABELS,
  DOCUMENT_TYPE_LABELS,
  UNIT_SHORT_LABELS,
} from "@/lib/constants/labels";
import { contrastText, formatQuantity } from "@/lib/utils";

/**
 * LA HOJA DEL VALE, ya resuelta: lo que dice el papel, sin saber cómo se pinta.
 *
 * Existe porque el vale se dibuja en dos lados —la página de impresión y el
 * PDF que se manda por WhatsApp— y cada uno con su propia tecnología (HTML y
 * react-pdf). Si cada uno decidiera por su cuenta de dónde sale la empresa,
 * qué foleo gana o cómo se suma el total, el día que se corrija una regla en
 * un lado el taller recibiría por WhatsApp un papel distinto del que firmó.
 * Aquí se decide todo UNA vez; los dos dibujantes sólo copian.
 */

/** Lo que hay que leer de la base para armar la hoja. */
export const VOUCHER_SHEET_INCLUDE = {
  createdBy: { select: { name: true } },
  productionRun: { select: { code: true, name: true } },
  // La empresa dueña se lee del vale, no de los rollos: una salida de puros
  // cortes no lleva rollos de los que deducirla.
  client: { select: { name: true } },
  cutFabric: { select: { name: true } },
  cutLines: {
    orderBy: { order: "asc" },
    include: {
      size: { select: { code: true } },
      cutTag: { select: { name: true, color: true } },
    },
  },
  lines: {
    orderBy: { order: "asc" },
    include: {
      lot: {
        include: {
          material: { select: { name: true } },
          client: { select: { name: true } },
        },
      },
    },
  },
} satisfies Prisma.InventoryDocumentInclude;

export type VoucherDocument = Prisma.InventoryDocumentGetPayload<{
  include: typeof VOUCHER_SHEET_INCLUDE;
}>;

/** El papelito de color, con el color de letra que se lee encima. */
export interface VoucherTag {
  name: string;
  background: string;
  text: string;
}

/** Un renglón de la tabla de tallas. */
export interface VoucherCutRow {
  id: string;
  sizeCode: string;
  /** Piezas POR BULTO. */
  quantity: number;
  bundles: number;
  /** `quantity × bundles`: lo que de verdad sale por la puerta. */
  total: number;
  tag: VoucherTag | null;
  notes: string | null;
}

/** Un rollo entregado. */
export interface VoucherRollRow {
  id: string;
  code: string;
  material: string;
  shade: string | null;
  quantity: string;
}

/** Un dato del encabezado: "Empresa: Tamsa". */
export interface VoucherField {
  label: string;
  value: string;
}

export interface VoucherSheet {
  code: string;
  status: string;
  title: string;
  /** Empresa, orden, descripción, tela… sólo los que traen dato. */
  header: VoucherField[];
  cutRows: VoucherCutRow[];
  cutTotals: { perBundle: number; bundles: number; pieces: number };
  /** Numeradas en el papel: el taller las palomea una por una. */
  cutNotes: string[];
  rollRows: VoucherRollRow[];
  /** "3 rollos · 245.5 en total". Null si no salió tela. */
  rollSummary: string | null;
  /** Concepto, producción, quién elaboró: el contexto del pie. */
  footer: VoucherField[];
  notes: string | null;
  handedOverBy: string | null;
  receivedBy: string | null;
}

/** Del documento leído a la hoja que se dibuja. Función pura. */
export function toVoucherSheet(document: VoucherDocument): VoucherSheet {
  const cutRows = document.cutLines.map(toCutRow);

  return {
    code: document.code,
    status: DOCUMENT_STATUS_LABELS[document.status],
    title: sheetTitleFor(document.type, cutRows.length > 0),
    header: headerOf(document, cutRows.length > 0),
    cutRows,
    cutTotals: totalsOf(cutRows),
    cutNotes: document.cutNotes,
    rollRows: document.lines.map((line) => ({
      id: line.id,
      code: line.lot.code,
      material: line.lot.material.name,
      shade: line.lot.shade,
      quantity: formatQuantity(line.quantity, {
        unit: UNIT_SHORT_LABELS[line.unit],
      }),
    })),
    rollSummary: rollSummaryOf(document),
    footer: footerOf(document),
    notes: document.notes,
    handedOverBy: document.handedOverBy,
    receivedBy: document.receivedBy,
  };
}

/** Nombre del archivo del vale: el folio, que es como se busca en el chat. */
export function voucherFileName(sheet: Pick<VoucherSheet, "code">): string {
  return `${sheet.code}.pdf`;
}

// ═══════════════════════════════════════════════════════════════════════════
//  Piezas de la hoja
// ═══════════════════════════════════════════════════════════════════════════

/**
 * El título de la hoja.
 *
 * Sólo la salida CON desglose de tallas cambia de nombre: una salida de
 * rollos de tela sigue siendo una salida, y titularla "de corte" mentiría
 * sobre lo que va dentro del bulto.
 */
function sheetTitleFor(type: DocumentType, hasCuts: boolean): string {
  if (type === "ISSUE" && hasCuts) return "Salida de Corte";
  return DOCUMENT_TYPE_LABELS[type];
}

/**
 * El encabezado del desglose de corte, en el orden en que se lee.
 *
 * Empresa y tela salen de los campos PROPIOS del vale; los rollos son el
 * respaldo para los vales viejos, capturados antes de que el encabezado
 * existiera. Si se dedujeran sólo de los rollos, una salida sin rollos
 * —prendas ya cortadas— imprimiría esos renglones en blanco justo en la hoja
 * que firma el taller.
 *
 * Un vale de puros rollos sin datos de corte no lleva encabezado: la caja
 * vacía sólo gastaría el espacio que le hace falta a la tabla.
 */
function headerOf(document: VoucherDocument, hasCuts: boolean): VoucherField[] {
  const company =
    document.client?.name ??
    joined(document.lines.map((line) => line.lot.client?.name));

  const fabric =
    document.cutFabric?.name ??
    document.cutFabricText ??
    joined(document.lines.map((line) => line.lot.material.name));

  const hasCutData = Boolean(
    document.cutDescription ||
      document.cutPattern ||
      document.cutVersion ||
      fabric,
  );
  if (!hasCuts && !hasCutData) return [];

  return fields([
    ["Empresa", company],
    ["Descripción", document.cutDescription],
    ["Orden", document.reference],
    ["Tela", fabric],
    ["Molde", document.cutPattern],
    [
      "Versión",
      document.cutVersion ? CUT_VERSION_LABELS[document.cutVersion] : null,
    ],
    ["De la versión", document.cutVersionNotes],
  ]);
}

/** El pie: contexto administrativo, no lo que se coteja con el bulto. */
function footerOf(document: VoucherDocument): VoucherField[] {
  const run = document.productionRun;

  return fields([
    ["Concepto", document.concept],
    ["Producción", run ? `${run.code} · ${run.name}` : null],
    ["Elaboró", document.createdBy?.name],
  ]);
}

function toCutRow(line: VoucherDocument["cutLines"][number]): VoucherCutRow {
  return {
    id: line.id,
    sizeCode: line.size.code,
    quantity: line.quantity,
    bundles: line.bundles,
    total: line.quantity * line.bundles,
    tag: resolveTag(line.cutTag, line.tag),
    notes: line.notes,
  };
}

/**
 * La suma de la tabla.
 *
 * El total de un renglón es cantidad POR bultos: si de la talla 38 van 64 en
 * cada uno de 2 bultos, salen 128 prendas. Sumar la cantidad sin multiplicar
 * entregaba la mitad de lo que de verdad sale por la puerta.
 */
function totalsOf(rows: VoucherCutRow[]): VoucherSheet["cutTotals"] {
  return rows.reduce(
    (acc, row) => ({
      perBundle: acc.perBundle + row.quantity,
      bundles: acc.bundles + row.bundles,
      pieces: acc.pieces + row.total,
    }),
    { perBundle: 0, bundles: 0, pieces: 0 },
  );
}

/**
 * Cuántos rollos y cuántos metros: en el andén se cuentan los bultos físicos,
 * y el metraje es lo que se factura.
 */
function rollSummaryOf(document: VoucherDocument): string | null {
  const count = document.lines.length;
  if (count === 0) return null;

  const quantity = document.lines.reduce(
    (sum, line) => sum + Number(line.quantity),
    0,
  );

  return `${count} ${count === 1 ? "rollo" : "rollos"} · ${formatQuantity(quantity)} en total`;
}

/**
 * El foleo de un renglón: primero el catálogo, luego el enum viejo.
 *
 * Los vales capturados antes de que los foleos fueran administrables sólo
 * tienen el enum. Se traducen aquí para que una hoja reimpresa años después
 * siga saliendo del color correcto.
 */
function resolveTag(
  option: { name: string; color: string } | null,
  legacy: CutTag | null,
): VoucherTag | null {
  if (option) {
    return {
      name: option.name,
      background: option.color,
      text: contrastText(option.color),
    };
  }

  if (!legacy) return null;

  return {
    name: CUT_TAG_LABELS[legacy],
    background: CUT_TAG_COLORS[legacy].background,
    text: CUT_TAG_COLORS[legacy].text,
  };
}

/** Los pares con dato, ya como campos. Un renglón sin valor no se imprime. */
function fields(
  pairs: [label: string, value: string | null | undefined][],
): VoucherField[] {
  return pairs.flatMap(([label, value]) => (value ? [{ label, value }] : []));
}

/**
 * Valores distintos unidos por coma, o null si no hay ninguno.
 *
 * El null importa: `[].join(", ")` da `""`, que el `??` no salta, y el
 * renglón se imprimía con los dos puntos y nada después.
 */
function joined(values: (string | null | undefined)[]): string | null {
  const distinct = [
    ...new Set(values.filter((value): value is string => Boolean(value))),
  ];
  return distinct.length > 0 ? distinct.join(", ") : null;
}
