import {
  MATERIAL_TYPE_LABELS,
  UNIT_LABELS,
  UNIT_SHORT_LABELS,
} from "@/lib/constants/labels";
import { formatQuantity } from "@/lib/utils";
import type { PileSheetData } from "@/lib/pile-sheet-data";

/**
 * Hoja de una PILA de rollos, para pegar en la estiba.
 *
 * Dice QUÉ tela es y nada más: identifica el material, sus especificaciones y
 * el QR de su ficha.
 *
 * Deliberadamente NO trae metraje, número de rollos ni desglose folio por
 * folio. Esos datos cambian con cada corte, así que una hoja pegada a la
 * estiba los muestra viejos desde el día siguiente: prometería tela que ya se
 * gastó o escondería la que llegó después. Para saber cuánto hay al día se
 * escanea el QR, que abre la ficha con la existencia real.
 */
export function PileSheet({
  material,
  qrSvg,
}: {
  material: PileSheetData["material"];
  qrSvg: string;
}) {
  const unitLabel = UNIT_SHORT_LABELS[material.baseUnit];

  return (
    <article className="bg-white p-4 text-black sm:p-8 print:p-8">
      <header className="border-b-2 border-black pb-4">
        <p className="text-xs uppercase tracking-wide">UNISOUTH · Almacén</p>
        <h1 className="mt-1 text-4xl font-bold leading-tight print:text-5xl">
          {material.name}
        </h1>
        <p className="tabular mt-1 text-2xl font-bold">{material.code}</p>
      </header>

      {/* El QR ocupa el centro de la hoja: ahora es lo único que responde
          "cuánto queda", así que tiene que leerse desde lejos y con el
          teléfono en una mano. */}
      <div className="mt-6 flex flex-col items-center">
        <div
          className="size-56 sm:size-64 print:size-64"
          dangerouslySetInnerHTML={{ __html: qrSvg }}
        />
        <p className="mt-2 text-center text-sm font-bold uppercase">
          Escanea para ver la existencia al día
        </p>
      </div>

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
        <Row label="Unidad" value={UNIT_LABELS[material.baseUnit]} />
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

      {/* Mezclar dos partidas de tintura en un mismo tendido saca la prenda
          con una manga de otro color y se rechaza el lote completo: el aviso
          va en la hoja porque es lo que se revisa antes de cortar. */}
      {material.requiresShade && (
        <p className="mt-4 border-2 border-black px-3 py-2 text-center text-sm font-bold uppercase">
          Verifica el tono antes de cortar · No mezclar tonos en un tendido
        </p>
      )}
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
    <section className="mt-6">
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
    <div className="flex justify-between gap-3 border-b border-neutral-300 py-1 text-base">
      <dt className="shrink-0 text-neutral-700">{label}</dt>
      <dd className={tabular ? "tabular text-right" : "text-right"}>{value}</dd>
    </div>
  );
}
