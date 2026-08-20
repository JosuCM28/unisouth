import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Boxes, Layers, Printer } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/core/session";
import { getPileSheetData } from "@/lib/pile-sheet-data";
import {
  LOT_STATUS_LABELS,
  LOT_STATUS_STYLES,
  MATERIAL_TYPE_LABELS,
  UNIT_SHORT_LABELS,
} from "@/lib/constants/labels";
import { cn, formatDate, formatQuantity } from "@/lib/utils";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";

interface PageProps {
  /**
   * Catch-all y no un segmento simple porque la clave de un material admite
   * "/" (TELA/AZUL). Con `[code]` esas fichas daban 404.
   */
  params: Promise<{ code: string[] }>;
}

/**
 * Junta los tramos de la ruta y los normaliza a la clave real.
 *
 * Se sube a mayúsculas porque así se guardan las claves (`materialSchema` las
 * transforma al capturar), y un QR leído de una hoja vieja puede traerlas en
 * minúscula. Devuelve `null` si el porcentaje viene mal formado, para que la
 * página conteste 404 en vez de reventar.
 */
function readCode(segments: string[]): string | null {
  try {
    const joined = segments
      .map((segment) => decodeURIComponent(segment))
      .join("/")
      .trim();

    return joined.length > 0 ? joined.toUpperCase() : null;
  } catch {
    return null;
  }
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { code } = await params;
  return { title: readCode(code) ?? "Material" };
}

/**
 * Ficha de un material: sus especificaciones y la pila que hay en bodega.
 *
 * Es a donde lleva el QR de la hoja de pila. Antes ese QR abría el inventario
 * filtrado, que lista rollos pero no dice nada del material: parado frente a
 * la estiba con el teléfono, lo que se quiere saber es qué tela es, cuánta
 * queda y de qué tonos, sin tener que cruzar dos pantallas.
 */
export default async function MaterialDetailPage({ params }: PageProps) {
  await requirePermission("inventory:read");

  const { code } = await params;
  const decoded = readCode(code);

  if (!decoded) notFound();

  const material = await prisma.material.findFirst({
    // Insensible a mayúsculas por si la clave se guardó antes de que el
    // esquema la normalizara: el QR de la hoja no debe fallar por eso.
    where: { code: { equals: decoded, mode: "insensitive" } },
    select: { id: true },
  });

  if (!material) notFound();

  const data = await getPileSheetData({ materialId: material.id });
  if (!data) notFound();

  const { material: spec, totals } = data;
  const unitLabel = UNIT_SHORT_LABELS[totals.unit];

  return (
    <div className="flex flex-col gap-4">
      <Link
        href="/materials"
        className="touch-target flex w-fit items-center gap-1.5 text-sm text-muted-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Materiales
      </Link>

      <PageHeader
        title={spec.name}
        description={spec.code}
        action={
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline" className="touch-target">
              <Link href={`/lots?materialId=${spec.id}`}>
                <Boxes className="size-4" aria-hidden />
                Ver rollos
              </Link>
            </Button>
            <Button asChild variant="outline" className="touch-target">
              <a
                href={`/print/pile?materialId=${spec.id}`}
                target="_blank"
                rel="noopener"
              >
                <Printer className="size-4" aria-hidden />
                Hoja de pila
              </a>
            </Button>
          </div>
        }
      />

      {/* Lo que se lee de un vistazo con el teléfono en la mano. */}
      <section className="flat-surface p-4">
        <p className="tabular text-3xl font-bold leading-none">
          {formatQuantity(totals.quantity, { unit: unitLabel })}
        </p>
        <p className="tabular mt-1 text-sm text-muted-foreground">
          {totals.lots} {totals.lots === 1 ? "rollo" : "rollos"} en bodega
          {totals.remnants > 0 && ` · ${totals.remnants} retazo(s)`}
          {totals.unverified > 0 && ` · ${totals.unverified} sin verificar`}
        </p>
      </section>

      <div className="grid gap-4 md:grid-cols-2">
        <section className="flat-surface p-4">
          <h2 className="mb-2 text-sm font-semibold">Especificaciones</h2>
          <dl>
            <Row label="Tipo" value={MATERIAL_TYPE_LABELS[spec.type]} />
            <Row label="Composición" value={spec.composition} />
            <Row label="Color" value={spec.colorName} />
            <Row
              label="Ancho"
              value={spec.widthMm ? `${spec.widthMm} mm` : null}
              tabular
            />
            {/* Grosor y onzas conviven: la mezclilla se especifica en oz/yd² y
                la tela plana en milímetros. Se muestra el que esté capturado. */}
            <Row
              label="Grosor"
              value={spec.thicknessMm ? `${spec.thicknessMm} mm` : null}
              tabular
            />
            <Row
              label="Peso"
              value={spec.weightOz ? `${spec.weightOz} oz/yd²` : null}
              tabular
            />
            <Row
              label="Punto de reorden"
              value={
                spec.reorderPoint > 0
                  ? formatQuantity(spec.reorderPoint, { unit: unitLabel })
                  : null
              }
              tabular
            />
            <Row
              label="Exige tono"
              value={spec.requiresShade ? "Sí" : null}
            />
          </dl>
        </section>

        <section className="flat-surface p-4">
          <h2 className="mb-2 text-sm font-semibold">
            Tonos
            {spec.requiresShade && (
              <span className="ml-2 text-xs font-normal text-state-defective">
                no mezclar en un tendido
              </span>
            )}
          </h2>

          {data.shades.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin existencia.</p>
          ) : (
            <ul className="flex flex-col">
              {data.shades.map((shade) => (
                <li
                  key={shade.shade}
                  className="flex items-baseline justify-between gap-3 border-b border-border py-1 text-sm last:border-b-0"
                >
                  <span className="tabular">{shade.shade}</span>
                  <span className="tabular text-right">
                    {formatQuantity(shade.quantity, { unit: unitLabel })}
                    <span className="text-muted-foreground">
                      {" "}
                      · {shade.lots} {shade.lots === 1 ? "rollo" : "rollos"}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}

          <h2 className="mb-2 mt-4 text-sm font-semibold">Dónde está</h2>
          <p className="text-sm text-muted-foreground">
            {data.locationNames.join(" · ") || "Sin ubicación asignada"}
          </p>

          <h2 className="mb-2 mt-4 text-sm font-semibold">Dueño</h2>
          <p className="text-sm text-muted-foreground">
            {data.clientNames.join(" · ") || "De la fábrica"}
          </p>
        </section>
      </div>

      <section className="flat-surface p-4">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold">
          <Layers className="size-4" aria-hidden />
          Rollos de esta pila
        </h2>

        {data.lots.length === 0 ? (
          <EmptyState
            icon={Boxes}
            title="Sin rollos en bodega"
            description="No hay existencia de este material ahora mismo."
          />
        ) : (
          <ul className="flex flex-col gap-2">
            {data.lots.map((lot) => (
              <li key={lot.id}>
                <Link
                  href={`/lots/${lot.code}`}
                  className="flat-surface flex items-start justify-between gap-3 p-3 transition-colors active:bg-accent"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="tabular text-sm font-medium">
                        {lot.code}
                      </span>
                      <span
                        className={cn(
                          "rounded px-1.5 py-0.5 text-xs",
                          LOT_STATUS_STYLES[lot.status],
                        )}
                      >
                        {LOT_STATUS_LABELS[lot.status]}
                      </span>
                    </div>
                    <p className="tabular text-xs text-muted-foreground">
                      {lot.shade ?? "Sin tono"}
                      {lot.locationName && ` · ${lot.locationName}`}
                      {` · ${formatDate(lot.receivedAt)}`}
                    </p>
                  </div>

                  <span className="tabular shrink-0 text-sm font-medium">
                    {formatQuantity(lot.currentQuantity, {
                      unit: UNIT_SHORT_LABELS[lot.unit],
                    })}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}

        {data.truncated && (
          <p className="mt-2 text-xs text-muted-foreground">
            Se listan los primeros {data.lots.length} de {totals.lots} rollos.
            El total de arriba sí los considera todos.
          </p>
        )}
      </section>
    </div>
  );
}

/** Un renglón de especificación. Los vacíos no se pintan. */
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
    <div className="flex items-baseline justify-between gap-3 border-b border-border py-1 text-sm last:border-b-0">
      <dt className="shrink-0 text-muted-foreground">{label}</dt>
      <dd className={cn("min-w-0 break-words text-right", tabular && "tabular")}>
        {value}
      </dd>
    </div>
  );
}
