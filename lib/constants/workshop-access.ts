import type { Role } from "./roles";

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
export type WorkshopBoardTab = "pending" | "received";

/** Viene de la URL: lo que no se reconozca abre lo que falta por recibir. */
export function parseWorkshopBoardTab(
  value: string | undefined,
): WorkshopBoardTab {
  return value === "recibidas" ? "received" : "pending";
}
