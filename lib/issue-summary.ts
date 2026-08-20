import type { Unit } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/** Lo que identifica una salida sin abrirla. */
export interface IssueSummary {
  /** Metraje que se llevó, sumando sus renglones. */
  totalQuantity: number;
  unit: Unit | null;
  /** Telas de los rollos que salieron. */
  materialNames: string[];
  /** Rollos del vale. */
  lots: number;
  /** Prendas del desglose de corte, si lo trae. */
  cutPieces: number;
}

/**
 * Resume varias salidas de una vez.
 *
 * Va en consultas agrupadas sobre la página completa y no una por vale:
 * con 50 filas serían 150 viajes a Neon y la lista tardaría segundos en
 * pintar desde el celular.
 *
 * Existe aparte del repositorio de documentos porque responde una pregunta
 * de PRESENTACIÓN —qué poner en la tarjeta— y no de dominio. El vale sigue
 * siendo la fuente de verdad; esto sólo lo resume para poder reconocerlo.
 */
export async function getIssueSummaries(
  documentIds: string[],
): Promise<Map<string, IssueSummary>> {
  const summaries = new Map<string, IssueSummary>();
  if (documentIds.length === 0) return summaries;

  const [lines, cuts] = await Promise.all([
    prisma.documentLine.findMany({
      where: { documentId: { in: documentIds } },
      select: {
        documentId: true,
        quantity: true,
        unit: true,
        lot: { select: { material: { select: { name: true } } } },
      },
    }),
    prisma.documentCutLine.findMany({
      where: { documentId: { in: documentIds } },
      select: { documentId: true, quantity: true },
    }),
  ]);

  for (const line of lines) {
    const current =
      summaries.get(line.documentId) ?? emptySummary();

    current.totalQuantity += Number(line.quantity);
    current.lots += 1;
    // La unidad del primer renglón: un vale no mezcla metros con piezas, y
    // si lo hiciera el total dejaría de ser un número que se pueda sumar.
    current.unit = current.unit ?? line.unit;

    const name = line.lot.material.name;
    if (!current.materialNames.includes(name)) {
      current.materialNames.push(name);
    }

    summaries.set(line.documentId, current);
  }

  for (const cut of cuts) {
    const current = summaries.get(cut.documentId) ?? emptySummary();
    current.cutPieces += Number(cut.quantity);
    summaries.set(cut.documentId, current);
  }

  return summaries;
}

function emptySummary(): IssueSummary {
  return {
    totalQuantity: 0,
    unit: null,
    materialNames: [],
    lots: 0,
    cutPieces: 0,
  };
}
