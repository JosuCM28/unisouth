import {
  Document,
  Page,
  StyleSheet,
  Text,
  View,
  renderToBuffer,
} from "@react-pdf/renderer";
import type {
  VoucherField,
  VoucherSheet,
  VoucherTag,
} from "./voucher-sheet";

/**
 * El vale en PDF: la misma hoja de /print/document, dibujada con react-pdf.
 *
 * No se imprime la página HTML con un navegador sin cabeza porque eso mete
 * Chromium al contenedor —cientos de megas y memoria en un VPS chico— para
 * dibujar una tabla. Lo que se paga a cambio es escribir el dibujo dos veces;
 * lo que NO se duplica es qué dice el papel, que viene resuelto en
 * `VoucherSheet`.
 *
 * Carta y con Helvetica, que react-pdf trae integrada: una fuente descargada
 * sería una petición más que puede fallar justo al aplicar la salida.
 */
export async function renderVoucherPdf(sheet: VoucherSheet): Promise<Buffer> {
  return renderToBuffer(<VoucherPdf sheet={sheet} />);
}

const BORDER = "#000000";
const HEADER_FILL = "#e5e5e5";
const TOTAL_FILL = "#f5f5f5";

const styles = StyleSheet.create({
  page: {
    padding: 32,
    fontFamily: "Helvetica",
    fontSize: 10,
    color: "#000000",
  },
  top: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderBottomWidth: 2,
    borderBottomColor: BORDER,
    paddingBottom: 6,
  },
  brand: { fontSize: 8 },
  title: { fontSize: 18, fontFamily: "Helvetica-Bold" },
  code: { fontSize: 13, fontFamily: "Helvetica-Bold", textAlign: "right" },
  status: { fontSize: 7, textAlign: "right", textTransform: "uppercase" },
  box: { marginTop: 8, borderWidth: 1, borderColor: BORDER, padding: 6 },
  grid: { flexDirection: "row", flexWrap: "wrap" },
  field: { width: "50%", flexDirection: "row", marginBottom: 2 },
  fieldLabel: { fontFamily: "Helvetica-Bold", marginRight: 4 },
  table: { marginTop: 8, borderTopWidth: 1, borderLeftWidth: 1, borderColor: BORDER },
  row: { flexDirection: "row" },
  cell: {
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: BORDER,
    paddingVertical: 2,
    paddingHorizontal: 4,
  },
  bold: { fontFamily: "Helvetica-Bold" },
  right: { textAlign: "right" },
  center: { textAlign: "center" },
  grandTotal: {
    marginTop: 4,
    textAlign: "right",
    fontSize: 12,
    fontFamily: "Helvetica-Bold",
  },
  sectionTitle: { fontSize: 8, fontFamily: "Helvetica-Bold", textTransform: "uppercase" },
  note: { flexDirection: "row", marginTop: 2 },
  noteNumber: { fontFamily: "Helvetica-Bold", marginRight: 6 },
  footer: {
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: BORDER,
    paddingTop: 4,
    fontSize: 9,
  },
  remarks: { marginTop: 8, borderWidth: 1, borderColor: "#a3a3a3", padding: 6, fontSize: 9 },
  signatures: { marginTop: 40, flexDirection: "row", justifyContent: "space-between" },
  signature: { width: "45%", alignItems: "center", fontSize: 9 },
  line: { width: "100%", borderBottomWidth: 1, borderBottomColor: BORDER },
});

/**
 * Anchos de la tabla de tallas, en porcentaje. Suman 100.
 *
 * Las anotaciones se llevan el hueco más grande: son texto libre, y son la
 * razón por la que el taller lee el vale en vez de sólo contar bultos.
 */
const CUT_COLUMNS = {
  size: "13%",
  quantity: "14%",
  bundles: "12%",
  total: "12%",
  tag: "17%",
  notes: "32%",
} as const;

/** Anchos de la tabla de rollos. Suman 100. */
const ROLL_COLUMNS = {
  check: "6%",
  code: "20%",
  material: "40%",
  shade: "14%",
  quantity: "20%",
} as const;

function VoucherPdf({ sheet }: { sheet: VoucherSheet }) {
  return (
    <Document title={sheet.code} author="UNISOUTH">
      <Page size="LETTER" style={styles.page}>
        <View style={styles.top}>
          <View>
            <Text style={styles.brand}>UNISOUTH</Text>
            <Text style={styles.title}>{sheet.title}</Text>
          </View>
          <View>
            <Text style={styles.code}>{sheet.code}</Text>
            <Text style={styles.status}>{sheet.status}</Text>
          </View>
        </View>

        {sheet.header.length > 0 && (
          <View style={[styles.box, styles.grid]}>
            <Fields fields={sheet.header} />
          </View>
        )}

        {sheet.cutRows.length > 0 && <CutTable sheet={sheet} />}

        {sheet.cutNotes.length > 0 && (
          <View style={styles.box}>
            <Text style={styles.sectionTitle}>Notas</Text>
            {sheet.cutNotes.map((note, index) => (
              <View key={index} style={styles.note}>
                <Text style={styles.noteNumber}>Nota {index + 1}.</Text>
                <Text>{note}</Text>
              </View>
            ))}
          </View>
        )}

        {sheet.rollRows.length > 0 && <RollTable sheet={sheet} />}

        {sheet.footer.length > 0 && (
          <View style={[styles.footer, styles.grid]}>
            <Fields fields={sheet.footer} />
          </View>
        )}

        {sheet.notes && <Text style={styles.remarks}>{sheet.notes}</Text>}

        {/* `wrap={false}`: las firmas nunca se quedan solas en otra hoja. */}
        <View style={styles.signatures} wrap={false}>
          <Signature label="Entrega" name={sheet.handedOverBy} />
          <Signature label="Recibe" name={sheet.receivedBy} />
        </View>
      </Page>
    </Document>
  );
}

function CutTable({ sheet }: { sheet: VoucherSheet }) {
  const { cutTotals } = sheet;

  return (
    <View>
      <View style={styles.table}>
        {/* `fixed`: si el desglose no cabe en una hoja, el encabezado se
            repite arriba de la siguiente. */}
        <View style={[styles.row, { backgroundColor: HEADER_FILL }]} fixed>
          <Cell width={CUT_COLUMNS.size} bold>Talla</Cell>
          <Cell width={CUT_COLUMNS.quantity} bold align="right">Cantidad</Cell>
          <Cell width={CUT_COLUMNS.bundles} bold align="right">Bultos</Cell>
          <Cell width={CUT_COLUMNS.total} bold align="right">Total</Cell>
          <Cell width={CUT_COLUMNS.tag} bold>Foleo</Cell>
          <Cell width={CUT_COLUMNS.notes} bold>Anotaciones</Cell>
        </View>

        {sheet.cutRows.map((row) => (
          <View key={row.id} style={styles.row} wrap={false}>
            <Cell width={CUT_COLUMNS.size} bold>{row.sizeCode}</Cell>
            <Cell width={CUT_COLUMNS.quantity} align="right">{row.quantity}</Cell>
            <Cell width={CUT_COLUMNS.bundles} align="right">{row.bundles}</Cell>
            <Cell width={CUT_COLUMNS.total} bold align="right">{row.total}</Cell>
            <TagCell tag={row.tag} />
            <Cell width={CUT_COLUMNS.notes}>{row.notes ?? ""}</Cell>
          </View>
        ))}

        <View style={[styles.row, { backgroundColor: TOTAL_FILL }]} wrap={false}>
          <Cell width={CUT_COLUMNS.size} bold>SUMA</Cell>
          <Cell width={CUT_COLUMNS.quantity} bold align="right">{cutTotals.perBundle}</Cell>
          <Cell width={CUT_COLUMNS.bundles} bold align="right">{cutTotals.bundles}</Cell>
          <Cell width={CUT_COLUMNS.total} bold align="right">{cutTotals.pieces}</Cell>
          <Cell width="49%">{""}</Cell>
        </View>
      </View>

      <Text style={styles.grandTotal}>
        Total de cortes entregados: {cutTotals.pieces}
      </Text>
    </View>
  );
}

function RollTable({ sheet }: { sheet: VoucherSheet }) {
  return (
    <View style={{ marginTop: 10 }}>
      <Text style={styles.sectionTitle}>Rollos entregados</Text>
      <View style={styles.table}>
        <View style={[styles.row, { backgroundColor: HEADER_FILL }]} fixed>
          <Cell width={ROLL_COLUMNS.check}>{""}</Cell>
          <Cell width={ROLL_COLUMNS.code} bold>Folio</Cell>
          <Cell width={ROLL_COLUMNS.material} bold>Material</Cell>
          <Cell width={ROLL_COLUMNS.shade} bold>Tono</Cell>
          <Cell width={ROLL_COLUMNS.quantity} bold align="right">Cantidad</Cell>
        </View>

        {sheet.rollRows.map((row) => (
          <View key={row.id} style={styles.row} wrap={false}>
            <Cell width={ROLL_COLUMNS.check}>{""}</Cell>
            <Cell width={ROLL_COLUMNS.code}>{row.code}</Cell>
            <Cell width={ROLL_COLUMNS.material}>{row.material}</Cell>
            <Cell width={ROLL_COLUMNS.shade}>{row.shade ?? "—"}</Cell>
            <Cell width={ROLL_COLUMNS.quantity} align="right">{row.quantity}</Cell>
          </View>
        ))}
      </View>

      {sheet.rollSummary && (
        <Text style={[styles.bold, styles.right, { marginTop: 4 }]}>
          {sheet.rollSummary}
        </Text>
      )}
    </View>
  );
}

interface CellProps {
  width: string;
  children: React.ReactNode;
  bold?: boolean;
  align?: "left" | "right" | "center";
}

/** Una celda con borde. Se pinta de derecha y abajo para no duplicar líneas. */
function Cell({ width, children, bold, align = "left" }: CellProps) {
  return (
    <View style={[styles.cell, { width }]}>
      <Text style={[{ textAlign: align }, bold ? styles.bold : {}]}>
        {children}
      </Text>
    </View>
  );
}

/** La celda del foleo, pintada del color del papelito, como en la hoja. */
function TagCell({ tag }: { tag: VoucherTag | null }) {
  if (!tag) {
    return (
      <Cell width={CUT_COLUMNS.tag} align="center">
        —
      </Cell>
    );
  }

  return (
    <View
      style={[styles.cell, { width: CUT_COLUMNS.tag, backgroundColor: tag.background }]}
    >
      <Text style={[styles.center, { color: tag.text }]}>{tag.name}</Text>
    </View>
  );
}

function Fields({ fields }: { fields: VoucherField[] }) {
  return fields.map((field) => (
    <View key={field.label} style={styles.field}>
      <Text style={styles.fieldLabel}>{field.label}:</Text>
      <Text>{field.value}</Text>
    </View>
  ));
}

function Signature({ label, name }: { label: string; name: string | null }) {
  return (
    <View style={styles.signature}>
      <View style={styles.line} />
      <Text style={[styles.bold, { marginTop: 3 }]}>{label}</Text>
      {name ? (
        <Text style={{ fontSize: 8 }}>{name}</Text>
      ) : (
        <>
          <View style={[styles.line, { marginTop: 18 }]} />
          <Text style={{ fontSize: 8, marginTop: 3 }}>Nombre</Text>
        </>
      )}
    </View>
  );
}
