import { columnName, escapeXml } from "./xlsx";

/**
 * Una gráfica NATIVA de Excel, escrita a mano en DrawingML.
 *
 * Nativa y no una imagen: quien recibe el reporte la mueve, le cambia el tipo
 * o corrige un número de la tablita de abajo y la barra se mueve sola. Una
 * imagen sería una foto del día en que se bajó.
 *
 * Cada serie apunta a un rango de la hoja Y trae sus valores copiados en el
 * caché. Con sólo el rango, todo lo que no recalcula al abrir —la vista previa
 * de Drive, el visor del celular— pinta una gráfica vacía.
 */

export type ChartType = "column" | "bar" | "doughnut";

export interface ChartSeries {
  name: string;
  /** Columna 1-based de los valores, en la misma hoja que las categorías. */
  column: number;
  values: number[];
  /** RGB sin `#`: "16A34A". */
  color: string;
}

export interface ChartSpec {
  type: ChartType;
  title: string;
  /** Pestaña donde vive la tablita que alimenta la gráfica. */
  sheet: string;
  /** Columna 1-based de las categorías. */
  categoryColumn: number;
  /** Primera fila 1-based de datos (sin el encabezado). */
  firstRow: number;
  categories: string[];
  series: ChartSeries[];
  /** Apila las series en una sola barra: enviado = recibido + por recibir. */
  stacked?: boolean;
  /** Sólo dona: un color por rebanada, en el orden de las categorías. */
  sliceColors?: string[];
  /** Dónde se dibuja, en celdas 0-based: [col, fila] de esquina a esquina. */
  from: [number, number];
  to: [number, number];
}

const NS =
  'xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" ' +
  'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" ' +
  'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"';

/** Rango absoluto con la pestaña entre comillas: aguanta acentos y espacios. */
function range(sheet: string, column: number, first: number, count: number) {
  const letter = columnName(column);
  const last = first + Math.max(count, 1) - 1;
  const quoted = sheet.replace(/'/g, "''");
  return escapeXml(`'${quoted}'!$${letter}$${first}:$${letter}$${last}`);
}

function solidFill(color: string): string {
  return `<a:solidFill><a:srgbClr val="${color}"/></a:solidFill>`;
}

function textProps(size: number, bold = false, color = "334155"): string {
  return (
    `<c:txPr><a:bodyPr/><a:lstStyle/><a:p><a:pPr>` +
    `<a:defRPr sz="${size}" b="${bold ? 1 : 0}"><a:solidFill><a:srgbClr val="${color}"/></a:solidFill></a:defRPr>` +
    `</a:pPr><a:endParaRPr lang="es-MX"/></a:p></c:txPr>`
  );
}

function titleXml(title: string): string {
  return (
    `<c:title><c:tx><c:rich><a:bodyPr/><a:lstStyle/><a:p>` +
    `<a:pPr><a:defRPr sz="1200" b="1"/></a:pPr>` +
    `<a:r><a:rPr lang="es-MX" sz="1200" b="1"/><a:t>${escapeXml(title)}</a:t></a:r>` +
    `</a:p></c:rich></c:tx><c:overlay val="0"/></c:title>`
  );
}

function categoriesXml(spec: ChartSpec): string {
  const points = spec.categories
    .map((label, index) => `<c:pt idx="${index}"><c:v>${escapeXml(label)}</c:v></c:pt>`)
    .join("");

  return (
    `<c:cat><c:strRef><c:f>${range(spec.sheet, spec.categoryColumn, spec.firstRow, spec.categories.length)}</c:f>` +
    `<c:strCache><c:ptCount val="${spec.categories.length}"/>${points}</c:strCache></c:strRef></c:cat>`
  );
}

function valuesXml(spec: ChartSpec, series: ChartSeries): string {
  const points = series.values
    .map((value, index) => `<c:pt idx="${index}"><c:v>${value}</c:v></c:pt>`)
    .join("");

  return (
    `<c:val><c:numRef><c:f>${range(spec.sheet, series.column, spec.firstRow, series.values.length)}</c:f>` +
    `<c:numCache><c:formatCode>General</c:formatCode><c:ptCount val="${series.values.length}"/>${points}</c:numCache>` +
    `</c:numRef></c:val>`
  );
}

/**
 * Etiquetas con el número encima de cada barra. En un reporte que se imprime
 * nadie va a medir la barra contra el eje para saber si fueron 480 o 520.
 *
 * El formato deja el CERO sin texto (tercera sección vacía): un mes con
 * veinte días sin envíos llenaba el pie de la gráfica de ceros encimados.
 *
 * Dentro de la barra o de la dona el número va en blanco y negritas; afuera,
 * en el gris del texto.
 */
function labelsXml(position: string | null, inside: boolean): string {
  const pos = position ? `<c:dLblPos val="${position}"/>` : "";
  const text = inside ? textProps(900, true, "FFFFFF") : textProps(900);
  return (
    `<c:dLbls><c:numFmt formatCode="#,##0;-#,##0;" sourceLinked="0"/><c:spPr><a:noFill/><a:ln><a:noFill/></a:ln></c:spPr>` +
    `${text}${pos}<c:showLegendKey val="0"/><c:showVal val="1"/><c:showCatName val="0"/>` +
    `<c:showSerName val="0"/><c:showPercent val="0"/><c:showBubbleSize val="0"/></c:dLbls>`
  );
}

function seriesName(name: string): string {
  return `<c:tx><c:v>${escapeXml(name)}</c:v></c:tx>`;
}

function barSeriesXml(spec: ChartSpec): string {
  // Apiladas, la etiqueta va DENTRO de su tramo; sueltas, por fuera.
  const position = spec.stacked ? "ctr" : "outEnd";

  return spec.series
    .map(
      (series, index) =>
        `<c:ser><c:idx val="${index}"/><c:order val="${index}"/>${seriesName(series.name)}` +
        `<c:spPr>${solidFill(series.color)}</c:spPr><c:invertIfNegative val="0"/>` +
        `${labelsXml(position, Boolean(spec.stacked))}${categoriesXml(spec)}${valuesXml(spec, series)}</c:ser>`,
    )
    .join("");
}

function axesXml(horizontal: boolean): string {
  /* En barras horizontales el primer renglón quedaría ABAJO: se invierte el
     eje para que el más grande —la tabla ya viene ordenada— salga arriba,
     que es donde se lee primero. */
  const categoryOrientation = horizontal ? "maxMin" : "minMax";
  const categoryPosition = horizontal ? "l" : "b";
  const valuePosition = horizontal ? "b" : "l";
  const crosses = horizontal ? "max" : "autoZero";

  return (
    `<c:catAx><c:axId val="1"/><c:scaling><c:orientation val="${categoryOrientation}"/></c:scaling>` +
    `<c:delete val="0"/><c:axPos val="${categoryPosition}"/><c:numFmt formatCode="General" sourceLinked="0"/>` +
    `<c:majorTickMark val="none"/><c:minorTickMark val="none"/><c:tickLblPos val="nextTo"/>` +
    `<c:spPr><a:ln w="9525">${solidFill("94A3B8")}</a:ln></c:spPr>${textProps(900)}` +
    `<c:crossAx val="2"/><c:crosses val="autoZero"/><c:auto val="1"/><c:lblAlgn val="ctr"/>` +
    `<c:lblOffset val="100"/><c:noMultiLvlLbl val="0"/></c:catAx>` +
    `<c:valAx><c:axId val="2"/><c:scaling><c:orientation val="minMax"/></c:scaling>` +
    `<c:delete val="0"/><c:axPos val="${valuePosition}"/>` +
    `<c:majorGridlines><c:spPr><a:ln w="6350">${solidFill("E2E8F0")}</a:ln></c:spPr></c:majorGridlines>` +
    `<c:numFmt formatCode="#,##0" sourceLinked="0"/><c:majorTickMark val="none"/><c:minorTickMark val="none"/>` +
    `<c:tickLblPos val="nextTo"/><c:spPr><a:ln><a:noFill/></a:ln></c:spPr>${textProps(900)}` +
    `<c:crossAx val="1"/><c:crosses val="${crosses}"/><c:crossBetween val="between"/></c:valAx>`
  );
}

function barChartXml(spec: ChartSpec): string {
  const horizontal = spec.type === "bar";
  const grouping = spec.stacked ? "stacked" : "clustered";
  // Apiladas, las series se enciman al 100%: es lo que las pone una sobre otra.
  const overlap = spec.stacked ? `<c:overlap val="100"/>` : "";

  return (
    `<c:barChart><c:barDir val="${horizontal ? "bar" : "col"}"/><c:grouping val="${grouping}"/>` +
    `<c:varyColors val="0"/>${barSeriesXml(spec)}<c:gapWidth val="60"/>${overlap}` +
    `<c:axId val="1"/><c:axId val="2"/></c:barChart>${axesXml(horizontal)}`
  );
}

function doughnutChartXml(spec: ChartSpec): string {
  const series = spec.series[0];
  if (!series) return "";

  const colors = spec.sliceColors ?? [];
  const slices = spec.categories
    .map(
      (_, index) =>
        `<c:dPt><c:idx val="${index}"/><c:bubble3D val="0"/>` +
        `<c:spPr>${solidFill(colors[index] ?? series.color)}<a:ln w="12700">${solidFill("FFFFFF")}</a:ln></c:spPr></c:dPt>`,
    )
    .join("");

  return (
    `<c:doughnutChart><c:varyColors val="1"/><c:ser><c:idx val="0"/><c:order val="0"/>` +
    `${seriesName(series.name)}${slices}${labelsXml(null, true)}${categoriesXml(spec)}${valuesXml(spec, series)}</c:ser>` +
    `<c:firstSliceAng val="0"/><c:holeSize val="55"/></c:doughnutChart>`
  );
}

const PLOT_BUILDERS: Record<ChartType, (spec: ChartSpec) => string> = {
  column: barChartXml,
  bar: barChartXml,
  doughnut: doughnutChartXml,
};

/** El XML de `xl/charts/chartN.xml`. */
export function chartXml(spec: ChartSpec): string {
  /* La leyenda sólo cuando hay algo que distinguir: con una sola serie de
     barras repite el título, y en la dona es lo que dice qué color es qué. */
  const showLegend = spec.type === "doughnut" || spec.series.length > 1;
  const legend = showLegend
    ? `<c:legend><c:legendPos val="b"/><c:overlay val="0"/>${textProps(900)}</c:legend>`
    : "";

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<c:chartSpace ${NS}><c:roundedCorners val="0"/><c:chart>${titleXml(spec.title)}<c:autoTitleDeleted val="0"/>` +
    `<c:plotArea><c:layout/>${PLOT_BUILDERS[spec.type](spec)}</c:plotArea>${legend}` +
    `<c:plotVisOnly val="1"/><c:dispBlanksAs val="gap"/></c:chart>` +
    // Sin sombra ni esquinas redondas: el mismo diseño plano de la app.
    `<c:spPr>${solidFill("FFFFFF")}<a:ln w="9525">${solidFill("CBD5E1")}</a:ln></c:spPr></c:chartSpace>`;
}

/** Un ancla de la hoja de dibujo: dónde va la gráfica y a qué parte apunta. */
export function chartAnchorXml(spec: ChartSpec, index: number): string {
  const [fromCol, fromRow] = spec.from;
  const [toCol, toRow] = spec.to;

  return (
    `<xdr:twoCellAnchor editAs="oneCell">` +
    `<xdr:from><xdr:col>${fromCol}</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>${fromRow}</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:from>` +
    `<xdr:to><xdr:col>${toCol}</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>${toRow}</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:to>` +
    `<xdr:graphicFrame macro=""><xdr:nvGraphicFramePr><xdr:cNvPr id="${index + 2}" name="Gráfica ${index + 1}"/>` +
    `<xdr:cNvGraphicFramePr/></xdr:nvGraphicFramePr><xdr:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/></xdr:xfrm>` +
    `<a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/chart">` +
    `<c:chart xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" ` +
    `xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" r:id="rId${index + 1}"/>` +
    `</a:graphicData></a:graphic></xdr:graphicFrame><xdr:clientData/></xdr:twoCellAnchor>`
  );
}
