import { formatQuantity } from "@/lib/utils";

interface SpecSource {
  weightOz?: number | string | { toNumber: () => number } | null;
  thicknessMm?: number | string | { toNumber: () => number } | null;
  gsm?: number | string | { toNumber: () => number } | null;
}

/**
 * Cómo se especifica el grosor de esta tela.
 *
 * Las dos unidades conviven en el modelo a propósito: la tela plana y la
 * técnica se piden en milímetros, y la MEZCLILLA en onzas por yarda cuadrada
 * (10 oz, 12 oz, 14 oz). No es que una sustituya a la otra: son vocabularios
 * distintos según el tipo de tela.
 *
 * Se resuelve con salidas tempranas y no con ternarias encadenadas en el JSX,
 * porque son tres casos con prioridad y una ternaria anidada los volvería
 * ilegibles.
 */
export function formatFabricSpec(material: SpecSource): string | null {
  const oz = toNumberOrNull(material.weightOz);
  if (oz !== null) return `${formatQuantity(oz)} oz`;

  const mm = toNumberOrNull(material.thicknessMm);
  if (mm !== null) return `${formatQuantity(mm)} mm`;

  const gsm = toNumberOrNull(material.gsm);
  if (gsm !== null) return `${formatQuantity(gsm)} g/m²`;

  return null;
}

function toNumberOrNull(
  value: number | string | { toNumber: () => number } | null | undefined,
): number | null {
  if (value === null || value === undefined || value === "") return null;

  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return value.toNumber();
}
