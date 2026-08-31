import type {
  GarmentShipmentStatus,
  AuditAction,
  CutTag,
  CutVersion,
  CuttingOrderStatus,
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
  Sensitivity,
  StandingRuleTopic,
  TaskStatus,
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

/**
 * Unidades que de verdad se teclean al recibir tela, en orden de uso.
 *
 * La tela llega en metros, pero muy seguido el proveedor sólo pesa el rollo
 * y la nota viene en kilos. Antes había que dar de alta el material otra vez
 * para poder capturarlo; ahora se elige la unidad en el renglón, y estas
 * cuatro van primero porque son el 99% de las cargas. El resto del catálogo
 * sigue disponible más abajo en el selector.
 */
export const COMMON_RECEIPT_UNITS: Unit[] = [
  "METER",
  "KILOGRAM",
  "YARD",
  "PIECE",
];

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

/**
 * Unidades partidas en dos: las de diario arriba, el resto abajo.
 *
 * Se ordena por USO y no alfabéticamente. Con el catálogo completo ordenado
 * por nombre, "Kilogramo" cae entre "Gruesa" y "Litro" y hay que buscarlo
 * con el pulgar; siendo la segunda unidad más tecleada de la bodega, tiene
 * que estar a la vista sin desplazar.
 *
 * La etiqueta lleva la abreviatura porque es lo que el auxiliar coteja
 * contra la nota del proveedor: "Kilogramo (kg)".
 */
export function unitSelectGroups(): {
  common: SelectOption[];
  rest: SelectOption[];
} {
  const withShort = (unit: Unit): SelectOption => ({
    value: unit,
    label: `${UNIT_LABELS[unit]} (${UNIT_SHORT_LABELS[unit]})`,
  });

  const common = COMMON_RECEIPT_UNITS.map(withShort);

  const rest = (Object.keys(UNIT_LABELS) as Unit[])
    .filter((unit) => !COMMON_RECEIPT_UNITS.includes(unit))
    .map(withShort)
    .sort((a, b) => a.label.localeCompare(b.label, "es-MX"));

  return { common, rest };
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

/**
 * FOLEO: el color del papelito que se engrapa al bulto.
 *
 * En el piso los bultos se distinguen por ese color a un metro de distancia,
 * así que en pantalla y en papel tiene que verse el color REAL —azul es azul—,
 * no un color del tema. Por eso estos valores son hex fijos y no tokens: un
 * ámbar del sistema no es el amarillo del papelito.
 */
export const CUT_TAG_LABELS: Record<CutTag, string> = {
  BLUE: "Azul",
  GREEN: "Verde",
  ORANGE: "Naranja",
  YELLOW: "Amarillo",
  RED: "Rojo",
  PURPLE: "Morado",
  PINK: "Rosa",
  BROWN: "Café",
  BLACK: "Negro",
  WHITE: "Blanco",
};

/** Fondo y texto de cada foleo. El texto se elige por contraste, no por gusto. */
export const CUT_TAG_COLORS: Record<CutTag, { background: string; text: string }> = {
  BLUE: { background: "#1d4ed8", text: "#ffffff" },
  GREEN: { background: "#15803d", text: "#ffffff" },
  ORANGE: { background: "#ea580c", text: "#ffffff" },
  YELLOW: { background: "#facc15", text: "#1c1917" },
  RED: { background: "#b91c1c", text: "#ffffff" },
  PURPLE: { background: "#7e22ce", text: "#ffffff" },
  PINK: { background: "#ec4899", text: "#ffffff" },
  BROWN: { background: "#78350f", text: "#ffffff" },
  BLACK: { background: "#1c1917", text: "#ffffff" },
  WHITE: { background: "#ffffff", text: "#1c1917" },
};

export const CUTTING_ORDER_STATUS_LABELS: Record<CuttingOrderStatus, string> = {
  OPEN: "Abierta",
  IN_PROGRESS: "En corte",
  COMPLETED: "Terminada",
  CANCELLED: "Cancelada",
};

export const CUTTING_ORDER_STATUS_STYLES: Record<CuttingOrderStatus, string> = {
  OPEN: "bg-state-reserved text-state-reserved-foreground",
  IN_PROGRESS: "bg-state-remnant text-state-remnant-foreground",
  COMPLETED: "bg-state-available text-state-available-foreground",
  CANCELLED: "bg-muted text-muted-foreground border border-border line-through",
};

/**
 * La versión del molde con la que se corta.
 *
 * "Único" no es ausencia de versión: es la declaración de que ese molde no
 * tiene variantes, y en la hoja impresa se lee distinto a dejar el renglón en
 * blanco por olvido.
 */
export const CUT_VERSION_LABELS: Record<CutVersion, string> = {
  UNIQUE: "Único",
  V1: "Versión 1",
  V2: "Versión 2",
  V3: "Versión 3",
  V4: "Versión 4",
  V5: "Versión 5",
};

/** Las tres columnas del tablero de tareas. */
export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  PENDING: "Pendientes",
  IN_PROGRESS: "En curso",
  DONE: "Listas",
};

/**
 * De qué parte del trabajo habla una regla fija.
 *
 * Son los pasos por los que pasa la prenda, en ese orden: primero se corta,
 * luego se cose, se revisa, se empaca y se entrega. "Material" queda aparte
 * porque no es un paso sino una condición de la tela, y "General" recoge lo
 * que aplica a todo el trato con esa empresa.
 */
export const STANDING_RULE_TOPIC_LABELS: Record<StandingRuleTopic, string> = {
  CUTTING: "Corte",
  SEWING: "Costura",
  QUALITY: "Calidad",
  PACKAGING: "Empaque",
  DELIVERY: "Entrega",
  MATERIAL: "Material",
  GENERAL: "General",
};

/**
 * El orden en que se presentan los temas.
 *
 * Sigue el recorrido de la prenda por el taller, no el alfabeto: quien lee
 * las reglas de un cliente las lee en el orden en que va a necesitarlas.
 */
export const STANDING_RULE_TOPIC_ORDER: StandingRuleTopic[] = [
  "CUTTING",
  "SEWING",
  "QUALITY",
  "MATERIAL",
  "PACKAGING",
  "DELIVERY",
  "GENERAL",
];

/**
 * Qué hizo la persona, en el idioma en que se lee la bitácora.
 *
 * Vivían dentro de `audit-list.tsx`, pero el Excel de auditoría necesita las
 * mismas palabras: con dos copias, un día la pantalla diría "Dio de baja" y el
 * archivo "DELETE", y quien compara los dos no sabría si son lo mismo.
 */
export const AUDIT_ACTION_LABELS: Record<AuditAction, string> = {
  CREATE: "Creó",
  UPDATE: "Modificó",
  DELETE: "Dio de baja",
  APPLY: "Aplicó",
  CANCEL: "Canceló",
  RECALCULATE: "Recalculó",
  APPROVE: "Autorizó",
  PRINT: "Imprimió",
  EXPORT: "Exportó",
  LOGIN: "Entró",
  LOGIN_FAILED: "Intento fallido",
  LOGOUT: "Salió",
};

export const SENSITIVITY_LABELS: Record<Sensitivity, string> = {
  LOW: "Baja",
  MEDIUM: "Media",
  HIGH: "Alta",
  CRITICAL: "Crítica",
};

/**
 * Dónde anda un envío a taller.
 *
 * "Enviado" y no "en el taller": lo normal es que el taller borde los paneles
 * y los mande a donde siguen, así que el envío se queda ahí para siempre y eso
 * es correcto. Los otros tres estados sólo aparecen si alguien captura un
 * retorno, que es la excepción.
 */
export const GARMENT_SHIPMENT_STATUS_LABELS: Record<GarmentShipmentStatus, string> = {
  SENT: "Enviado",
  PARTIAL: "Regresó a medias",
  CLOSED: "Cerrado",
  CANCELLED: "Cancelado",
};

export const GARMENT_SHIPMENT_STATUS_STYLES: Record<GarmentShipmentStatus, string> = {
  SENT: "bg-state-reserved text-state-reserved-foreground",
  PARTIAL: "bg-state-remnant-muted text-state-remnant",
  CLOSED: "bg-state-available text-state-available-foreground",
  CANCELLED: "bg-state-defective text-state-defective-foreground",
};
