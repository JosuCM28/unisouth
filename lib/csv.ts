/**
 * Generación de CSV para abrir en Excel.
 *
 * Se hace a mano y no con una librería: exportar una lista tabular no
 * justifica una dependencia, y `xlsx` de npm arrastra vulnerabilidades sin
 * parchar. Excel abre un CSV con doble clic.
 */

export interface CsvColumn<T> {
  header: string;
  value: (row: T) => string | number | null | undefined;
}

/**
 * Escapa una celda según RFC 4180.
 *
 * Sin esto, un material llamado 'Mezclilla 60", azul' rompería las columnas
 * del archivo entero.
 */
function escapeCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";

  const text = String(value);
  if (!/[",;\n\r]/.test(text)) return text;

  return `"${text.replace(/"/g, '""')}"`;
}

export function toCsv<T>(rows: T[], columns: CsvColumn<T>[]): string {
  const header = columns.map((column) => escapeCell(column.header)).join(",");
  const body = rows.map((row) =>
    columns.map((column) => escapeCell(column.value(row))).join(","),
  );

  // BOM UTF-8: sin él, Excel en Windows abre los acentos como "MezclÃ­lla".
  // CRLF porque es lo que Excel espera.
  return `﻿${[header, ...body].join("\r\n")}\r\n`;
}

/** Respuesta de descarga con el nombre y la fecha del día. */
export function csvResponse(csv: string, filename: string): Response {
  const stamp = new Date().toISOString().slice(0, 10);

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}-${stamp}.csv"`,
    },
  });
}
