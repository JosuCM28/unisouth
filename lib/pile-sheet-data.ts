import type { LotStatus, MaterialType, Unit } from "@prisma/client";
import { STATUSES_PHYSICALLY_PRESENT } from "@/lib/constants/lot-status";
import { prisma } from "@/lib/prisma";

/** Un renglón del desglose: un rollo de la pila. */
export interface PileLotRow {
  id: string;
  code: string;
  shade: string | null;
  colorText: string | null;
  supplierLotNumber: string | null;
  locationName: string | null;
  clientName: string | null;
  status: LotStatus;
  isRemnant: boolean;
  currentQuantity: number;
  unit: Unit;
  receivedAt: Date;
  verified: boolean;
}

/** Cuánto hay de un tono. Se agrupa porque mezclar tonos arruina el tendido. */
export interface ShadeTotal {
  shade: string;
  lots: number;
  quantity: number;
}

export interface PileSheetData {
  material: {
    id: string;
    code: string;
    name: string;
    type: MaterialType;
    composition: string | null;
    colorName: string | null;
    widthMm: number | null;
    thicknessMm: number | null;
    weightOz: number | null;
    reorderPoint: number;
    requiresShade: boolean;
    baseUnit: Unit;
  };
  lots: PileLotRow[];
  totals: {
    lots: number;
    quantity: number;
    unit: Unit;
    remnants: number;
    unverified: number;
  };
  shades: ShadeTotal[];
  /** Dueños y ubicaciones donde está repartida la pila. */
  clientNames: string[];
  locationNames: string[];
  /** Del más viejo al más nuevo. `null` si la pila está vacía. */
  receivedFrom: Date | null;
  receivedTo: Date | null;
  guideNumbers: string[];
  supplierNames: string[];
  /** Se topó el listado: hay más rollos de los que caben en la hoja. */
  truncated: boolean;
}

/**
 * Tope de renglones de la hoja.
 *
 * Una pila real son decenas de rollos, no cientos: por encima de esto la hoja
 * deja de ser algo que se pega a la pila y se vuelve un reporte. Los totales
 * del encabezado SÍ se calculan sobre todo, así que el número grande nunca
 * miente aunque la tabla venga recortada.
 */
const MAX_ROWS = 200;

export interface PileFilters {
  materialId: string;
  /** Acota la pila a un dueño: su tela no se mezcla con la de otro. */
  clientId?: string;
  locationId?: string;
  /** Sólo lo que ocupa lugar físico. Por omisión, sí. */
  onlyPresent?: boolean;
  /**
   * Color y tono, para acotar la pila desde la ficha del material.
   *
   * El color se busca en los dos lados igual que en el inventario: el del
   * rollo manda y el del catálogo sólo aplica cuando la pieza no trae el
   * suyo. El tono es exacto —es una clave, y traer el A-420 al pedir el
   * A-42 sería ofrecer tela que no se puede tender junta.
   */
  colorName?: string;
  shade?: string;
}

/**
 * Todo lo que lleva la hoja de una PILA: un material y sus rollos.
 *
 * Existe aparte de `getLotSheetsData` porque responde otra pregunta. Aquella
 * imprime una hoja POR ROLLO para pegar en cada pieza; ésta imprime UNA hoja
 * para toda la estiba, con el desglose de lo que hay debajo. En la bodega la
 * segunda es la que evita andar levantando rollos para saber qué hay.
 */
export async function getPileSheetData(
  filters: PileFilters,
): Promise<PileSheetData | null> {
  const material = await prisma.material.findUnique({
    where: { id: filters.materialId },
    select: {
      id: true,
      code: true,
      name: true,
      type: true,
      composition: true,
      colorName: true,
      widthMm: true,
      thicknessMm: true,
      weightOz: true,
      reorderPoint: true,
      requiresShade: true,
      baseUnit: true,
    },
  });

  if (!material) return null;

  const where = {
    materialId: filters.materialId,
    ...(filters.clientId ? { clientId: filters.clientId } : {}),
    ...(filters.locationId ? { locationId: filters.locationId } : {}),
    // Insensible a mayúsculas: en la base conviven "Blanco" y "BLANCO" según
    // quién capturó, y el desplegable ofrece una sola opción para los dos.
    ...(filters.shade
      ? { shade: { equals: filters.shade, mode: "insensitive" as const } }
      : {}),
    ...(filters.colorName
      ? {
          OR: [
            { colorText: { equals: filters.colorName, mode: "insensitive" as const } },
            {
              colorText: null,
              material: {
                colorName: { equals: filters.colorName, mode: "insensitive" as const },
              },
            },
          ],
        }
      : {}),
    // Un rollo agotado o dado de baja no está en la pila: contarlo haría que
    // la hoja prometiera tela que ya no existe.
    ...(filters.onlyPresent === false
      ? {}
      : { status: { in: [...STATUSES_PHYSICALLY_PRESENT] } }),
  };

  /* El conteo y la suma van sobre TODOS los rollos, aunque la tabla se tope:
     el total del encabezado es el dato que se lee a un metro de distancia y
     tiene que cuadrar con lo que hay en el piso. */
  const [lots, aggregate, totalCount] = await Promise.all([
    prisma.lot.findMany({
      where,
      select: {
        id: true,
        code: true,
        shade: true,
        colorText: true,
        supplierLotNumber: true,
        status: true,
        isRemnant: true,
        currentQuantity: true,
        unit: true,
        receivedAt: true,
        verified: true,
        location: { select: { code: true, name: true } },
        client: { select: { name: true } },
        receipt: {
          select: { guideNumber: true, supplier: { select: { name: true } } },
        },
      },
      // Retazos primero y luego FIFO: el mismo orden en que se deben surtir,
      // para que la hoja se lea igual que se trabaja la pila.
      orderBy: [{ isRemnant: "desc" }, { receivedAt: "asc" }, { id: "asc" }],
      take: MAX_ROWS,
    }),
    prisma.lot.aggregate({
      where,
      _sum: { currentQuantity: true },
      _min: { receivedAt: true },
      _max: { receivedAt: true },
    }),
    prisma.lot.count({ where }),
  ]);

  const rows: PileLotRow[] = lots.map((lot) => ({
    id: lot.id,
    code: lot.code,
    shade: lot.shade,
    colorText: lot.colorText,
    supplierLotNumber: lot.supplierLotNumber,
    locationName: lot.location
      ? `${lot.location.code} · ${lot.location.name}`
      : null,
    clientName: lot.client?.name ?? null,
    status: lot.status,
    isRemnant: lot.isRemnant,
    currentQuantity: Number(lot.currentQuantity),
    unit: lot.unit,
    receivedAt: lot.receivedAt,
    verified: lot.verified,
  }));

  return {
    material: {
      ...material,
      thicknessMm: material.thicknessMm ? Number(material.thicknessMm) : null,
      weightOz: material.weightOz ? Number(material.weightOz) : null,
      reorderPoint: Number(material.reorderPoint),
    },
    lots: rows,
    totals: {
      lots: totalCount,
      quantity: Number(aggregate._sum.currentQuantity ?? 0),
      unit: material.baseUnit,
      remnants: rows.filter((lot) => lot.isRemnant).length,
      unverified: rows.filter((lot) => !lot.verified).length,
    },
    shades: groupByShade(rows),
    clientNames: unique(rows.map((lot) => lot.clientName)),
    locationNames: unique(rows.map((lot) => lot.locationName)),
    receivedFrom: aggregate._min.receivedAt ?? null,
    receivedTo: aggregate._max.receivedAt ?? null,
    guideNumbers: unique(lots.map((lot) => lot.receipt?.guideNumber ?? null)),
    supplierNames: unique(
      lots.map((lot) => lot.receipt?.supplier?.name ?? null),
    ),
    truncated: totalCount > rows.length,
  };
}

/**
 * Cuánto hay de cada tono.
 *
 * Es la tabla que de verdad se consulta antes de cortar: si un tendido mezcla
 * dos partidas de tintura, la prenda sale con una manga de otro color y se
 * rechaza el lote completo.
 */
function groupByShade(lots: PileLotRow[]): ShadeTotal[] {
  const map = new Map<string, ShadeTotal>();

  for (const lot of lots) {
    const shade = lot.shade?.trim() || "Sin tono";
    const current = map.get(shade) ?? { shade, lots: 0, quantity: 0 };
    current.lots += 1;
    current.quantity += lot.currentQuantity;
    map.set(shade, current);
  }

  // De mayor a menor: el tono con más tela es del que conviene cortar.
  return [...map.values()].sort((a, b) => b.quantity - a.quantity);
}

/** Valores distintos y sin vacíos, en el orden en que aparecieron. */
function unique(values: (string | null | undefined)[]): string[] {
  return [...new Set(values.filter((v): v is string => Boolean(v)))];
}

/** Opciones para acotar la pila desde la ficha del material. */
export interface PileFilterOptions {
  clients: { id: string; label: string }[];
  locations: { id: string; label: string }[];
  colors: { id: string; label: string }[];
  shades: { id: string; label: string }[];
}

/**
 * Con qué se puede filtrar ESTA pila.
 *
 * Se saca de los rollos que hay, no de los catálogos: ofrecer los 40 clientes
 * del sistema cuando la pila es de dos obligaría a probar uno por uno para
 * descubrir cuáles traen algo. Todo lo que sale en estas listas devuelve al
 * menos un rollo.
 *
 * El dueño y la ubicación van con su id porque así se filtran; el color y el
 * tono son texto libre y se filtran por su valor.
 */
export async function getPileFilterOptions(
  materialId: string,
): Promise<PileFilterOptions> {
  const lots = await prisma.lot.findMany({
    where: {
      materialId,
      status: { in: [...STATUSES_PHYSICALLY_PRESENT] },
    },
    select: {
      shade: true,
      colorText: true,
      client: { select: { id: true, name: true } },
      location: { select: { id: true, code: true, name: true } },
      material: { select: { colorName: true } },
    },
  });

  const clients = new Map<string, string>();
  const locations = new Map<string, string>();
  /* Color y tono se agrupan sin distinguir mayúsculas: en la base conviven
     "Blanco" y "BLANCO", el filtro ya es insensible, y listarlos aparte
     daría dos opciones que devuelven lo mismo. */
  const colors = new Map<string, string>();
  const shades = new Map<string, string>();

  for (const lot of lots) {
    if (lot.client) clients.set(lot.client.id, lot.client.name);
    if (lot.location) {
      locations.set(lot.location.id, `${lot.location.code} · ${lot.location.name}`);
    }

    // El del rollo manda sobre el del catálogo: si la partida salió de otro
    // color, ése es el color que tiene la pieza enfrente.
    const color = lot.colorText?.trim() || lot.material?.colorName?.trim();
    if (color && !colors.has(color.toLowerCase())) {
      colors.set(color.toLowerCase(), color);
    }

    const shade = lot.shade?.trim();
    if (shade && !shades.has(shade.toLowerCase())) {
      shades.set(shade.toLowerCase(), shade);
    }
  }

  const byLabel = (a: { label: string }, b: { label: string }) =>
    a.label.localeCompare(b.label, "es-MX");

  return {
    clients: [...clients].map(([id, label]) => ({ id, label })).sort(byLabel),
    locations: [...locations].map(([id, label]) => ({ id, label })).sort(byLabel),
    colors: [...colors.values()]
      .map((color) => ({ id: color, label: color }))
      .sort(byLabel),
    // Los tonos son claves correlativas (A-42, A-43): el orden natural
    // agrupa la misma serie, que es como se piden en el piso.
    shades: [...shades.values()]
      .map((shade) => ({ id: shade, label: shade }))
      .sort((a, b) => a.label.localeCompare(b.label, "es-MX", { numeric: true })),
  };
}
