export function Figure({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-black p-2">
      <p className="text-xs">{label}</p>
      <p className="tabular mt-1 text-xl font-bold leading-none">{value}</p>
    </div>
  );
}

export function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-5">
      <h2 className="border-b border-black pb-1 text-sm font-bold uppercase">
        {title}
      </h2>
      <div className="mt-2">{children}</div>
    </section>
  );
}

/**
 * Tabla del reporte impreso.
 *
 * Las columnas de cifras van alineadas a la derecha porque se comparan en
 * vertical. Por omisión es sólo la última; `numericFrom` dice desde cuál.
 */
export function Table({
  head,
  rows,
  empty,
  numericFrom,
}: {
  head: string[];
  rows: string[][];
  empty: string;
  numericFrom?: number;
}) {
  if (rows.length === 0) {
    return <p className="text-sm text-neutral-600">{empty}</p>;
  }

  const firstNumeric = numericFrom ?? head.length - 1;

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-neutral-400 text-left">
          {head.map((label, index) => (
            <th
              key={label}
              className={index >= firstNumeric ? "py-1 pl-2 text-right" : "py-1 pr-4"}
            >
              {label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((cells) => (
          <tr key={cells.join("|")} className="border-b border-neutral-200">
            {cells.map((cell, index) => (
              <td
                key={index}
                className={
                  index >= firstNumeric
                    ? "tabular py-1 pl-2 text-right"
                    : "py-1 pr-4"
                }
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
