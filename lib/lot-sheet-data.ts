import type { LotStatus, MeasurementSource, Unit } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/**
 * Todo lo que lleva la hoja impresa de un rollo.
 *
 * Es un tipo plano —sin Decimal ni relaciones anidadas— porque la hoja se
 * arma en el servidor y sólo necesita valores, no el modelo completo.
 */
export interface LotSheetData {
  id: string;
  code: string;

  materialName: string;
  materialCode: string;
  composition: string | null;
  materialColor: string | null;

  colorText: string | null;
  shade: string | null;
  supplierLotNumber: string | null;
  status: LotStatus;

  clientName: string | null;
  productionRunName: string | null;
  locationName: string | null;

  unit: Unit;
  currentQuantity: number;
  initialQuantity: number;
  actualWidthMm: number | null;
  actualWeightOz: number | null;
  measurementSource: MeasurementSource;
  verified: boolean;

  receivedAt: Date;
  receiptCode: string | null;
  guideNumber: string | null;
  carrierName: string | null;
  supplierName: string | null;
  origin: string | null;
  helperName: string | null;
  createdByName: string | null;

  comment: string | null;
}

/** Lo que la consulta necesita traer. Se declara una vez y se reutiliza. */
const SHEET_INCLUDE = {
  material: {
    select: { code: true, name: true, composition: true, colorName: true },
  },
  client: { select: { name: true } },
  location: { select: { code: true, name: true } },
  productionRun: { select: { code: true, name: true } },
  helper: { select: { name: true } },
  createdBy: { select: { name: true } },
  receipt: {
    select: {
      code: true,
      guideNumber: true,
      origin: true,
      carrier: { select: { name: true } },
      supplier: { select: { name: true } },
    },
  },
} as const;

type LotWithRelations = Awaited<
  ReturnType<typeof prisma.lot.findFirstOrThrow<{ include: typeof SHEET_INCLUDE }>>
>;

/**
 * Aplana el modelo de Prisma a lo que pinta la hoja.
 *
 * Los Decimal se convierten aquí: la hoja sólo debe preocuparse de formatear.
 */
function toSheetData(lot: LotWithRelations): LotSheetData {
  return {
    id: lot.id,
    code: lot.code,

    materialName: lot.material.name,
    materialCode: lot.material.code,
    composition: lot.material.composition,
    materialColor: lot.material.colorName,

    colorText: lot.colorText,
    shade: lot.shade,
    supplierLotNumber: lot.supplierLotNumber,
    status: lot.status,

    clientName: lot.client?.name ?? null,
    // El nombre de la producción incluye su folio: "PO-2026-01 · Overol gasera"
    // identifica mejor que sólo el nombre cuando hay varias corridas parecidas.
    productionRunName: lot.productionRun
      ? `${lot.productionRun.code} · ${lot.productionRun.name}`
      : null,
    locationName: lot.location
      ? `${lot.location.code} · ${lot.location.name}`
      : null,

    unit: lot.unit,
    currentQuantity: Number(lot.currentQuantity),
    initialQuantity: Number(lot.initialQuantity),
    actualWidthMm: lot.actualWidthMm,
    actualWeightOz: lot.actualWeightOz ? Number(lot.actualWeightOz) : null,
    measurementSource: lot.measurementSource,
    verified: lot.verified,

    receivedAt: lot.receivedAt,
    receiptCode: lot.receipt?.code ?? null,
    guideNumber: lot.receipt?.guideNumber ?? null,
    carrierName: lot.receipt?.carrier?.name ?? null,
    supplierName: lot.receipt?.supplier?.name ?? null,
    origin: lot.receipt?.origin ?? null,
    helperName: lot.helper?.name ?? null,
    createdByName: lot.createdBy?.name ?? null,

    comment: lot.comment,
  };
}

/** Un rollo por su folio. */
export async function getLotSheetData(
  code: string,
): Promise<LotSheetData | null> {
  const lot = await prisma.lot.findUnique({
    where: { code },
    include: SHEET_INCLUDE,
  });

  return lot ? toSheetData(lot) : null;
}

/**
 * Varios rollos de golpe, para imprimir un juego completo.
 *
 * Se topa en 100 hojas: más que eso es un error de dedo en el filtro, no una
 * intención real, y generar 5,000 QR tumbaría el servidor.
 */
export async function getLotSheetsData(
  filters: {
    ids?: string[];
    materialId?: string;
    locationId?: string;
    clientId?: string;
    receiptId?: string;
  } = {},
): Promise<LotSheetData[]> {
  const lots = await prisma.lot.findMany({
    where: {
      ...(filters.ids?.length ? { id: { in: filters.ids } } : {}),
      ...(filters.materialId ? { materialId: filters.materialId } : {}),
      ...(filters.locationId ? { locationId: filters.locationId } : {}),
      ...(filters.clientId ? { clientId: filters.clientId } : {}),
      ...(filters.receiptId ? { receiptId: filters.receiptId } : {}),
    },
    include: SHEET_INCLUDE,
    orderBy: { code: "asc" },
    take: 100,
  });

  return lots.map(toSheetData);
}
