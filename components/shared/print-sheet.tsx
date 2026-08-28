import type { ReactNode } from "react";
import { formatDateTime } from "@/lib/utils";
import { PrintButton } from "@/components/shared/print-button";

interface PrintSheetProps {
  title: string;
  /** Qué filtro produjo esta hoja. Se imprime: sin eso la hoja miente. */
  criteria?: string[];
  /** Cuántos renglones trae, dicho en el encabezado. */
  count?: string;
  children: ReactNode;
}

/**
 * El armazón de una hoja de listado imprimible.
 *
 * De aquí sale el PDF: el navegador imprime la hoja y ofrece "Guardar como
 * PDF", que es el archivo que se manda por correo o WhatsApp. No se genera en
 * el servidor a propósito —una librería de PDF pesa más que el problema que
 * resuelve— y así la hoja se ve igual en pantalla que en papel.
 *
 * El bloque de CRITERIOS no es decorativo. Una hoja impresa se separa de la
 * pantalla que la produjo: alguien la deja en un escritorio y al día siguiente
 * nadie sabe si es el inventario completo o el de un cliente. Impreso el
 * filtro, la hoja se explica sola.
 */
export function PrintSheet({ title, criteria, count, children }: PrintSheetProps) {
  return (
    <main className="mx-auto w-full max-w-5xl">
      <div className="p-4 print:hidden">
        <PrintButton />
      </div>

      <article className="bg-white p-4 text-black sm:p-8 print:p-8">
        <header className="border-b-2 border-black pb-3">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-wide">UNISOUTH · Almacén</p>
              <h1 className="mt-1 text-2xl font-bold leading-none">{title}</h1>
            </div>
            <div className="text-right text-xs">
              {/* La hora del tiraje: un listado de inventario envejece en
                  horas, y sin fecha nadie sabe si sigue vigente. */}
              <p className="tabular">{formatDateTime(new Date())}</p>
              {count && <p className="tabular mt-1 font-semibold">{count}</p>}
            </div>
          </div>

          {criteria && criteria.length > 0 && (
            <p className="mt-2 text-xs">
              <span className="font-semibold">Filtro:</span> {criteria.join(" · ")}
            </p>
          )}
        </header>

        {children}
      </article>
    </main>
  );
}

/**
 * Tabla del listado impreso.
 *
 * Las cabeceras se repiten en cada página con `<thead>`: un listado de 200
 * rollos ocupa cinco hojas, y sin esto de la segunda en adelante son columnas
 * de números sin nombre.
 */
export function PrintTable({
  head,
  rows,
  empty,
  numeric,
}: {
  head: string[];
  rows: (string | number)[][];
  empty: string;
  /** Índices de columna que van alineados a la derecha por ser cifras. */
  numeric?: number[];
}) {
  if (rows.length === 0) {
    return <p className="mt-4 text-sm">{empty}</p>;
  }

  const isNumeric = (index: number) => numeric?.includes(index) ?? false;

  return (
    <table className="mt-4 w-full border-collapse text-xs">
      <thead className="table-header-group">
        <tr className="border-b-2 border-black text-left">
          {head.map((label, index) => (
            <th
              key={label}
              className={`py-1 pr-2 ${isNumeric(index) ? "text-right" : ""}`}
            >
              {label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, rowIndex) => (
          <tr
            key={rowIndex}
            // `break-inside-avoid` evita que un renglón se parta a la mitad
            // entre dos hojas, que es ilegible justo en la cifra.
            className="break-inside-avoid border-b border-neutral-300"
          >
            {row.map((cell, index) => (
              <td
                key={index}
                className={`py-1 pr-2 align-top ${isNumeric(index) ? "tabular text-right" : ""}`}
              >
                {cell}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
