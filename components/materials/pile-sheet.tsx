import {
  LOT_STATUS_LABELS,
  MATERIAL_TYPE_LABELS,
  UNIT_SHORT_LABELS,
} from "@/lib/constants/labels";
import { formatDate, formatQuantity } from "@/lib/utils";
import type { PileSheetData } from "@/lib/pile-sheet-data";

/**
 * Hoja de una PILA de rollos, para pegar en la estiba.
 *
 * Responde de un vistazo lo que hoy obliga a levantar rollo por rollo: qué
 * material es, cuánto hay en total, de qué tonos y de quién es. El desglose
 * de abajo dice exactamente qué piezas componen la pila.
 *
 * El QR es de la PILA, no de un rollo: abre el inventario filtrado por esta
 * clave, que es lo que se quiere ver con el teléfono frente a la estiba.
 */
export function PileSheet({
  data,
  qrSvg,
}: {
  data: PileSheetData;
  qrSvg: string;
}) {
  const { material, totals } = data;
  const unitLabel = UNIT_SHORT_LABELS[totals.unit];

  return (
    <article className="bg-white p-4 text-black sm:p-8 print:p-8">
      <header className="flex items-start justify-between gap-6 border-b-2 border-black pb-4">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-wide">UNISOUTH · Almacén</p>
          <h1 className="mt-1 text-3xl font-bold leading-tight sm:text-4xl print:text-4xl">
            {material.name}
          </h1>
          <p className="tabular mt-1 text-lg">{material.code}</p>

          {/* El número que se lee a un metro: cuánto hay en la pila. */}
          <p className="tabular mt-3 text-4xl font-bold leading-none">
            {formatQuantity(totals.quantity, { unit: unitLabel })}
          </p>
          <p className="tabular mt-1 text-lg">
            {totals.lots} {totals.lots === 1 ? "rollo" : "rollos"}
            {totals.remnants > 0 && ` · ${totals.remnants} retazo(s)`}
          </p>
        </div>

        <div className="shrink-0 text-center">
          <div
            className="size-32 sm:size-40 print:size-40"
            dangerouslySetInnerHTML={{ __html: qrSvg }}
          />
          <p className="mt-1 text-[10px] uppercase">Escanea la pila</p>
        </div>
      </header>

      <div className="grid gap-x-8 sm:grid-cols-2 print:grid-cols-2">
        <Section title="Ficha del material">
          <Row label="Tipo" value={MATERIAL_TYPE_LABELS[material.type]} />
          <Row label="Composición" value={material.composition} />
          <Row label="Color" value={material.colorName} />
          <Row
            label="Ancho"
            value={material.widthMm ? `${material.widthMm} mm` : null}
            tabular
          />
          {/* Grosor y onzas conviven: la mezclilla se especifica en oz/yd² y
              la tela plana en milímetros. Se muestra el que esté capturado. */}
          <Row
            label="Grosor"
            value={material.thicknessMm ? `${material.thicknessMm} mm` : null}
            tabular
          />
          <Row
            label="Peso"
            value={material.weightOz ? `${material.weightOz} oz/yd²` : null}
            tabular
          />
          <Row
            label="Punto de reorden"
            value={
              material.reorderPoint > 0
                ? formatQuantity(material.reorderPoint, { unit: unitLabel })
                : null
            }
            tabular
          />
        </Section>

        <Section title="Dueño y ubicación">
          <Row
            label={data.clientNames.length === 1 ? "Cliente dueño" : "Dueños"}
            value={data.clientNames.join(", ") || "De la fábrica"}
          />
          <Row
            label={data.locationNames.length === 1 ? "Ubicación" : "Ubicaciones"}
            value={data.locationNames.join(", ")}
          />
          <Row
            label="Recibido"
            value={
              data.receivedFrom
                ? formatRange(data.receivedFrom, data.receivedTo)
                : null
            }
            tabular
          />
          <Row label="Guía" value={data.guideNumbers.join(", ")} tabular />
          <Row label="Proveedor" value={data.supplierNames.join(", ")} />
          <Row
            label="Sin verificar"
            value={totals.unverified > 0 ? `${totals.unverified} rollo(s)` : null}
            tabular
          />
        </Section>
      </div>

      {/* Los tonos van destacados: mezclar dos partidas de tintura en un mismo
          tendido arruina la prenda, así que es lo que se revisa antes de cortar. */}
      {data.shades.length > 0 && (
        <section className="mt-4">
          <h2 className="border-b border-black pb-1 text-sm font-bold uppercase">
            Tonos en esta pila
            {material.requiresShade && " · NO MEZCLAR EN UN TENDIDO"}
          </h2>
          <table className="mt-2 w-full border-collapse text-sm">
            <thead>
              <tr className="bg-neutral-200 text-left">
                <th className="border border-black px-2 py-1">Tono</th>
                <th className="border border-black px-2 py-1 text-right">
                  Rollos
                </th>
                <th className="border border-black px-2 py-1 text-right">
                  Cantidad
                </th>
              </tr>
            </thead>
            <tbody>
              {data.shades.map((shade) => (
                <tr key={shade.shade}>
                  <td className="tabular border border-black px-2 py-1 font-medium">
                    {shade.shade}
                  </td>
                  <td className="tabular border border-black px-2 py-1 text-right">
                    {shade.lots}
                  </td>
                  <td className="tabular border border-black px-2 py-1 text-right">
                    {formatQuantity(shade.quantity, { unit: unitLabel })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      <section className="mt-4">
        <h2 className="border-b border-black pb-1 text-sm font-bold uppercase">
          Desglose de la pila
        </h2>

        <table className="mt-2 w-full border-collapse text-xs">
          <thead>
            <tr className="bg-neutral-200 text-left">
              <th className="border border-black px-1.5 py-1">Folio</th>
              <th className="border border-black px-1.5 py-1">Tono</th>
              <th className="border border-black px-1.5 py-1">Lote prov.</th>
              <th className="border border-black px-1.5 py-1">Ubicación</th>
              <th className="border border-black px-1.5 py-1">Recibido</th>
              <th className="border border-black px-1.5 py-1 text-right">
                Cantidad
              </th>
            </tr>
          </thead>
          <tbody>
            {data.lots.map((lot) => (
              <tr key={lot.id}>
                <td className="tabular border border-black px-1.5 py-1 font-medium">
                  {lot.code}
                  {lot.isRemnant && " ·R"}
                </td>
                <td className="tabular border border-black px-1.5 py-1">
                  {lot.shade ?? "—"}
                </td>
                <td className="tabular border border-black px-1.5 py-1">
                  {lot.supplierLotNumber ?? "—"}
                </td>
                <td className="tabular border border-black px-1.5 py-1">
                  {lot.locationName ?? "—"}
                </td>
                <td className="tabular border border-black px-1.5 py-1">
                  {formatDate(lot.receivedAt)}
                </td>
                <td className="tabular border border-black px-1.5 py-1 text-right">
                  {formatQuantity(lot.currentQuantity, {
                    unit: UNIT_SHORT_LABELS[lot.unit],
                  })}
                  {lot.status !== "AVAILABLE" &&
                    ` (${LOT_STATUS_LABELS[lot.status]})`}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="font-bold">
              <td className="border border-black px-1.5 py-1" colSpan={5}>
                TOTAL
              </td>
              <td className="tabular border border-black px-1.5 py-1 text-right">
                {formatQuantity(totals.quantity, { unit: unitLabel })}
              </td>
            </tr>
          </tfoot>
        </table>

        {/* Se avisa el recorte: una hoja que dice 200 cuando hay 260 haría
            que alguien surtiera de menos creyendo que ya no queda. */}
        {data.truncated && (
          <p className="mt-2 text-xs">
            Se listan los primeros {data.lots.length} rollos de {totals.lots}.
            El total de arriba sí considera todos.
          </p>
        )}

        <p className="mt-2 text-[10px]">
          ·R = retazo, se surte primero. Impreso el {formatDate(new Date())}.
        </p>
      </section>
    </article>
  );
}

/** "12 ago 2026" o "12 ago – 3 sep 2026" si la pila llegó en varias fechas. */
function formatRange(from: Date, to: Date | null): string {
  if (!to || from.getTime() === to.getTime()) return formatDate(from);
  return `${formatDate(from)} – ${formatDate(to)}`;
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
      <dl className="mt-1">{children}</dl>
    </section>
  );
}

/**
 * Un renglón de especificación.
 *
 * Los vacíos se omiten por completo en vez de pintarse con guion: en la hoja
 * de la pila hay poco espacio y una lista de guiones estorba más de lo que
 * informa. En la ficha del rollo sí se pintan, porque ahí saber que un campo
 * quedó vacío es un dato.
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
  if (!value) return null;

  return (
    <div className="flex justify-between gap-3 border-b border-neutral-300 py-0.5 text-sm">
      <dt className="shrink-0 text-neutral-700">{label}</dt>
      <dd className={tabular ? "tabular text-right" : "text-right"}>{value}</dd>
    </div>
  );
}
