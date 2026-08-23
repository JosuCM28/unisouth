import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowLeft,
  Boxes,
  CalendarDays,
  History,
  Layers,
  Printer,
} from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/core/session";
import { getPileFilterOptions, getPileSheetData } from "@/lib/pile-sheet-data";
import { materialPath } from "@/lib/material-url";
import { getMaterialKpis, getMaterialDailyReport } from "@/lib/material-history";
import { resolveRange, toLocalInputValue } from "@/lib/history-range";
import { MovementRepository } from "@/lib/repositories/movement.repository";
import {
  LOT_STATUS_LABELS,
  LOT_STATUS_STYLES,
  MATERIAL_TYPE_LABELS,
  UNIT_SHORT_LABELS,
} from "@/lib/constants/labels";
import { cn, formatDate, formatQuantity, toPlainObject } from "@/lib/utils";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Pager } from "@/components/shared/pager";
import { Button } from "@/components/ui/button";
import { MovementList } from "@/components/movements/movement-list";
import { MaterialKpis } from "@/components/materials/material-kpis";
import { MaterialDailyReport } from "@/components/materials/material-daily-report";
import { MaterialHistoryFilters } from "@/components/materials/material-history-filters";
import { PileFilters } from "@/components/materials/pile-filters";

interface PageProps {
  /**
   * Catch-all y no un segmento simple porque la clave de un material admite
   * "/" (TELA/AZUL). Con `[code]` esas fichas daban 404.
   */
  params: Promise<{ code: string[] }>;
  searchParams: Promise<{
    /** Preset de la ventana: "hoy", "7", "30", "365". */
    rango?: string;
    /** Rango a mano, en hora de la planta. Gana sobre el preset. */
    desde?: string;
    hasta?: string;
    page?: string;
    /* Filtros de la pila. Acotan SÓLO la lista de rollos de abajo; el
       historial de movimientos sigue siendo del material completo. */
    clientId?: string;
    locationId?: string;
    colorName?: string;
    shade?: string;
  }>;
}

/** Movimientos por página del historial. */
const HISTORY_PAGE_SIZE = 20;

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
export default async function MaterialDetailPage({
  params,
  searchParams,
}: PageProps) {
  await requirePermission("inventory:browse");

  const { code } = await params;
  const query = await searchParams;
  const decoded = readCode(code);

  if (!decoded) notFound();

  const material = await prisma.material.findFirst({
    // Insensible a mayúsculas por si la clave se guardó antes de que el
    // esquema la normalizara: el QR de la hoja no debe fallar por eso.
    where: { code: { equals: decoded, mode: "insensitive" } },
    select: { id: true },
  });

  if (!material) notFound();

  /* Dos lecturas de la pila: una COMPLETA para el total del encabezado y
     otra acotada para la lista de abajo. Si el número grande se moviera con
     cada filtro, quien lo mira de lejos leería que la existencia bajó. */
  const [full, data, pileOptions] = await Promise.all([
    getPileSheetData({ materialId: material.id }),
    getPileSheetData({
      materialId: material.id,
      clientId: query.clientId,
      locationId: query.locationId,
      colorName: query.colorName,
      shade: query.shade,
    }),
    getPileFilterOptions(material.id),
  ]);

  if (!full || !data) notFound();

  const { material: spec } = full;
  const totals = full.totals;
  /* Lo que está viendo abajo, ya filtrado. */
  const shown = data.totals;
  const isPileFiltered = Boolean(
    query.clientId || query.locationId || query.colorName || query.shade,
  );
  const unitLabel = UNIT_SHORT_LABELS[totals.unit];

  /* La ventana se resuelve UNA vez y alimenta tanto los KPIs como la lista:
     si cada uno la calculara por su lado, un movimiento registrado entre las
     dos consultas haría que el total no cuadrara con las filas de abajo. */
  const range = resolveRange(query);
  const page = Math.max(1, Number(query.page) || 1);

  const movements = new MovementRepository();

  const [kpis, daily, history] = await Promise.all([
    getMaterialKpis({
      materialId: material.id,
      unit: spec.baseUnit,
      from: range.from,
      to: range.to,
    }),
    getMaterialDailyReport({
      materialId: material.id,
      unit: spec.baseUnit,
      from: range.from,
      to: range.to,
    }),
    movements.search({
      materialId: material.id,
      from: range.from,
      to: range.to,
      page,
      pageSize: HISTORY_PAGE_SIZE,
    }),
  ]);

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

      {/* El historial va ARRIBA de las especificaciones: la ficha técnica se
          consulta una vez y no cambia, mientras que "qué entró y salió hoy"
          es la pregunta que se hace todos los días. */}
      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <History className="size-4" aria-hidden />
            Movimiento del periodo
          </h2>
          <p className="tabular text-xs text-muted-foreground">{range.label}</p>
        </div>

        <MaterialHistoryFilters
          preset={range.preset}
          desde={toLocalInputValue(range.from)}
          hasta={toLocalInputValue(range.to)}
        />

        <MaterialKpis kpis={kpis} />
      </section>

      {/* El desglose por día va entre los KPIs y el kárdex: el total responde
          "cuánto", este responde "qué día", y el kárdex "en qué movimiento".
          De lo general a lo particular, que es como se investiga un faltante. */}
      <section className="flat-surface p-4">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold">
          <CalendarDays className="size-4" aria-hidden />
          Por día
        </h2>

        <MaterialDailyReport report={daily} />
      </section>

      <section className="flat-surface p-4">
        <h2 className="mb-3 text-sm font-semibold">
          Entradas y salidas
          <span className="tabular ml-2 font-normal text-muted-foreground">
            ({history.total})
          </span>
        </h2>

        <MovementList movements={history.items.map(toPlainObject)} />

        <Pager
          page={history.page}
          totalPages={history.totalPages}
          basePath={materialPath(spec.code)}
          params={{
            rango: query.rango,
            desde: query.desde,
            hasta: query.hasta,
          }}
          total={history.total}
          itemLabel={{ one: "movimiento", many: "movimientos" }}
        />
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

        <PileFilters
          clients={pileOptions.clients}
          locations={pileOptions.locations}
          colors={pileOptions.colors}
          shades={pileOptions.shades}
        />

        {/* Cuánto es lo que se está viendo. Con un filtro puesto, la lista
            corta se leería como "ya no hay tela"; este renglón dice que el
            resto sigue ahí, sólo que fuera del filtro. */}
        {isPileFiltered && (
          <p className="tabular mb-3 text-xs text-muted-foreground">
            {shown.lots} de {totals.lots}{" "}
            {totals.lots === 1 ? "rollo" : "rollos"} ·{" "}
            {formatQuantity(shown.quantity, { unit: unitLabel })} de{" "}
            {formatQuantity(totals.quantity, { unit: unitLabel })}
          </p>
        )}

        {data.lots.length === 0 ? (
          <EmptyState
            icon={Boxes}
            title={isPileFiltered ? "Ningún rollo coincide" : "Sin rollos en bodega"}
            description={
              isPileFiltered
                ? "Quita algún filtro para ver el resto de la pila."
                : "No hay existencia de este material ahora mismo."
            }
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
            {/* Contra lo FILTRADO y no contra la pila entera: con un filtro
                puesto, "los primeros 200 de 640" compararía la lista contra
                un total que no es el suyo. */}
            Se listan los primeros {data.lots.length} de {shown.lots} rollos.
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
