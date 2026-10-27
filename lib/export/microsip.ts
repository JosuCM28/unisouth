import { UNIT_LABELS } from "@/lib/constants/labels";
import type { MaterialStockRow } from "@/lib/repositories/lot.repository";
import { todayInputValue } from "@/lib/utils";
import type { PlainCell } from "./xlsx-plain";

/**
 * Los dos archivos que se cargan a Microsip.
 *
 * Primero el catálogo de artículos, porque la importación de una entrada NO
 * crea artículos: una clave que Microsip no conoce se brinca sin avisar. Luego
 * las existencias, como entrada con concepto SALDO INICIAL en el almacén que
 * corresponda.
 *
 * La clave es el código del material tal cual: así, cuando el mismo material
 * vuelva a cargarse, cae sobre el mismo artículo en vez de duplicarlo.
 */

/**
 * Existencias: Clave · Unidades · Costo, SIN encabezado.
 *
 * Es el formato de "Importar artículos desde un archivo" dentro de una
 * entrada. Microsip toma la fila 1 como dato, así que un renglón de títulos
 * entraría como un artículo de clave "Clave".
 *
 * El costo va en 0 porque la tela es del cliente, no de la fábrica: con costo
 * entraría a la valuación del inventario como si fuera un activo propio.
 */
export function microsipStockRows(rows: MaterialStockRow[]): PlainCell[][] {
  return rows.map((row) => [row.materialCode, roundQuantity(row.quantity), 0]);
}

/**
 * Catálogo: Clave · Nombre · Unidad, SIN encabezado.
 *
 * El orden tiene que ser el mismo del formato que se configura en
 * Administración → Empresas → Herramientas → Formatos para importar/exportar.
 * La unidad va en mayúsculas porque así se capturan en Microsip.
 */
export function microsipArticleRows(rows: MaterialStockRow[]): string[][] {
  return rows.map((row) => [
    row.materialCode,
    row.materialName,
    UNIT_LABELS[row.unit].toUpperCase(),
  ]);
}

/**
 * Materiales con rollos en más de una unidad.
 *
 * Un artículo de Microsip tiene UNA unidad. Si el mismo material trae rollos
 * en metros y en kilos, mandar dos renglones con la misma clave haría que
 * Microsip los acumulara —sumando metros con kilos— o se quedara con uno.
 * Antes que entregar un número falso, el archivo no se genera.
 */
export function materialsWithMixedUnits(rows: MaterialStockRow[]): string[] {
  const seen = new Set<string>();
  const mixed = new Set<string>();

  for (const row of rows) {
    if (seen.has(row.materialCode)) mixed.add(row.materialCode);
    seen.add(row.materialCode);
  }

  return [...mixed];
}

export function mixedUnitsResponse(codes: string[]): Response {
  return new Response(
    `No se generó el archivo para Microsip: estos materiales tienen rollos en más de una unidad y un artículo de Microsip sólo maneja una.\n\n${codes.join("\n")}\n\nCorrige la unidad de esos rollos o filtra para dejarlos fuera.`,
    { status: 409, headers: { "Content-Type": "text/plain; charset=utf-8" } },
  );
}

/**
 * Texto delimitado por tabuladores, en ANSI y con fin de línea de Windows.
 *
 * Es lo que pide el importador de catálogos de Microsip. En UTF-8 la Ñ y los
 * acentos llegarían como "Ã‘", así que se codifica en Latin-1, que para estas
 * letras coincide con el ANSI de Windows.
 */
export function toAnsiTsv(rows: string[][]): Buffer {
  const text = rows
    .map((row) => row.map(cleanField).join("\t"))
    .join("\r\n");

  return Buffer.from(`${text}\r\n`, "latin1");
}

export function ansiTextResponse(file: Buffer, filename: string): Response {
  return new Response(new Uint8Array(file), {
    headers: {
      "Content-Type": "text/plain; charset=windows-1252",
      "Content-Disposition": `attachment; filename="${filename}-${todayInputValue()}.txt"`,
      "Content-Length": String(file.length),
    },
  });
}

/**
 * Un campo listo para ir entre tabuladores.
 *
 * Un tabulador o salto de línea dentro del nombre partiría el renglón y
 * correría todas las columnas. Lo que no existe en ANSI se le quitan los
 * acentos raros o se descarta, en vez de llegar como signo de interrogación.
 */
function cleanField(value: string): string {
  return [...value.replace(/[\t\r\n]+/g, " ").trim()]
    .map((char) => {
      if (char.charCodeAt(0) <= 0xff) return char;
      return char.normalize("NFKD").replace(/[^\x20-\xff]/g, "");
    })
    .join("");
}

/** Cuatro decimales, los de la base: evita colas como 12.300000000001. */
function roundQuantity(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}
