import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { requirePermission } from "@/lib/core/session";
import { VoucherRepository } from "@/lib/repositories/voucher.repository";
import {
  toVoucherSheet,
  type VoucherField,
  type VoucherSheet,
} from "@/lib/vouchers/voucher-sheet";
import { PrintButton } from "@/components/shared/print-button";
import { FitToPage } from "@/components/shared/fit-to-page";

interface PageProps {
  params: Promise<{ id: string }>;
}

export const metadata: Metadata = { title: "Vale" };

/**
 * Vale imprimible, para firma física.
 *
 * Vive fuera de (dashboard) a propósito: sin sidebar ni barra móvil, para que
 * la hoja salga limpia. El auxiliar lo imprime, lo firma quien entrega y quien
 * recibe, y se archiva.
 *
 * La hoja se arma para caber en UNA página: el taller trabaja con una sola
 * plantilla clavada en la mesa de corte, y un desglose partido en dos hojas se
 * separa el primer día. Por eso la tipografía es compacta, el encabezado va en
 * rejilla y no en renglones sueltos, y los bloques que no traen dato no se
 * imprimen en vez de dejar el hueco.
 *
 * QUÉ dice la hoja lo decide `toVoucherSheet`, el mismo que arma el PDF de
 * WhatsApp: aquí sólo se dibuja.
 */
export default async function PrintDocumentPage({ params }: PageProps) {
  await requirePermission("inventory:browse");
  const { id } = await params;

  const document = await new VoucherRepository().findSheetDocument(id);
  if (!document) notFound();

  const sheet = toVoucherSheet(document);

  return (
    <main
      id="vale"
      className="print-sheet mx-auto max-w-3xl bg-white p-8 text-[13px] leading-snug text-black print:p-0"
    >
      <PrintButton />
      {/* Mide la hoja y la encoge lo justo para que quepa en una página. */}
      <FitToPage targetId="vale" />

      <header className="flex items-start justify-between gap-4 border-b-2 border-black pb-2">
        <div>
          <p className="text-xs">UNISOUTH</p>
          {/* El tipo es lo que se lee primero al recibir el bulto: quien lo
              toma necesita saber QUÉ le llegó antes que de dónde. */}
          <h1 className="text-2xl font-bold">{sheet.title}</h1>
        </div>
        <div className="text-right">
          <p className="tabular text-base font-bold">{sheet.code}</p>
          <p className="text-[10px] uppercase">{sheet.status}</p>
        </div>
      </header>

      {/* Rejilla de dos columnas: los mismos datos en renglones sueltos se
          comían un tercio de la hoja y empujaban la tabla a la segunda. */}
      {sheet.header.length > 0 && (
        <dl className="mt-2 grid grid-cols-2 gap-x-6 gap-y-0.5 border border-black p-2">
          <Fields fields={sheet.header} />
        </dl>
      )}

      {sheet.cutRows.length > 0 && <CutTable sheet={sheet} />}

      {/* Numeradas y no en un párrafo: en el taller se van palomeando una por
          una y se citan por número ("la 2 no aplica a la talla G"). */}
      {sheet.cutNotes.length > 0 && (
        <section className="mt-2 border border-black p-2">
          <h2 className="text-[11px] font-bold uppercase">Notas</h2>
          <ol className="mt-0.5">
            {sheet.cutNotes.map((note, index) => (
              <li key={index} className="flex gap-2">
                <span className="tabular shrink-0 font-medium">
                  Nota {index + 1}.
                </span>
                <span>{note}</span>
              </li>
            ))}
          </ol>
        </section>
      )}

      {sheet.rollRows.length > 0 && <RollTable sheet={sheet} />}

      <dl className="mt-2 grid grid-cols-2 gap-x-6 gap-y-0.5 border-t border-black pt-1 text-xs">
        <Fields fields={sheet.footer} />
      </dl>

      {sheet.notes && (
        <p className="mt-2 border border-neutral-400 p-2 text-xs">
          {sheet.notes}
        </p>
      )}

      {/* Las firmas son el punto de todo esto: el vale existe para que quede
          constancia en papel de quién entregó y quién recibió.
          `print-signatures` evita la hoja que sólo lleva las dos rayas. */}
      <div className="print-signatures mt-10 grid grid-cols-2 gap-8 text-center text-xs">
        <Signature label="Entrega" name={sheet.handedOverBy} />
        <Signature label="Recibe" name={sheet.receivedBy} />
      </div>
    </main>
  );
}

/** Tallas: lo que se va a cortar, con su suma y el total que se coteja. */
function CutTable({ sheet }: { sheet: VoucherSheet }) {
  const cell = "border border-black px-2 py-0.5";

  return (
    <section className="mt-2">
      <table className="w-full border-collapse">
        <thead>
          <tr className="bg-neutral-200 text-left">
            <th className={cell}>Talla</th>
            <th className={`${cell} text-right`}>Cantidad</th>
            <th className={`${cell} text-right`}>Bultos</th>
            <th className={`${cell} text-right`}>Total</th>
            <th className={cell}>Foleo</th>
            <th className={cell}>Anotaciones</th>
          </tr>
        </thead>
        <tbody>
          {sheet.cutRows.map((row) => (
            <tr key={row.id}>
              <td className={`tabular ${cell} font-medium`}>{row.sizeCode}</td>
              <td className={`tabular ${cell} text-right`}>{row.quantity}</td>
              <td className={`tabular ${cell} text-right`}>{row.bundles}</td>
              <td className={`tabular ${cell} text-right font-bold`}>
                {row.total}
              </td>
              {/* La celda se pinta del color del papelito: así la hoja se
                  coteja de un vistazo con el bulto. */}
              <td
                className={`${cell} text-center`}
                style={
                  row.tag
                    ? {
                        backgroundColor: row.tag.background,
                        color: row.tag.text,
                        // Sin esto el navegador descarta los fondos al
                        // imprimir y el foleo sale en blanco.
                        printColorAdjust: "exact",
                        WebkitPrintColorAdjust: "exact",
                      }
                    : undefined
                }
              >
                {row.tag?.name ?? "—"}
              </td>
              <td className={cell}>{row.notes ?? ""}</td>
            </tr>
          ))}
        </tbody>
        {/* La suma de lo capturado y el total real de prendas: en el taller
            se coteja primero la columna tecleada y luego lo multiplicado. */}
        <tfoot>
          <tr className="bg-neutral-100 font-bold">
            <td className={cell}>SUMA</td>
            <td className={`tabular ${cell} text-right`}>
              {sheet.cutTotals.perBundle}
            </td>
            <td className={`tabular ${cell} text-right`}>
              {sheet.cutTotals.bundles}
            </td>
            <td className={`tabular ${cell} text-right text-sm`}>
              {sheet.cutTotals.pieces}
            </td>
            <td className="border border-black" colSpan={2} />
          </tr>
        </tfoot>
      </table>

      {/* Fuera de la tabla y grande: es lo que se verifica contra los bultos
          físicos antes de firmar. */}
      <p className="tabular mt-1 text-right text-base font-bold">
        Total de cortes entregados: {sheet.cutTotals.pieces}
      </p>
    </section>
  );
}

/** Rollos que salieron y con cuántos metros cada uno. */
function RollTable({ sheet }: { sheet: VoucherSheet }) {
  return (
    <section className="mt-3">
      <h2 className="text-[11px] font-bold uppercase">Rollos entregados</h2>
      <table className="mt-0.5 w-full border-collapse">
        <thead>
          <tr className="border-b-2 border-black text-left">
            {/* La casilla va primero: se palomea con el dedo mientras se
                cargan los rollos. */}
            <th className="w-8 py-0.5 pr-2 text-center">✓</th>
            <th className="py-0.5 pr-2">Folio</th>
            <th className="py-0.5 pr-2">Material</th>
            <th className="py-0.5 pr-2">Tono</th>
            <th className="py-0.5 text-right">Cantidad</th>
          </tr>
        </thead>
        <tbody>
          {sheet.rollRows.map((row) => (
            <tr key={row.id} className="border-b border-neutral-300">
              <td className="py-0.5 pr-2 text-center">
                <span className="inline-block size-3.5 border border-black align-middle" />
              </td>
              <td className="tabular py-0.5 pr-2">{row.code}</td>
              <td className="py-0.5 pr-2">{row.material}</td>
              <td className="tabular py-0.5 pr-2">{row.shade ?? "—"}</td>
              <td className="tabular py-0.5 text-right">{row.quantity}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {sheet.rollSummary && (
        <p className="tabular mt-1 text-right font-bold">{sheet.rollSummary}</p>
      )}
    </section>
  );
}

function Fields({ fields }: { fields: VoucherField[] }) {
  return fields.map((field) => (
    <div key={field.label} className="flex gap-2">
      <dt className="font-medium">{field.label}:</dt>
      <dd>{field.value}</dd>
    </div>
  ));
}

function Signature({ label, name }: { label: string; name: string | null }) {
  return (
    <div>
      <div className="border-b border-black" />
      <p className="mt-1 font-medium">{label}</p>
      {/* Con el nombre capturado se imprime; si no, se deja el renglón en
          blanco para que lo escriba a mano quien recibe. */}
      {name ? (
        <p className="text-[10px]">{name}</p>
      ) : (
        <>
          <div className="mt-5 border-b border-black" />
          <p className="mt-1 text-[10px]">Nombre</p>
        </>
      )}
    </div>
  );
}
