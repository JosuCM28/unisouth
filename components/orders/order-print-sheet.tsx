import type { OrderSheet } from "@/lib/orders/order-sheet";

/** La hoja de la orden en HTML, para imprimir desde la PC. */
export function OrderPrintSheet({ sheet }: { sheet: OrderSheet }) {
  return (
    <>
      <header className="flex items-start justify-between gap-4 border-b-2 border-black pb-4">
        <div>
          <h1 className="text-xl font-bold">UNISOUTH</h1>
          <p className="text-sm">Orden de corte</p>
        </div>
        <div className="text-right">
          <p className="tabular text-lg font-bold">{sheet.code}</p>
          <p className="tabular text-sm">{sheet.orderedAt}</p>
          <p className="text-xs uppercase">{sheet.status}</p>
        </div>
      </header>

      <dl className="grid grid-cols-2 gap-x-6 gap-y-1 border-b border-black py-3 text-sm">
        {sheet.header.map((field) => (
          <div key={field.label} className="flex gap-2">
            <dt className="font-medium">{field.label}:</dt>
            <dd>{field.value}</dd>
          </div>
        ))}
      </dl>

      {sheet.cutNotes.length > 0 && <CutNotes notes={sheet.cutNotes} />}
      <SizesTable sheet={sheet} />
      {sheet.history.length > 0 && <HistoryTable sheet={sheet} />}

      {sheet.notes && (
        <p className="mt-4 whitespace-pre-wrap border-t border-black pt-2 text-sm">
          {sheet.notes}
        </p>
      )}

      <div className="mt-12 grid grid-cols-2 gap-8 text-sm">
        <Signature label="Entrega" />
        <Signature label="Recibe" />
      </div>
    </>
  );
}

/* Numeradas, para irlas palomeando en el taller. */
function CutNotes({ notes }: { notes: string[] }) {
  return (
    <section className="border-b border-black py-3 text-sm">
      <p className="font-semibold">Notas del corte</p>
      <ol className="mt-1 flex flex-col gap-0.5">
        {notes.map((note, index) => (
          <li key={index} className="flex gap-2">
            <span className="tabular shrink-0">{index + 1}.</span>
            <span>{note}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}

function SizesTable({ sheet }: { sheet: OrderSheet }) {
  return (
    <table className="mt-4 w-full border-collapse text-sm">
      <thead>
        <tr className="border-b-2 border-black text-left">
          <th className="py-1 pr-2">Talla</th>
          <th className="py-1 pr-2">Folio</th>
          <th className="py-1 pr-2 text-right">Pedidas</th>
          <th className="py-1 pr-2 text-right">Cortadas</th>
          <th className="py-1 pr-2 text-right">Faltan</th>
          <th className="py-1 pr-2 text-right">Sobran</th>
          <th className="py-1">Anotaciones</th>
        </tr>
      </thead>
      <tbody>
        {sheet.lines.map((line) => (
          <tr key={line.id} className="border-b border-black/30">
            <td className="py-1 pr-2 font-medium">{line.sizeCode}</td>
            <td className="py-1 pr-2">{line.tagName}</td>
            <td className="tabular py-1 pr-2 text-right">{line.ordered}</td>
            <td className="tabular py-1 pr-2 text-right">{line.cut}</td>
            <td className="tabular py-1 pr-2 text-right">{line.pending}</td>
            <td className="tabular py-1 pr-2 text-right font-medium">
              {line.surplus}
            </td>
            {/* `whitespace-pre-wrap` respeta los renglones tal como se
                escribieron: una nota de dos líneas aplastada en una deja de
                leerse como dos instrucciones. */}
            <td className="whitespace-pre-wrap py-1">{line.notes}</td>
          </tr>
        ))}
      </tbody>
      <tfoot>
        <tr className="border-t-2 border-black font-bold">
          <td className="py-1 pr-2" colSpan={2}>
            Total
          </td>
          <td className="tabular py-1 pr-2 text-right">{sheet.totals.ordered}</td>
          <td className="tabular py-1 pr-2 text-right">{sheet.totals.cut}</td>
          <td className="tabular py-1 pr-2 text-right">{sheet.totals.pending}</td>
          <td className="tabular py-1 pr-2 text-right">{sheet.totals.surplus}</td>
          {/* La celda tiene que existir: sin ella el borde superior no llega
              hasta el final de la tabla. */}
          <td className="py-1" />
        </tr>
      </tfoot>
    </table>
  );
}

function HistoryTable({ sheet }: { sheet: OrderSheet }) {
  return (
    <section className="mt-6">
      <h2 className="mb-1 border-b border-black pb-1 text-sm font-bold">
        Historial de cortes
      </h2>
      <table className="w-full border-collapse text-xs">
        <thead>
          <tr className="border-b border-black text-left">
            <th className="py-1 pr-2">Fecha</th>
            <th className="py-1 pr-2">Corte</th>
            <th className="py-1 pr-2">Talla</th>
            <th className="py-1 pr-2 text-right">Bultos</th>
            <th className="py-1 pr-2 text-right">Piezas</th>
            <th className="py-1 pr-2">Quién</th>
            <th className="py-1">Notas</th>
          </tr>
        </thead>
        <tbody>
          {sheet.history.map((entry) => (
            <tr key={entry.id} className="border-b border-black/20">
              <td className="tabular py-1 pr-2">{entry.at}</td>
              <td className="py-1 pr-2">{entry.batch}</td>
              <td className="py-1 pr-2">{entry.sizeCode}</td>
              <td className="tabular py-1 pr-2 text-right">{entry.bundles}</td>
              <td className="tabular py-1 pr-2 text-right">{entry.pieces}</td>
              <td className="py-1 pr-2">{entry.userName}</td>
              <td className="py-1">{entry.notes}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function Signature({ label }: { label: string }) {
  return (
    <div>
      <div className="h-12 border-b border-black" />
      <p className="mt-1 text-center text-xs">{label}</p>
    </div>
  );
}
