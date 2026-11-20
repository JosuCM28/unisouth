/**
 * Los estilos del REPORTE DIARIO DE CORTE Y TENDIDO, sacados del formato que
 * ya se llenaba a mano. Colores por columna para que de un vistazo se sepa
 * qué llenó el sistema (azul: cortado y total) y qué se llena a mano (verde:
 * tendidos; durazno: observaciones).
 *
 * Los índices de `CUT_SPREAD_STYLE` son las posiciones de `cellXfs` de abajo:
 * si se mueve uno, se mueven los dos.
 */
export const CUT_SPREAD_STYLE = {
  header: 1,
  date: 2,
  text: 3,
  border: 4,
  totalNumber: 5,
  title: 6,
  subtitle: 7,
  totalLabel: 8,
  cut: 9,
  spread: 10,
  rowTotal: 11,
  notes: 12,
} as const;

const NAVY = "FF17365D";
const BLUE = "FF1F4E78";

const alignCenter = `<alignment horizontal="center" vertical="center" wrapText="1"/>`;
const alignLeft = `<alignment vertical="center" wrapText="1"/>`;

/** Un número con miles (#,##0), con fondo y centrado. */
const filledNumber = (fill: number) =>
  `<xf numFmtId="3" fontId="0" fillId="${fill}" borderId="1" xfId="0" applyNumberFormat="1" applyFill="1" applyBorder="1" applyAlignment="1">${alignCenter}</xf>`;

export const CUT_SPREAD_STYLES_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<numFmts count="1"><numFmt numFmtId="164" formatCode="dd/mm/yyyy"/></numFmts>
<fonts count="5">
<font><sz val="11"/><color theme="1"/><name val="Calibri"/><family val="2"/><scheme val="minor"/></font>
<font><b/><sz val="16"/><color rgb="FFFFFFFF"/><name val="Calibri"/><family val="2"/></font>
<font><i/><sz val="11"/><color rgb="${BLUE}"/><name val="Calibri"/><family val="2"/></font>
<font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/><family val="2"/></font>
<font><b/><sz val="11"/><color rgb="${NAVY}"/><name val="Calibri"/><family val="2"/></font>
</fonts>
<fills count="8">
<fill><patternFill patternType="none"/></fill>
<fill><patternFill patternType="gray125"/></fill>
<fill><patternFill patternType="solid"><fgColor rgb="${NAVY}"/></patternFill></fill>
<fill><patternFill patternType="solid"><fgColor rgb="${BLUE}"/></patternFill></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FFD9EAF7"/></patternFill></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FFEBF1DE"/></patternFill></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FFB8CCE4"/></patternFill></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FFFDE9D9"/></patternFill></fill>
</fills>
<borders count="2">
<border><left/><right/><top/><bottom/><diagonal/></border>
<border><left style="thin"><color rgb="FFB7C9D6"/></left><right style="thin"><color rgb="FFB7C9D6"/></right><top style="thin"><color rgb="FFB7C9D6"/></top><bottom style="thin"><color rgb="FFB7C9D6"/></bottom><diagonal/></border>
</borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="13">
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
<xf numFmtId="0" fontId="3" fillId="3" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1">${alignCenter}</xf>
<xf numFmtId="164" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1" applyAlignment="1">${alignLeft}</xf>
<xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1">${alignLeft}</xf>
<xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1"/>
<xf numFmtId="3" fontId="4" fillId="4" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center"/></xf>
<xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
<xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1"><alignment horizontal="center"/></xf>
<xf numFmtId="0" fontId="3" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"/>
${filledNumber(4)}
${filledNumber(5)}
${filledNumber(6)}
<xf numFmtId="0" fontId="0" fillId="7" borderId="1" xfId="0" applyFill="1" applyBorder="1" applyAlignment="1">${alignLeft}</xf>
</cellXfs>
<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`;
