import type { Role } from "./roles";

/** Los roles que pertenecen a un taller externo. */
export const WORKSHOP_ROLES = [
  "WORKSHOP_ACATLAN",
  "WORKSHOP_SITEX",
  "WORKSHOP_BRODERIE",
] as const satisfies readonly Role[];

export type WorkshopRole = (typeof WORKSHOP_ROLES)[number];

/** Cómo ve el taller una entrega. */
export type WorkshopDeliveryState = "PENDING" | "RECEIVED" | "CANCELLED";
