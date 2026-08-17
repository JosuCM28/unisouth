import type {
  DocumentStatus,
  DocumentType,
  LocationType,
  LotStatus,
  MaterialType,
  MeasurementSource,
  MovementDirection,
  MovementType,
  ProductionRunStatus,
  PurchaseRequestStatus,
  Unit,
} from "@prisma/client";

/**
 * Traducciones de los enums.
 *
 * Todos viven aquí y en ningún otro lado: traducir inline en un componente
 * garantiza que la misma etiqueta acabe escrita de tres formas distintas.
 */

export const MATERIAL_TYPE_LABELS: Record<MaterialType, string> = {
  FABRIC: "Tela",
  ZIPPER: "Cierre",
  BUTTON: "Botón",
  THREAD: "Hilo",
  ELASTIC: "Elástico",
  LABEL: "Etiqueta",
  SNAP: "Broche",
  TAPE: "Cinta",
  DRAWSTRING: "Cordón",
  INTERLINING: "Entretela",
  PACKAGING: "Empaque",
  OTHER: "Otro",
};

export const UNIT_LABELS: Record<Unit, string> = {
  METER: "Metro",
  SQUARE_METER: "Metro cuadrado",
  YARD: "Yarda",
  KILOGRAM: "Kilogramo",
  GRAM: "Gramo",
  PIECE: "Pieza",
  PAIR: "Par",
  CONE: "Cono",
  ROLL: "Rollo",
  BOX: "Caja",
  PACK: "Paquete",
  GROSS: "Gruesa",
  THOUSAND: "Millar",
  LITER: "Litro",
};

/**
 * Abreviaturas para junto a la cantidad.
 *
 * En la tarjeta del celular no cabe "1,250 Metros": se lee "1,250 m".
 */
export const UNIT_SHORT_LABELS: Record<Unit, string> = {
  METER: "m",
  SQUARE_METER: "m²",
  YARD: "yd",
  KILOGRAM: "kg",
  GRAM: "g",
  PIECE: "pza",
  PAIR: "par",
  CONE: "cono",
  ROLL: "rollo",
  BOX: "caja",
  PACK: "paq",
  GROSS: "gruesa",
  THOUSAND: "millar",
  LITER: "L",
};

export const LOCATION_TYPE_LABELS: Record<LocationType, string> = {
  ROW: "Fila",
  RACK: "Rack",
  PALLET: "Tarima",
  FLOOR: "Piso",
  SHELF: "Estante",
  REMNANTS: "Retazos",
  QUARANTINE: "Cuarentena",
  TRANSIT: "En tránsito",
};

export const LOT_STATUS_LABELS: Record<LotStatus, string> = {
  AVAILABLE: "Disponible",
  RESERVED: "Reservado",
  IN_USE: "En uso",
  REMNANT: "Retazo",
  DEPLETED: "Agotado",
  QUARANTINE: "Cuarentena",
  DEFECTIVE: "Defectuoso",
  RETURNED: "Devuelto",
  WRITTEN_OFF: "Dado de baja",
};

/**
 * Estilos del estado del rollo: FONDO SÓLIDO, sin sombra ni degradado.
 *
 * El auxiliar identifica el estado por color a un metro de distancia y con
 * mala luz, así que el color pinta el fondo completo, no sólo el texto.
 * verde disponible · ámbar reservado · violeta retazo · rojo defectuoso
 */
export const LOT_STATUS_STYLES: Record<LotStatus, string> = {
  AVAILABLE: "bg-state-available text-state-available-foreground",
  RESERVED: "bg-state-reserved text-state-reserved-foreground",
  IN_USE: "bg-state-reserved-muted text-foreground border border-border",
  REMNANT: "bg-state-remnant text-state-remnant-foreground",
  DEPLETED: "bg-muted text-muted-foreground border border-border",
  QUARANTINE: "bg-state-defective-muted text-foreground border border-border",
  DEFECTIVE: "bg-state-defective text-state-defective-foreground",
  RETURNED: "bg-muted text-muted-foreground border border-border",
  WRITTEN_OFF: "bg-muted text-muted-foreground border border-border line-through",
};

/**
 * De dónde salió el metraje. Importa para saber cuánto confiar en el saldo:
 * lo que dice la etiqueta del proveedor no es lo mismo que lo medido a mano.
 */
export const MEASUREMENT_SOURCE_LABELS: Record<MeasurementSource, string> = {
  SUPPLIER_LABEL: "Etiqueta del proveedor",
  MEASURED: "Medido",
  ESTIMATED_WEIGHT: "Estimado por peso",
  ESTIMATED_VISUAL: "Estimado a ojo",
  PHYSICAL_COUNT: "Conteo físico",
};

export const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
  RECEIPT: "Entrada",
  ISSUE: "Salida",
  TRANSFER: "Traspaso",
  ADJUSTMENT: "Ajuste",
  PRODUCTION_RETURN: "Devolución de producción",
  SUPPLIER_RETURN: "Devolución a proveedor",
  WRITE_OFF: "Baja",
  COUNT: "Conteo",
};

export const DOCUMENT_STATUS_LABELS: Record<DocumentStatus, string> = {
  DRAFT: "Borrador",
  APPLIED: "Aplicado",
  CANCELLED: "Cancelado",
};

export const DOCUMENT_STATUS_STYLES: Record<DocumentStatus, string> = {
  DRAFT: "bg-muted text-muted-foreground border border-border",
  APPLIED: "bg-state-available text-state-available-foreground",
  CANCELLED: "bg-state-defective text-state-defective-foreground",
};

export const MOVEMENT_TYPE_LABELS: Record<MovementType, string> = {
  RECEIPT_PURCHASE: "Entrada por compra",
  RECEIPT_PRODUCTION_RETURN: "Devolución de producción",
  RECEIPT_ADJUSTMENT: "Ajuste positivo",
  RECEIPT_TRANSFER: "Entrada por traspaso",
  RECEIPT_INITIAL: "Alta inicial",
  ISSUE_PRODUCTION: "Salida a producción",
  ISSUE_SAMPLE: "Salida por muestra",
  ISSUE_SCRAP: "Salida por desperdicio",
  ISSUE_SUPPLIER_RETURN: "Devolución a proveedor",
  ISSUE_ADJUSTMENT: "Ajuste negativo",
  ISSUE_TRANSFER: "Salida por traspaso",
  ISSUE_WRITE_OFF: "Baja",
  RECLASSIFICATION: "Reclasificación",
  RECOUNT: "Reconteo",
};

export const MOVEMENT_DIRECTION_LABELS: Record<MovementDirection, string> = {
  IN: "Entrada",
  OUT: "Salida",
  NEUTRAL: "Sin efecto",
};

export const MOVEMENT_DIRECTION_STYLES: Record<MovementDirection, string> = {
  IN: "bg-state-available text-state-available-foreground",
  OUT: "bg-state-defective text-state-defective-foreground",
  NEUTRAL: "bg-muted text-muted-foreground border border-border",
};

export interface SelectOption {
  value: string;
  label: string;
}

/**
 * Convierte cualquier diccionario de etiquetas en opciones de <Select>,
 * ordenadas alfabéticamente por etiqueta para que el usuario las encuentre.
 */
export function toSelectOptions<K extends string>(
  labels: Record<K, string>,
): SelectOption[] {
  return (Object.entries(labels) as [K, string][])
    .map(([value, label]) => ({ value, label }))
    .sort((a, b) => a.label.localeCompare(b.label, "es-MX"));
}

export const PRODUCTION_RUN_STATUS_LABELS: Record<ProductionRunStatus, string> = {
  PLANNED: "Planeada",
  ACTIVE: "Activa",
  PAUSED: "Pausada",
  CLOSED: "Cerrada",
  CANCELLED: "Cancelada",
};

export const PRODUCTION_RUN_STATUS_STYLES: Record<ProductionRunStatus, string> = {
  PLANNED: "bg-muted text-muted-foreground border border-border",
  ACTIVE: "bg-state-available text-state-available-foreground",
  PAUSED: "bg-state-reserved text-state-reserved-foreground",
  CLOSED: "bg-muted text-muted-foreground border border-border",
  CANCELLED: "bg-state-defective text-state-defective-foreground",
};

export const PURCHASE_STATUS_LABELS: Record<PurchaseRequestStatus, string> = {
  DRAFT: "Borrador",
  SUBMITTED: "Enviada",
  APPROVED: "Autorizada",
  REJECTED: "Rechazada",
  ORDERED: "Pedida",
  PARTIALLY_RECEIVED: "Recibida parcial",
  RECEIVED: "Recibida",
  CANCELLED: "Cancelada",
};

export const PURCHASE_STATUS_STYLES: Record<PurchaseRequestStatus, string> = {
  DRAFT: "bg-muted text-muted-foreground border border-border",
  SUBMITTED: "bg-state-reserved text-state-reserved-foreground",
  APPROVED: "bg-state-available text-state-available-foreground",
  REJECTED: "bg-state-defective text-state-defective-foreground",
  ORDERED: "bg-state-remnant text-state-remnant-foreground",
  PARTIALLY_RECEIVED: "bg-state-reserved-muted text-foreground border border-border",
  RECEIVED: "bg-state-available text-state-available-foreground",
  CANCELLED: "bg-muted text-muted-foreground border border-border line-through",
};
