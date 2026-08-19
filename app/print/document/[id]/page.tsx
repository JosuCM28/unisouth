import { notFound } from "next/navigation";
import type { Metadata } from "next";
import type { CutTag } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/core/session";
import {
  CUT_TAG_COLORS,
  CUT_TAG_LABELS,
  CUT_VERSION_LABELS,
  DOCUMENT_STATUS_LABELS,
  DOCUMENT_TYPE_LABELS,
  UNIT_SHORT_LABELS,
} from "@/lib/constants/labels";
import { contrastText, formatDate, formatQuantity } from "@/lib/utils";
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
 */
export default async function PrintDocumentPage({ params }: PageProps) {
  await requirePermission("inventory:read");
  const { id } = await params;

  const document = await prisma.inventoryDocument.findUnique({
    where: { id },
    include: {
      createdBy: { select: { name: true } },
      appliedBy: { select: { name: true } },
      productionRun: { select: { code: true, name: true } },
      // La empresa dueña se lee del vale, no de los rollos: una salida de
      // puros cortes no lleva rollos de los que deducirla.
      client: { select: { name: true } },
      cutFabric: { select: { name: true } },
      cutLines: {
        orderBy: { order: "asc" },
        include: {
          size: { select: { code: true, name: true } },
          cutTag: { select: { name: true, color: true } },
        },
      },
      lines: {
        orderBy: { order: "asc" },
        include: {
          lot: {
            include: {
              material: { select: { code: true, name: true } },
              location: { select: { code: true } },
              client: { select: { name: true } },
            },
          },
        },
      },
    },
  });

  if (!document) notFound();

  /* Empresa y tela salen de los campos PROPIOS del vale; los rollos son el
     respaldo para los vales viejos, capturados antes de que el encabezado
     existiera. Si se dedujeran sólo de los rollos, una salida sin rollos
     —prendas ya cortadas— imprimiría esos renglones en blanco justo en la
     hoja que firma el taller. */
  const companyName =
    document.client?.name ??
    orNull(unique(document.lines.map((line) => line.lot.client?.name)).join(", "));

  const fabricName =
    document.cutFabric?.name ??
    document.cutFabricText ??
    orNull(unique(document.lines.map((line) => line.lot.material.name)).join(", "));

  /* El total de un renglón es cantidad a cortar POR bultos: si de la talla 38
     van 64 cortes en cada uno de 2 bultos, salen 128 prendas. La "cantidad"
     es por bulto, no del renglón completo; sumarla sin multiplicar entregaba
     la mitad de lo que de verdad sale por la puerta. */
  const cutTotals = document.cutLines.reduce(
    (acc, line) => ({
      perBundle: acc.perBundle + line.quantity,
      bundles: acc.bundles + line.bundles,
      pieces: acc.pieces + line.quantity * line.bundles,
    }),
    { perBundle: 0, bundles: 0, pieces: 0 },
  );

  /* El encabezado se imprime si trae ALGO propio o si hay tallas que encabezar.
     Un vale de puros rollos no necesita esta caja, y dejarla vacía sólo gasta
     el espacio que le hace falta a la tabla para caber en la hoja. */
  const hasCutHeader =
    document.cutLines.length > 0 ||
    Boolean(
      document.cutDescription ||
        document.cutPattern ||
        document.cutVersion ||
        fabricName,
    );

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
          <h1 className="text-lg font-bold">UNISOUTH</h1>
          <p className="text-xs">{DOCUMENT_TYPE_LABELS[document.type]}</p>
        </div>
        <div className="text-right">
          <p className="tabular text-base font-bold">{document.code}</p>
          <p className="tabular text-xs">{formatDate(document.date)}</p>
          <p className="text-[10px] uppercase">
            {DOCUMENT_STATUS_LABELS[document.status]}
          </p>
        </div>
      </header>

      {/* ── Encabezado del desglose de corte ──
          Va en rejilla de dos columnas: los mismos ocho datos en renglones
          sueltos se comían un tercio de la hoja y empujaban la tabla a la
          segunda página. */}
      {hasCutHeader && (
        <dl className="mt-2 grid grid-cols-2 gap-x-6 gap-y-0.5 border border-black p-2">
          {companyName && <Row label="Empresa" value={companyName} />}
          {document.cutDescription && (
            <Row label="Descripción" value={document.cutDescription} />
          )}
          <Row label="Fecha" value={formatDate(document.date)} />
          {document.reference && (
            <Row label="Orden" value={document.reference} />
          )}
          {fabricName && <Row label="Tela" value={fabricName} />}
          {document.cutPattern && (
            <Row label="Molde" value={document.cutPattern} />
          )}
          {document.cutVersion && (
            <Row
              label="Versión"
              value={CUT_VERSION_LABELS[document.cutVersion]}
            />
          )}
          {document.cutVersionNotes && (
            <Row label="De la versión" value={document.cutVersionNotes} />
          )}
        </dl>
      )}

      {/* ── Tallas: lo que se va a cortar ── */}
      {document.cutLines.length > 0 && (
        <section className="mt-2">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-neutral-200 text-left">
                <th className="border border-black px-2 py-0.5">Talla</th>
                <th className="border border-black px-2 py-0.5 text-right">
                  Cantidad
                </th>
                <th className="border border-black px-2 py-0.5 text-right">
                  Bultos
                </th>
                <th className="border border-black px-2 py-0.5 text-right">
                  Total
                </th>
                <th className="border border-black px-2 py-0.5">Foleo</th>
                <th className="border border-black px-2 py-0.5">Anotaciones</th>
              </tr>
            </thead>
            <tbody>
              {document.cutLines.map((line) => {
                /* Se lee del catálogo; el enum viejo queda de respaldo para
                   los vales capturados antes de que el catálogo existiera. */
                const tag = resolveTag(line.cutTag, line.tag);

                return (
                  <tr key={line.id}>
                    <td className="tabular border border-black px-2 py-0.5 font-medium">
                      {line.size.code}
                    </td>
                    <td className="tabular border border-black px-2 py-0.5 text-right">
                      {line.quantity}
                    </td>
                    <td className="tabular border border-black px-2 py-0.5 text-right">
                      {line.bundles}
                    </td>
                    <td className="tabular border border-black px-2 py-0.5 text-right font-bold">
                      {line.quantity * line.bundles}
                    </td>
                    {/* La celda se pinta del color del papelito: así la hoja
                        impresa se puede cotejar de un vistazo con el bulto. */}
                    <td
                      className="border border-black px-2 py-0.5 text-center"
                      style={
                        tag
                          ? {
                              backgroundColor: tag.color,
                              color: contrastText(tag.color),
                              // Sin esto el navegador descarta los fondos al
                              // imprimir y el foleo sale en blanco.
                              printColorAdjust: "exact",
                              WebkitPrintColorAdjust: "exact",
                            }
                          : undefined
                      }
                    >
                      {tag?.name ?? "—"}
                    </td>
                    <td className="border border-black px-2 py-0.5">
                      {line.notes ?? ""}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            {/* La suma de las cantidades capturadas, renglón por renglón, y el
                total real de prendas. Van juntas porque en el taller se coteja
                primero la columna que se tecleó y luego lo que de verdad sale
                multiplicado por los bultos. */}
            <tfoot>
              <tr className="bg-neutral-100 font-bold">
                <td className="border border-black px-2 py-0.5">SUMA</td>
                <td className="tabular border border-black px-2 py-0.5 text-right">
                  {cutTotals.perBundle}
                </td>
                <td className="tabular border border-black px-2 py-0.5 text-right">
                  {cutTotals.bundles}
                </td>
                <td className="tabular border border-black px-2 py-0.5 text-right text-sm">
                  {cutTotals.pieces}
                </td>
                <td className="border border-black" colSpan={2} />
              </tr>
            </tfoot>
          </table>

          {/* El dato que se coteja al recibir: cuántos cortes entregó el
              almacén en total. Va fuera de la tabla y grande porque es lo que
              se verifica contra los bultos físicos antes de firmar. */}
          <p className="tabular mt-1 text-right text-base font-bold">
            Total de cortes entregados: {cutTotals.pieces}
          </p>
        </section>
      )}

      {/* ── Notas del corte, numeradas ──
          Numeradas y no en un párrafo: en el taller se van palomeando una por
          una y se citan por número ("la 2 no aplica a la talla G"). */}
      {document.cutNotes.length > 0 && (
        <section className="mt-2 border border-black p-2">
          <h2 className="text-[11px] font-bold uppercase">Notas</h2>
          <ol className="mt-0.5">
            {document.cutNotes.map((note, index) => (
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

      {/* ── Rollos que salieron y con cuántos metros cada uno ──
          Se omite por completo si el vale sólo lleva desglose de cortes: una
          tabla con encabezados y nada debajo hace dudar de si falta imprimir
          algo. Y al revés: un vale de puros rollos imprime sólo esta parte. */}
      {document.lines.length > 0 && (
        <section className="mt-3">
          <h2 className="text-[11px] font-bold uppercase">
            Rollos entregados
          </h2>
          <table className="mt-0.5 w-full border-collapse">
            <thead>
              <tr className="border-b-2 border-black text-left">
                {/* La casilla va primero: se palomea con el dedo mientras se
                    cargan los rollos, y en el margen izquierdo cae natural. */}
                <th className="w-8 py-0.5 pr-2 text-center">✓</th>
                <th className="py-0.5 pr-2">Folio</th>
                <th className="py-0.5 pr-2">Material</th>
                <th className="py-0.5 pr-2">Tono</th>
                <th className="py-0.5 text-right">Cantidad</th>
              </tr>
            </thead>
            <tbody>
              {document.lines.map((line) => (
                <tr key={line.id} className="border-b border-neutral-300">
                  <td className="py-0.5 pr-2 text-center">
                    <span className="inline-block size-3.5 border border-black align-middle" />
                  </td>
                  <td className="tabular py-0.5 pr-2">{line.lot.code}</td>
                  <td className="py-0.5 pr-2">{line.lot.material.name}</td>
                  <td className="tabular py-0.5 pr-2">
                    {line.lot.shade ?? "—"}
                  </td>
                  <td className="tabular py-0.5 text-right">
                    {formatQuantity(line.quantity, {
                      unit: UNIT_SHORT_LABELS[line.unit],
                    })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* El total de rollos Y de metros: en el andén se cuentan los bultos
              físicos, y el metraje es lo que se factura. */}
          <p className="tabular mt-1 text-right font-bold">
            {document.lines.length}{" "}
            {document.lines.length === 1 ? "rollo" : "rollos"} ·{" "}
            {formatQuantity(
              document.lines.reduce(
                (sum, line) => sum + Number(line.quantity),
                0,
              ),
            )}{" "}
            en total
          </p>
        </section>
      )}

      {/* El concepto y la producción bajan al pie: son contexto administrativo,
          no lo que se coteja con el material en la mano. */}
      <dl className="mt-2 grid grid-cols-2 gap-x-6 gap-y-0.5 border-t border-black pt-1 text-xs">
        {document.concept && <Row label="Concepto" value={document.concept} />}
        {document.productionRun && (
          <Row
            label="Producción"
            value={`${document.productionRun.code} · ${document.productionRun.name}`}
          />
        )}
        {document.createdBy && (
          <Row label="Elaboró" value={document.createdBy.name} />
        )}
      </dl>

      {document.notes && (
        <p className="mt-2 border border-neutral-400 p-2 text-xs">
          {document.notes}
        </p>
      )}

      {/* Las firmas son el punto de todo esto: el vale existe para que quede
          constancia en papel de quién entregó y quién recibió. Se deja el
          renglón de "nombre" aparte de la firma porque una firma sola no se
          lee, y meses después nadie sabe de quién era.

          `break-inside: avoid` es lo que impide el peor resultado posible:
          una hoja con todo el desglose y una segunda hoja con sólo las dos
          rayas de las firmas. */}
      <div className="print-signatures mt-10 grid grid-cols-2 gap-8 text-center text-xs">
        <Signature label="Entrega" name={document.handedOverBy} />
        <Signature label="Recibe" name={document.receivedBy} />
      </div>
    </main>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2">
      <dt className="font-medium">{label}:</dt>
      <dd>{value}</dd>
    </div>
  );
}

function Signature({ label, name }: { label: string; name: string | null }) {
  return (
    <div>
      <div className="border-b border-black" />
      <p className="mt-1 font-medium">{label}</p>
      {/* Si el vale ya trae el nombre capturado se imprime; si no, se deja el
          renglón en blanco para que lo escriba a mano quien recibe. */}
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

/** Valores distintos y sin vacíos, conservando el orden en que aparecieron. */
function unique(values: (string | null | undefined)[]): string[] {
  return [...new Set(values.filter((value): value is string => Boolean(value)))];
}

/**
 * Cadena vacía → null.
 *
 * `[].join(", ")` devuelve `""`, que es distinto de `null` para el `??` que
 * encadena los respaldos: sin esto, un vale sin rollos dejaba el respaldo en
 * cadena vacía y el renglón se imprimía con los dos puntos y nada después.
 */
function orNull(value: string): string | null {
  return value.length > 0 ? value : null;
}

/**
 * El foleo de un renglón: primero el catálogo, luego el enum viejo.
 *
 * Los vales capturados antes de que los foleos fueran administrables sólo
 * tienen el enum. Se traducen aquí para que una hoja reimpresa años después
 * siga saliendo del color correcto.
 */
function resolveTag(
  option: { name: string; color: string } | null,
  legacy: CutTag | null,
): { name: string; color: string } | null {
  if (option) return option;
  if (!legacy) return null;

  return {
    name: CUT_TAG_LABELS[legacy],
    color: CUT_TAG_COLORS[legacy].background,
  };
}
