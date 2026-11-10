import {
  Document,
  Page,
  StyleSheet,
  Text,
  View,
  renderToBuffer,
} from "@react-pdf/renderer";
import type { VoucherField } from "@/lib/vouchers/voucher-sheet";
import type { OrderSheet } from "./order-sheet";

/**
 * La hoja de la orden en PDF: la misma de /print/order, dibujada con
 * react-pdf, para que el taller la abra en el visor del celular.
 *
 * Mismas razones que el PDF del vale: sin navegador sin cabeza en el
 * contenedor, carta y Helvetica integrada. Lo que dice el papel viene
 * resuelto en `OrderSheet`; aquí sólo se dibuja.
 */
export async function renderOrderPdf(sheet: OrderSheet): Promise<Buffer> {
  return renderToBuffer(<OrderPdf sheet={sheet} />);
}

const BORDER = "#000000";
const LIGHT_BORDER = "#a3a3a3";
const HEADER_FILL = "#e5e5e5";

const styles = StyleSheet.create({
  page: { padding: 32, fontFamily: "Helvetica", fontSize: 10, color: "#000000" },
  top: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderBottomWidth: 2,
    borderBottomColor: BORDER,
    paddingBottom: 6,
  },
  brand: { fontSize: 14, fontFamily: "Helvetica-Bold" },
  subtitle: { fontSize: 9 },
  code: { fontSize: 13, fontFamily: "Helvetica-Bold", textAlign: "right" },
  small: { fontSize: 9, textAlign: "right" },
  status: { fontSize: 7, textAlign: "right", textTransform: "uppercase" },
  section: { borderBottomWidth: 1, borderBottomColor: BORDER, paddingVertical: 6 },
  grid: { flexDirection: "row", flexWrap: "wrap" },
  field: { width: "50%", flexDirection: "row", marginBottom: 2, paddingRight: 6 },
  fieldLabel: { fontFamily: "Helvetica-Bold", marginRight: 4 },
  fieldValue: { flex: 1 },
  sectionTitle: { fontFamily: "Helvetica-Bold", marginBottom: 2 },
  note: { flexDirection: "row", marginTop: 1 },
  noteNumber: { width: 14 },
  table: { marginTop: 8, borderTopWidth: 1, borderLeftWidth: 1, borderColor: BORDER },
  row: { flexDirection: "row" },
  headRow: { flexDirection: "row", backgroundColor: HEADER_FILL },
  cell: {
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: BORDER,
    paddingVertical: 2,
    paddingHorizontal: 4,
  },
  lightCell: {
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: LIGHT_BORDER,
    paddingVertical: 2,
    paddingHorizontal: 3,
  },
  bold: { fontFamily: "Helvetica-Bold" },
  right: { textAlign: "right" },
  historyTitle: { marginTop: 12, fontFamily: "Helvetica-Bold" },
  historyTable: {
    marginTop: 4,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderColor: LIGHT_BORDER,
    fontSize: 8,
  },
  remarks: { marginTop: 8, borderTopWidth: 1, borderTopColor: BORDER, paddingTop: 4 },
  signatures: { marginTop: 40, flexDirection: "row", justifyContent: "space-between" },
  signature: { width: "45%", alignItems: "center", fontSize: 9 },
  line: { width: "100%", height: 30, borderBottomWidth: 1, borderBottomColor: BORDER },
});

/**
 * Anchos de la tabla de tallas, en porcentaje. Suman 100. Las anotaciones se
 * llevan el hueco grande: son texto libre y son instrucciones para el taller.
 */
const SIZE_COLUMNS = {
  size: "10%",
  tag: "14%",
  ordered: "11%",
  cut: "11%",
  pending: "10%",
  surplus: "10%",
  notes: "34%",
} as const;

/** Anchos del historial. Suman 100. */
const HISTORY_COLUMNS = {
  at: "18%",
  batch: "13%",
  size: "8%",
  bundles: "10%",
  pieces: "9%",
  user: "16%",
  notes: "26%",
} as const;

function OrderPdf({ sheet }: { sheet: OrderSheet }) {
  return (
    <Document title={sheet.code} author="UNISOUTH">
      <Page size="LETTER" style={styles.page}>
        <View style={styles.top}>
          <View>
            <Text style={styles.brand}>UNISOUTH</Text>
            <Text style={styles.subtitle}>Orden de corte</Text>
          </View>
          <View>
            <Text style={styles.code}>{sheet.code}</Text>
            <Text style={styles.small}>{sheet.orderedAt}</Text>
            <Text style={styles.status}>{sheet.status}</Text>
          </View>
        </View>

        {sheet.header.length > 0 && (
          <View style={[styles.section, styles.grid]}>
            <Fields fields={sheet.header} />
          </View>
        )}

        {sheet.cutNotes.length > 0 && <CutNotes notes={sheet.cutNotes} />}

        <SizesTable sheet={sheet} />

        {sheet.history.length > 0 && <HistoryTable sheet={sheet} />}

        {sheet.notes && <Text style={styles.remarks}>{sheet.notes}</Text>}

        {/* `wrap={false}`: las firmas nunca se quedan solas en otra hoja. */}
        <View style={styles.signatures} wrap={false}>
          <Signature label="Entrega" />
          <Signature label="Recibe" />
        </View>
      </Page>
    </Document>
  );
}

function Fields({ fields }: { fields: VoucherField[] }) {
  return fields.map((field) => (
    <View key={field.label} style={styles.field}>
      <Text style={styles.fieldLabel}>{field.label}:</Text>
      <Text style={styles.fieldValue}>{field.value}</Text>
    </View>
  ));
}

/* Numeradas, para irlas palomeando en el taller. */
function CutNotes({ notes }: { notes: string[] }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Notas del corte</Text>
      {notes.map((note, index) => (
        <View key={index} style={styles.note}>
          <Text style={styles.noteNumber}>{index + 1}.</Text>
          <Text style={styles.fieldValue}>{note}</Text>
        </View>
      ))}
    </View>
  );
}

function SizesTable({ sheet }: { sheet: OrderSheet }) {
  const { totals } = sheet;

  return (
    <View style={styles.table}>
      {/* `fixed`: si la tabla se parte, el encabezado se repite en la hoja
          siguiente y las columnas se siguen leyendo. */}
      <View style={[styles.headRow, styles.bold]} fixed>
        <Cell width={SIZE_COLUMNS.size}>Talla</Cell>
        <Cell width={SIZE_COLUMNS.tag}>Folio</Cell>
        <Cell width={SIZE_COLUMNS.ordered} right>Pedidas</Cell>
        <Cell width={SIZE_COLUMNS.cut} right>Cortadas</Cell>
        <Cell width={SIZE_COLUMNS.pending} right>Faltan</Cell>
        <Cell width={SIZE_COLUMNS.surplus} right>Sobran</Cell>
        <Cell width={SIZE_COLUMNS.notes}>Anotaciones</Cell>
      </View>
      {sheet.lines.map((line) => (
        <View key={line.id} style={styles.row} wrap={false}>
          <Cell width={SIZE_COLUMNS.size} bold>{line.sizeCode}</Cell>
          <Cell width={SIZE_COLUMNS.tag}>{line.tagName}</Cell>
          <Cell width={SIZE_COLUMNS.ordered} right>{String(line.ordered)}</Cell>
          <Cell width={SIZE_COLUMNS.cut} right>{String(line.cut)}</Cell>
          <Cell width={SIZE_COLUMNS.pending} right>{line.pending}</Cell>
          <Cell width={SIZE_COLUMNS.surplus} right bold>{line.surplus}</Cell>
          <Cell width={SIZE_COLUMNS.notes}>{line.notes}</Cell>
        </View>
      ))}
      <View style={[styles.row, styles.bold]} wrap={false}>
        <Cell width="24%">Total</Cell>
        <Cell width={SIZE_COLUMNS.ordered} right>{String(totals.ordered)}</Cell>
        <Cell width={SIZE_COLUMNS.cut} right>{String(totals.cut)}</Cell>
        <Cell width={SIZE_COLUMNS.pending} right>{totals.pending}</Cell>
        <Cell width={SIZE_COLUMNS.surplus} right>{totals.surplus}</Cell>
        <Cell width={SIZE_COLUMNS.notes}>{""}</Cell>
      </View>
    </View>
  );
}

function HistoryTable({ sheet }: { sheet: OrderSheet }) {
  return (
    <View>
      <Text style={styles.historyTitle}>Historial de cortes</Text>
      <View style={styles.historyTable}>
        <View style={[styles.headRow, styles.bold]} fixed>
          <Cell light width={HISTORY_COLUMNS.at}>Fecha</Cell>
          <Cell light width={HISTORY_COLUMNS.batch}>Corte</Cell>
          <Cell light width={HISTORY_COLUMNS.size}>Talla</Cell>
          <Cell light width={HISTORY_COLUMNS.bundles} right>Bultos</Cell>
          <Cell light width={HISTORY_COLUMNS.pieces} right>Piezas</Cell>
          <Cell light width={HISTORY_COLUMNS.user}>Quién</Cell>
          <Cell light width={HISTORY_COLUMNS.notes}>Notas</Cell>
        </View>
        {sheet.history.map((entry) => (
          <View key={entry.id} style={styles.row} wrap={false}>
            <Cell light width={HISTORY_COLUMNS.at}>{entry.at}</Cell>
            <Cell light width={HISTORY_COLUMNS.batch}>{entry.batch}</Cell>
            <Cell light width={HISTORY_COLUMNS.size}>{entry.sizeCode}</Cell>
            <Cell light width={HISTORY_COLUMNS.bundles} right>{entry.bundles}</Cell>
            <Cell light width={HISTORY_COLUMNS.pieces} right>{entry.pieces}</Cell>
            <Cell light width={HISTORY_COLUMNS.user}>{entry.userName}</Cell>
            <Cell light width={HISTORY_COLUMNS.notes}>{entry.notes}</Cell>
          </View>
        ))}
      </View>
    </View>
  );
}

function Cell({
  width,
  right = false,
  bold = false,
  light = false,
  children,
}: {
  width: string;
  right?: boolean;
  bold?: boolean;
  light?: boolean;
  children: string;
}) {
  return (
    <Text
      style={[
        light ? styles.lightCell : styles.cell,
        { width },
        right ? styles.right : {},
        bold ? styles.bold : {},
      ]}
    >
      {children}
    </Text>
  );
}

function Signature({ label }: { label: string }) {
  return (
    <View style={styles.signature}>
      <View style={styles.line} />
      <Text>{label}</Text>
    </View>
  );
}
