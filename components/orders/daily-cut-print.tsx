import type {
  DailyCutDay,
  DailyCutReport,
  DailyCutTotals,
} from "@/lib/reports/daily-cut-calculations";
import { formatDate, formatQuantity } from "@/lib/utils";
import { Figure, Section } from "@/components/reports/print-parts";

const CELL = "border border-neutral-400 px-1.5 py-1";
const NUMBER_CELL = `${CELL} tabular text-right`;

/** Una celda de talla vacía va en blanco, no en cero: se lee más rápido qué SÍ se cortó. */
function sizeValue(pieces: number | undefined): string {
  return pieces ? formatQuantity(pieces) : "";
}

function TotalsRow({ label, totals, sizeCodes }: {
  label: string;
  totals: DailyCutTotals;
  sizeCodes: string[];
}) {
  return (
    <tr className="bg-neutral-100 font-bold">
      <td className={CELL} colSpan={3}>{label}</td>
      {sizeCodes.map((code) => (
        <td key={code} className={NUMBER_CELL}>{sizeValue(totals.sizes[code])}</td>
      ))}
      <td className={NUMBER_CELL}>{formatQuantity(totals.bundles)}</td>
      <td className={NUMBER_CELL}>{formatQuantity(totals.pieces)}</td>
    </tr>
  );
}

function DayTable({ day }: { day: DailyCutDay }) {
  return (
    <table className="w-full border-collapse text-xs">
      <thead>
        <tr className="bg-neutral-100 text-left">
          <th className={CELL}>Orden</th>
          <th className={CELL}>Empresa · prenda</th>
          <th className={CELL}>Capturó</th>
          {day.sizeCodes.map((code) => (
            <th key={code} className={`${CELL} text-right`}>{code}</th>
          ))}
          <th className={`${CELL} text-right`}>Bultos</th>
          <th className={`${CELL} text-right`}>Piezas</th>
        </tr>
      </thead>
      <tbody>
        {day.rows.map((row) => (
          <tr key={row.id}>
            <td className={`${CELL} tabular whitespace-nowrap`}>
              <span className="font-bold">{row.orderCode}</span>
              <span className="block text-[10px]">{row.cutName}</span>
            </td>
            <td className={CELL}>{row.clientName} · {row.description}</td>
            <td className={CELL}>{row.capturedBy}</td>
            {day.sizeCodes.map((code) => (
              <td key={code} className={NUMBER_CELL}>{sizeValue(row.sizes[code])}</td>
            ))}
            <td className={NUMBER_CELL}>{formatQuantity(row.bundles)}</td>
            <td className={`${NUMBER_CELL} font-bold`}>{formatQuantity(row.pieces)}</td>
          </tr>
        ))}
        <TotalsRow label="Total del día" totals={day} sizeCodes={day.sizeCodes} />
      </tbody>
    </table>
  );
}

/** Lo cortado en papel: una rejilla por día con una columna por talla. */
export function DailyCutPrint({ report }: { report: DailyCutReport }) {
  const { days, totals } = report;

  return (
    <article className="bg-white p-4 text-black sm:p-8 print:p-6">
      <header className="border-b-2 border-black pb-3">
        <p className="text-xs uppercase tracking-wide">UNISOUTH · Lo cortado</p>
        <h1 className="mt-1 text-2xl font-bold leading-none first-letter:uppercase">
          {report.label}
        </h1>
      </header>

      <section className="mt-4 grid grid-cols-3 gap-3">
        <Figure label="Piezas cortadas" value={formatQuantity(totals.pieces)} />
        <Figure label="Bultos" value={formatQuantity(totals.bundles)} />
        <Figure label="Órdenes" value={String(totals.orders)} />
      </section>

      {days.length === 0 && (
        <p className="mt-6 text-sm text-neutral-600">No se capturó corte en estas fechas.</p>
      )}

      {days.map((day) => (
        <Section key={day.key} title={day.label}>
          <DayTable day={day} />
        </Section>
      ))}

      {/* Con un solo día el total del día YA es el total: repetirlo estorba. */}
      {days.length > 1 && (
        <Section title="Total de las fechas">
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr className="bg-neutral-100">
                {totals.sizeCodes.map((code) => (
                  <th key={code} className={`${CELL} text-right`}>{code}</th>
                ))}
                <th className={`${CELL} text-right`}>Bultos</th>
                <th className={`${CELL} text-right`}>Piezas</th>
              </tr>
            </thead>
            <tbody>
              <tr className="font-bold">
                {totals.sizeCodes.map((code) => (
                  <td key={code} className={NUMBER_CELL}>{sizeValue(totals.sizes[code])}</td>
                ))}
                <td className={NUMBER_CELL}>{formatQuantity(totals.bundles)}</td>
                <td className={NUMBER_CELL}>{formatQuantity(totals.pieces)}</td>
              </tr>
            </tbody>
          </table>
        </Section>
      )}

      <footer className="mt-6 border-t border-neutral-400 pt-2 text-xs">
        Cuenta cada bulto el día en que se capturó. Impreso el {formatDate(new Date())}
      </footer>
    </article>
  );
}
