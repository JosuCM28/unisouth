import {
  Document,
  Page,
  StyleSheet,
  Text,
  View,
  renderToBuffer,
} from "@react-pdf/renderer";
import { formatDate, formatQuantity } from "@/lib/utils";
import type { PackingList, PackingListLine } from "./packing-list";

/**
 * El packing list en PDF: hoja carta, Helvetica integrada, el mismo estilo
 * que el vale. Lo que dice ya viene resuelto en `PackingList`; aquí sólo se
 * dibuja.
 */
export async function renderPackingListPdf(list: PackingList): Promise<Buffer> {
  return renderToBuffer(<PackingListPdf list={list} />);
}

const BORDER = "#000000";
const HEADER_FILL = "#e5e5e5";
const TOTAL_FILL = "#f5f5f5";

const styles = StyleSheet.create({
  page: { padding: 32, fontFamily: "Helvetica", fontSize: 10, color: "#000000" },
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
  small: { fontSize: 8, textAlign: "right" },
  facts: { marginTop: 8, borderWidth: 1, borderColor: BORDER, padding: 6, flexDirection: "row", flexWrap: "wrap" },
  fact: { width: "50%", flexDirection: "row", marginBottom: 2 },
  bold: { fontFamily: "Helvetica-Bold" },
  label: { fontFamily: "Helvetica-Bold", marginRight: 4 },
  boxTitle: {
    marginTop: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    fontFamily: "Helvetica-Bold",
    fontSize: 11,
  },
  table: { marginTop: 3, borderTopWidth: 1, borderLeftWidth: 1, borderColor: BORDER },
  row: { flexDirection: "row" },
  cell: { borderRightWidth: 1, borderBottomWidth: 1, borderColor: BORDER, paddingVertical: 2, paddingHorizontal: 4 },
  right: { textAlign: "right" },
  sectionTitle: { marginTop: 14, fontSize: 9, fontFamily: "Helvetica-Bold", textTransform: "uppercase" },
  grandTotal: { marginTop: 6, textAlign: "right", fontSize: 12, fontFamily: "Helvetica-Bold" },
  /* Cruzado y tenue: se lee lo que va en las cajas, pero nadie confunde esta
     hoja con la definitiva mientras el pedido siga abierto. */
  stamp: {
    position: "absolute",
    top: 330,
    left: 0,
    right: 0,
    textAlign: "center",
    fontSize: 80,
    fontFamily: "Helvetica-Bold",
    color: "#737373",
    opacity: 0.2,
    transform: "rotate(-30deg)",
  },
});

/** Anchos de la tabla, en porcentaje. Suman 100. */
const COLUMNS = { category: "18%", product: "40%", size: "10%", po: "18%", pieces: "14%" } as const;

function PackingListPdf({ list }: { list: PackingList }) {
  return (
    <Document title={list.code} author="UNISOUTH">
      <Page size="LETTER" style={styles.page}>
        {list.preliminary && <Text style={styles.stamp} fixed>PRELIMINAR</Text>}
        <Header list={list} />
        {list.boxes.map((box) => (
          <View key={box.number} wrap={false}>
            <View style={styles.boxTitle}>
              <Text>CAJA {box.number}</Text>
              <Text>{formatQuantity(box.pieces)} pzas</Text>
            </View>
            <LinesTable lines={box.lines} />
          </View>
        ))}
        <Text style={styles.sectionTitle}>Resumen del pedido</Text>
        <LinesTable lines={list.summary} />
        <Text style={styles.grandTotal}>
          {list.totalBoxes} {list.totalBoxes === 1 ? "caja" : "cajas"} · {formatQuantity(list.totalPieces)} pzas
        </Text>
      </Page>
    </Document>
  );
}

function Header({ list }: { list: PackingList }) {
  return (
    <>
      <View style={styles.top}>
        <View>
          <Text style={styles.brand}>UNISOUTH</Text>
          <Text style={styles.title}>PACKING LIST</Text>
        </View>
        <View>
          <Text style={styles.code}>{list.code}</Text>
          <Text style={styles.small}>{list.preliminary ? "PRELIMINAR · pedido abierto" : "Pedido cerrado"}</Text>
        </View>
      </View>
      <View style={styles.facts}>
        <Fact label="Pedido" value={list.name} />
        <Fact label="Cliente" value={list.client} />
        <Fact label="Fecha" value={formatDate(list.date)} />
        <Fact label="Total" value={`${list.totalBoxes} cajas · ${formatQuantity(list.totalPieces)} pzas`} />
      </View>
    </>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.fact}>
      <Text style={styles.label}>{label}:</Text>
      <Text>{value}</Text>
    </View>
  );
}

function LinesTable({ lines }: { lines: PackingListLine[] }) {
  return (
    <View style={styles.table}>
      <View style={[styles.row, { backgroundColor: HEADER_FILL }]}>
        <Text style={[styles.cell, styles.bold, { width: COLUMNS.category }]}>Tipo</Text>
        <Text style={[styles.cell, styles.bold, { width: COLUMNS.product }]}>Producto</Text>
        <Text style={[styles.cell, styles.bold, { width: COLUMNS.size }]}>Talla</Text>
        <Text style={[styles.cell, styles.bold, { width: COLUMNS.po }]}>PO</Text>
        <Text style={[styles.cell, styles.bold, styles.right, { width: COLUMNS.pieces }]}>Piezas</Text>
      </View>
      {lines.map((line, index) => (
        <View key={index} style={styles.row} wrap={false}>
          <Text style={[styles.cell, { width: COLUMNS.category }]}>{line.category}</Text>
          <Text style={[styles.cell, { width: COLUMNS.product }]}>{line.product}</Text>
          <Text style={[styles.cell, { width: COLUMNS.size }]}>{line.size}</Text>
          <Text style={[styles.cell, { width: COLUMNS.po }]}>{line.po}</Text>
          <Text style={[styles.cell, styles.right, { width: COLUMNS.pieces }]}>{formatQuantity(line.pieces)}</Text>
        </View>
      ))}
      <View style={[styles.row, { backgroundColor: TOTAL_FILL }]}>
        <Text style={[styles.cell, styles.bold, { width: "86%" }]}>Total</Text>
        <Text style={[styles.cell, styles.bold, styles.right, { width: COLUMNS.pieces }]}>
          {formatQuantity(lines.reduce((sum, line) => sum + line.pieces, 0))}
        </Text>
      </View>
    </View>
  );
}
