import {
  Document,
  Page,
  StyleSheet,
  Text,
  View,
  renderToBuffer,
} from "@react-pdf/renderer";
import { formatDate, formatQuantity } from "@/lib/utils";
import type { PackingList, PackingListBoxGroup, PackingListSummaryLine } from "./packing-list";
import { grandTotalLabel, subtotalLabel } from "./packing-list-format";

/**
 * El packing list en PDF: hoja carta, Helvetica integrada y el mismo acomodo
 * que el Excel (formato F12-POP01). Lo que dice ya viene resuelto en
 * `PackingList`; aquí sólo se dibuja.
 */
export async function renderPackingListPdf(list: PackingList): Promise<Buffer> {
  return renderToBuffer(<PackingListPdf list={list} />);
}

const BORDER = "#000000";
const HEADER_FILL = "#e5e5e5";
const TOTAL_FILL = "#f5f5f5";

const styles = StyleSheet.create({
  page: { padding: 28, fontFamily: "Helvetica", fontSize: 9, color: "#000000" },
  top: { flexDirection: "row", borderWidth: 1, borderColor: BORDER },
  titleBox: { flex: 1, justifyContent: "center", alignItems: "center", paddingVertical: 6 },
  title: { fontSize: 20, fontFamily: "Helvetica-Bold" },
  formatBox: { width: "26%", borderLeftWidth: 1, borderColor: BORDER },
  formatCell: { paddingVertical: 3, paddingHorizontal: 5, fontFamily: "Helvetica-Bold" },
  formatSplit: { borderTopWidth: 1, borderColor: BORDER },
  facts: { marginTop: 6, flexDirection: "row", flexWrap: "wrap" },
  fact: { width: "50%", flexDirection: "row", marginBottom: 3 },
  bold: { fontFamily: "Helvetica-Bold" },
  label: { fontFamily: "Helvetica-Bold", marginRight: 4, width: 58 },
  table: { marginTop: 6, borderTopWidth: 1, borderLeftWidth: 1, borderColor: BORDER },
  row: { flexDirection: "row" },
  cell: { borderRightWidth: 1, borderBottomWidth: 1, borderColor: BORDER, paddingVertical: 2, paddingHorizontal: 3 },
  right: { textAlign: "right" },
  center: { textAlign: "center" },
  sectionTitle: { marginTop: 12, fontSize: 9, fontFamily: "Helvetica-Bold", textTransform: "uppercase" },
  notes: { marginTop: 8 },
  signatures: { marginTop: 36, flexDirection: "row", gap: 16 },
  signature: { flex: 1, borderTopWidth: 1, borderColor: BORDER, paddingTop: 3, alignItems: "center" },
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

/** Anchos de la tabla principal, en porcentaje. Suman 100. */
const COLUMNS = {
  orderRef: "11%", destination: "13%", description: "33%", color: "13%", box: "7%", size: "10%", qty: "13%",
} as const;
const SUBTOTAL_LABEL_WIDTH = "87%";

/** Anchos del resumen. Suman 100. */
const SUMMARY = { description: "50%", color: "20%", size: "17%", qty: "13%" } as const;

function PackingListPdf({ list }: { list: PackingList }) {
  return (
    <Document title={list.code} author="UNISOUTH">
      <Page size="LETTER" style={styles.page}>
        {list.preliminary && <Text style={styles.stamp} fixed>PRELIMINAR</Text>}
        <Letterhead list={list} />
        <MainTable list={list} />
        <Text style={styles.sectionTitle}>Resumen del pedido</Text>
        <SummaryTable summary={list.summary} total={list.totalPieces} />
        {list.notes && (
          <Text style={styles.notes}>
            <Text style={styles.bold}>Notas: </Text>
            {list.notes}
          </Text>
        )}
        <Signatures list={list} />
      </Page>
    </Document>
  );
}

function Letterhead({ list }: { list: PackingList }) {
  return (
    <>
      <View style={styles.top}>
        <View style={styles.titleBox}>
          <Text style={styles.title}>PACKING-LIST</Text>
          {list.preliminary && <Text>PRELIMINAR · pedido abierto</Text>}
        </View>
        <View style={styles.formatBox}>
          <Text style={styles.formatCell}>{list.formatCode}</Text>
          <Text style={[styles.formatCell, styles.formatSplit]}>{list.revision}</Text>
        </View>
      </View>
      <View style={styles.facts}>
        <Fact label="CLIENTE:" value={list.client} />
        <Fact label="PEDIDO:" value={`${list.code} · ${list.name}`} />
        <Fact label="FECHA:" value={formatDate(list.date)} />
        <Fact label="ELABORÓ:" value={list.preparedBy} />
      </View>
    </>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.fact}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.bold}>{value}</Text>
    </View>
  );
}

function MainTable({ list }: { list: PackingList }) {
  return (
    <View style={styles.table}>
      <View style={[styles.row, { backgroundColor: HEADER_FILL }]} fixed>
        <HeaderCell width={COLUMNS.orderRef}>ORDEN</HeaderCell>
        <HeaderCell width={COLUMNS.destination}>DESTINO</HeaderCell>
        <HeaderCell width={COLUMNS.description}>DESCRIPCIÓN</HeaderCell>
        <HeaderCell width={COLUMNS.color}>COLOR</HeaderCell>
        <HeaderCell width={COLUMNS.box}>CAJA</HeaderCell>
        <HeaderCell width={COLUMNS.size}>TALLAS</HeaderCell>
        <HeaderCell width={COLUMNS.qty} right>CANTIDAD</HeaderCell>
      </View>
      {list.groups.map((group, index) => (
        <BoxRows key={index} group={group} />
      ))}
      <TotalRow label={grandTotalLabel(list)} pieces={list.totalPieces} />
    </View>
  );
}

function BoxRows({ group }: { group: PackingListBoxGroup }) {
  return (
    <View wrap={false}>
      {group.rows.map((row, index) => (
        <View key={index} style={styles.row}>
          <Text style={[styles.cell, { width: COLUMNS.orderRef }]}>{row.orderRef}</Text>
          <Text style={[styles.cell, { width: COLUMNS.destination }]}>{row.destination}</Text>
          <Text style={[styles.cell, { width: COLUMNS.description }]}>{row.description}</Text>
          <Text style={[styles.cell, { width: COLUMNS.color }]}>{row.color}</Text>
          {/* El número de caja sólo en su primer renglón, como en el papel. */}
          <Text style={[styles.cell, styles.center, styles.bold, { width: COLUMNS.box }]}>
            {index === 0 && group.boxNumber !== null ? group.boxNumber : ""}
          </Text>
          <Text style={[styles.cell, styles.center, { width: COLUMNS.size }]}>{row.size}</Text>
          <Text style={[styles.cell, styles.right, { width: COLUMNS.qty }]}>{formatQuantity(row.quantity)}</Text>
        </View>
      ))}
      <TotalRow label={subtotalLabel(group)} pieces={group.pieces} />
    </View>
  );
}

function HeaderCell({ width, right, children }: { width: string; right?: boolean; children: string }) {
  return <Text style={[styles.cell, styles.bold, right ? styles.right : styles.center, { width }]}>{children}</Text>;
}

function TotalRow({ label, pieces }: { label: string; pieces: number }) {
  return (
    <View style={[styles.row, { backgroundColor: TOTAL_FILL }]}>
      <Text style={[styles.cell, styles.bold, { width: SUBTOTAL_LABEL_WIDTH }]}>{label}</Text>
      <Text style={[styles.cell, styles.bold, styles.right, { width: COLUMNS.qty }]}>{formatQuantity(pieces)}</Text>
    </View>
  );
}

function SummaryTable({ summary, total }: { summary: PackingListSummaryLine[]; total: number }) {
  return (
    <View style={styles.table}>
      <View style={[styles.row, { backgroundColor: HEADER_FILL }]}>
        <HeaderCell width={SUMMARY.description}>DESCRIPCIÓN</HeaderCell>
        <HeaderCell width={SUMMARY.color}>COLOR</HeaderCell>
        <HeaderCell width={SUMMARY.size}>TALLA</HeaderCell>
        <HeaderCell width={SUMMARY.qty} right>PIEZAS</HeaderCell>
      </View>
      {summary.map((line, index) => (
        <View key={index} style={styles.row} wrap={false}>
          <Text style={[styles.cell, { width: SUMMARY.description }]}>{line.description}</Text>
          <Text style={[styles.cell, { width: SUMMARY.color }]}>{line.color}</Text>
          <Text style={[styles.cell, styles.center, { width: SUMMARY.size }]}>{line.size}</Text>
          <Text style={[styles.cell, styles.right, { width: SUMMARY.qty }]}>{formatQuantity(line.pieces)}</Text>
        </View>
      ))}
      <TotalRow label="TOTAL" pieces={total} />
    </View>
  );
}

function Signatures({ list }: { list: PackingList }) {
  const entries = [
    { title: "ELABORÓ", name: list.preparedBy },
    { title: "REVISÓ", name: list.reviewedBy },
    { title: "RECIBIÓ (TRANSPORTISTA)", name: list.receivedBy },
  ];
  return (
    <View style={styles.signatures} wrap={false}>
      {entries.map((entry) => (
        <View key={entry.title} style={styles.signature}>
          <Text>{entry.name || " "}</Text>
          <Text style={styles.bold}>{entry.title}</Text>
        </View>
      ))}
    </View>
  );
}
