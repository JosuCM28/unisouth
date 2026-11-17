import type { WorkshopOutputRow } from "@/lib/repositories/workshop-output.repository";
import type { WorkshopDeliveryRow } from "./workshop-delivery.service";

/**
 * Por dónde anduvo una orden en bordado y serigrafía, para la ficha que abre
 * un taller de CONFECCIÓN: qué parte se mandó a qué taller de proceso y a
 * dónde la sacó ese taller. Sólo informa; nadie lo confirma desde ahí.
 */
export interface ProcessTrail {
  sent: ProcessSent[];
  outputs: ProcessOutput[];
}

/** Lo que la planta mandó a un taller de proceso. */
export interface ProcessSent {
  code: string;
  workshop: string;
  date: Date;
  parts: string | null;
  pieces: number;
  /** Las canceladas no llegan aquí: no dicen dónde está nada. */
  state: "PENDING" | "RECEIVED";
}

/** Lo que un taller de proceso sacó de esa orden y a dónde. */
export interface ProcessOutput {
  code: string;
  fromWorkshop: string;
  /** `null` = regresó a la planta. */
  toWorkshop: string | null;
  date: Date;
  parts: string | null;
  pieces: number;
}

export function toProcessSent(row: WorkshopDeliveryRow, workshop: string): ProcessSent | null {
  if (row.state === "CANCELLED") return null;
  return {
    code: row.code,
    workshop,
    date: row.sentAt,
    parts: row.parts,
    pieces: row.pieces,
    state: row.state,
  };
}

export function toProcessOutput(output: WorkshopOutputRow): ProcessOutput {
  return {
    code: output.code,
    fromWorkshop: output.workshop.name,
    toWorkshop: output.destinationWorkshop?.name ?? null,
    date: output.date,
    parts: output.parts,
    // Lo que va en camino son las buenas: la merma se quedó en el taller.
    pieces: output.lines.reduce((sum, line) => sum + line.quantity, 0),
  };
}
