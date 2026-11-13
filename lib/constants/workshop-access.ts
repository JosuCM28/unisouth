import type { Permission, Role } from "./roles";

/** Los roles que pertenecen a un taller externo. */
export const WORKSHOP_ROLES = [
  "WORKSHOP_ACATLAN",
  "WORKSHOP_SITEX",
  "WORKSHOP_BRODERIE",
  "WORKSHOP_ALLENDE",
] as const satisfies readonly Role[];

export type WorkshopRole = (typeof WORKSHOP_ROLES)[number];

/** Cómo ve el taller una entrega. */
export type WorkshopDeliveryState = "PENDING" | "RECEIVED" | "CANCELLED";

/** Las pestañas del tablero de un taller. */
export type WorkshopBoardTab = "pending" | "received" | "outputs";

/** Viene de la URL: lo que no se reconozca abre lo que falta por recibir. */
export function parseWorkshopBoardTab(
  value: string | undefined,
): WorkshopBoardTab {
  if (value === "recibidas") return "received";
  if (value === "salidas") return "outputs";
  return "pending";
}

/** Los cuatro tableros, como van en la URL. */
export type WorkshopBoardKey = "acatlan" | "sitex" | "broderie" | "allende";

/**
 * De qué taller es cada tablero y qué llave lo abre.
 *
 * El reporte se pide con la clave del tablero en la URL, pero el taller sale
 * de AQUÍ y no de un id del navegador: la clave sólo elige una de cuatro
 * entradas fijas, y cada una exige su propia llave.
 */
export const WORKSHOP_BOARDS: Record<
  WorkshopBoardKey,
  { role: WorkshopRole; permission: Permission }
> = {
  acatlan: { role: "WORKSHOP_ACATLAN", permission: "workshop-board:acatlan" },
  sitex: { role: "WORKSHOP_SITEX", permission: "workshop-board:sitex" },
  broderie: { role: "WORKSHOP_BRODERIE", permission: "workshop-board:broderie" },
  allende: { role: "WORKSHOP_ALLENDE", permission: "workshop-board:allende" },
};

/** Un Map y no el objeto: `?board=constructor` no debe encontrar nada. */
const BOARD_KEYS = new Map<string, WorkshopBoardKey>(
  (Object.keys(WORKSHOP_BOARDS) as WorkshopBoardKey[]).map((key) => [key, key]),
);

export function parseWorkshopBoardKey(
  value: string | undefined,
): WorkshopBoardKey | null {
  return (value && BOARD_KEYS.get(value)) || null;
}

/** De dónde vino la entrega: un envío a taller o un vale de salida. */
export type DeliveryKind = "shipment" | "voucher";

/**
 * En qué va una entrega, más fino que el estado del taller: "por recibir"
 * se parte en lo que ya salió de la planta y lo que todavía no.
 */
export type DeliveryProgress =
  | "RECEIVED"
  | "IN_TRANSIT"
  | "IN_PLANT"
  | "CANCELLED";

export const DELIVERY_PROGRESS_ORDER: DeliveryProgress[] = [
  "RECEIVED",
  "IN_TRANSIT",
  "IN_PLANT",
  "CANCELLED",
];

/** Cuántos días tardó (o lleva) una entrega, en tramos. */
export type DeliveryAge = "UP_TO_1" | "UP_TO_3" | "UP_TO_7" | "OVER_7";

export const DELIVERY_AGE_ORDER: DeliveryAge[] = [
  "UP_TO_1",
  "UP_TO_3",
  "UP_TO_7",
  "OVER_7",
];

/**
 * La clave del tablero de cada rol de taller, para armar su URL. Un Record y
 * no una búsqueda en `WORKSHOP_BOARDS`: si mañana se agrega un taller, esto
 * no compila hasta que alguien le ponga su tablero.
 */
export const BOARD_KEY_BY_ROLE: Record<WorkshopRole, WorkshopBoardKey> = {
  WORKSHOP_ACATLAN: "acatlan",
  WORKSHOP_SITEX: "sitex",
  WORKSHOP_BRODERIE: "broderie",
  WORKSHOP_ALLENDE: "allende",
};
