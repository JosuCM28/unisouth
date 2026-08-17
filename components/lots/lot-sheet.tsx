import { LOT_STATUS_LABELS, UNIT_SHORT_LABELS } from "@/lib/constants/labels";
import { cn, formatDate, formatQuantity } from "@/lib/utils";
import type { LotSheetData } from "@/lib/lot-sheet-data";

/**
 * Hoja de identificación de un rollo, para imprimir.
 *
 * Va toda la información capturada porque esta hoja acompaña físicamente al
 * material: cuando alguien la levanta del piso debe poder responder de quién
 * es, de dónde vino y a qué producción está destinado sin abrir la app.
 *
 * El QR arriba y grande: es lo primero que se apunta con el teléfono.
 */
export function LotSheet({ lot, qrSvg }: { lot: LotSheetData; qrSvg: string }) {
  const unitLabel = UNIT_SHORT_LABELS[lot.unit];

  return (
    /* break-after-page separa un rollo del siguiente al imprimir varios.
       El salto y el padding del ÚLTIMO se anulan en globals.css (@media print):
       si no, sobra una hoja en blanco al final. */
    <article className="break-after-page bg-white p-4 text-black sm:p-8 print:p-8">
      <header className="flex items-start justify-between gap-6 border-b-2 border-black pb-4">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-wide">UNISOUTH · Almacén</p>
          <h1 className="tabular mt-1 text-3xl font-bold leading-none sm:text-4xl print:text-4xl">
            {lot.code}
          </h1>
          <p className="mt-2 text-xl">{lot.materialName}</p>
          <p className="tabular text-3xl font-bold">
            {formatQuantity(lot.currentQuantity, { unit: unitLabel })}
          </p>

          {/* Para qué es esta tela. Va en el encabezado y grande: es lo que se
              quiere saber al levantar la hoja del piso, junto con el folio. */}
          {lot.productionNote && (
            <p className="mt-2 border-2 border-black px-2 py-1 text-lg font-bold uppercase">
              {lot.productionNote}
            </p>
          )}
        </div>

        {/* El QR se inyecta como SVG generado en el servidor. */}
        <div
          className="size-24 shrink-0 sm:size-36 print:size-36"
          dangerouslySetInnerHTML={{ __html: qrSvg }}
        />
      </header>

      <Section title="Identificación">
        <Row label="Material" value={lot.materialName} />
        <Row label="Código de material" value={lot.materialCode} tabular />
        <Row label="Composición" value={lot.composition} />
        <Row label="Color" value={lot.colorText ?? lot.materialColor} />
        <Row label="Tono / partida de tintura" value={lot.shade} tabular />
        <Row label="Lote del proveedor" value={lot.supplierLotNumber} tabular />
        <Row label="Estado" value={LOT_STATUS_LABELS[lot.status]} />
      </Section>

      <Section title="Dueño y destino">
        <Row label="Cliente dueño" value={lot.clientName ?? "De la fábrica"} />
        {/* La producción del catálogo sólo se pinta si el rollo la trae: el
            dato que se usa a diario es el de texto libre del encabezado, y
            dos renglones llamados "Producción" —uno de ellos vacío— confunden
            a quien lee la hoja en el piso. */}
        {lot.productionRunName && (
          <Row label="Orden de producción" value={lot.productionRunName} />
        )}
        <Row label="Ubicación" value={lot.locationName} tabular />
      </Section>

      <Section title="Medidas">
        <Row
          label="Cantidad actual"
          value={formatQuantity(lot.currentQuantity, { unit: unitLabel })}
          tabular
        />
        <Row
          label="Cantidad inicial"
          value={formatQuantity(lot.initialQuantity, { unit: unitLabel })}
          tabular
        />
        <Row label="Ancho" value={formatMillimeters(lot.actualWidthMm)} tabular />
        <Row label="Peso" value={formatOunces(lot.actualWeightOz)} tabular />
      </Section>

      <Section title="Recepción">
        <Row label="Entrada al almacén" value={formatDate(lot.receivedAt)} tabular />
        <Row label="Recepción" value={lot.receiptCode} tabular />
        <Row label="Guía" value={lot.guideNumber} tabular />
        <Row label="Paquetería" value={lot.carrierName} />
        <Row label="Proveedor" value={lot.supplierName} />
        <Row label="Origen" value={lot.origin} />
        <Row label="Bajó del camión" value={lot.helperName} />
        <Row label="Registró" value={lot.createdByName} />
      </Section>

      {lot.comment && (
        <section className="mt-4">
          <h2 className="border-b border-black pb-1 text-sm font-bold uppercase">
            Notas
          </h2>
          <p className="mt-2 whitespace-pre-wrap text-sm">{lot.comment}</p>
        </section>
      )}

      <footer className="mt-6 border-t border-neutral-400 pt-2 text-xs">
        Impreso el {formatDate(new Date())} · Escanea el código para abrir el
        rollo en la app
      </footer>
    </article>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-4">
      <h2 className="border-b border-black pb-1 text-sm font-bold uppercase">
        {title}
      </h2>
      {/* Una columna en celular: con dos, una etiqueta como "Tono / partida
          de tintura" parte en dos líneas y su valor se sale de pantalla.
          En papel siempre van dos, que es donde el ancho alcanza. */}
      <dl className="mt-2 grid grid-cols-1 gap-x-8 gap-y-1 sm:grid-cols-2 print:grid-cols-2">
        {children}
      </dl>
    </section>
  );
}

/**
 * Un renglón del listado.
 *
 * Los vacíos se pintan con guion en vez de omitirse: en una hoja impresa, un
 * campo ausente y uno vacío se ven igual, y saber que "no tiene tono" es
 * distinto de "se me olvidó mirarlo".
 */
function Row({
  label,
  value,
  tabular,
}: {
  label: string;
  value: string | null | undefined;
  tabular?: boolean;
}) {
  return (
    <div className="flex justify-between gap-3 border-b border-neutral-200 py-1 text-base">
      <dt className="shrink-0 text-neutral-600">{label}</dt>
      {/* min-w-0 + break-words: una composición larga ("80% algodón 18%
          poliéster 2% elastano") se parte en varias líneas en vez de
          empujar el renglón fuera de la pantalla. */}
      <dd
        className={cn(
          "min-w-0 break-words text-right",
          tabular && "tabular",
        )}
      >
        {value || "—"}
      </dd>
    </div>
  );
}

function formatMillimeters(value: number | null): string | null {
  if (value === null) return null;
  return `${formatQuantity(value)} mm`;
}

function formatOunces(value: number | null): string | null {
  if (value === null) return null;
  return `${formatQuantity(value)} oz`;
}
