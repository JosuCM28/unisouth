/**
 * Generación de CSV para abrir en Excel.
 *
 * Se hace a mano y no con una librería: exportar una lista tabular no
 * justifica una dependencia, y `xlsx` de npm arrastra vulnerabilidades sin
 * parchar. Excel abre un CSV con doble clic.
 */

import { todayInputValue } from "@/lib/utils";

export interface CsvColumn<T> {
  header: string;
  value: (row: T) => string | number | null | undefined;
}

/**
 * Con qué caracteres Excel decide que una celda es una FÓRMULA.
 *
 * El `@` entra porque Excel lo expande a funciones heredadas, y el tabulador
 * y el retorno porque Excel los recorta antes de decidir: `\t=cmd` acaba
 * siendo tan peligroso como `=cmd`.
 */
const FORMULA_PREFIX = /^[=+\-@\t\r]/;

/**
 * Neutraliza una celda que Excel ejecutaría como fórmula.
 *
 * Alguien puede dar de alta un material llamado `=cmd|'/c calc'!A1`, y al
 * abrir el CSV exportado Excel lo EJECUTA en la máquina de quien lo abre. El
 * ataque no entra por la app: entra por un campo cualquiera del catálogo y
 * detona en la computadora de quien recibe el archivo.
 *
 * El apóstrofo es la forma que Excel entiende como "esto es texto literal", y
 * no se ve al abrir el archivo.
 */
function neutralizeFormula(text: string): string {
  return FORMULA_PREFIX.test(text) ? `'${text}` : text;
}

/**
 * Escapa una celda según RFC 4180.
 *
 * Sin esto, un material llamado 'Mezclilla 60", azul' rompería las columnas
 * del archivo entero.
 */
function escapeCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";

  // Los números salen tal cual: no pueden ser fórmula, y anteponerles un
  // apóstrofo los volvería texto y Excel ya no los sumaría.
  if (typeof value === "number") return String(value);

  const text = neutralizeFormula(String(value));
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
  // El día EN LA FÁBRICA: con toISOString, un archivo bajado a las 7 de la
  // noche salía con la fecha de mañana en el nombre.
  const stamp = todayInputValue();

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}-${stamp}.csv"`,
    },
  });
}
