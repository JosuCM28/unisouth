import { Package, Palette } from "lucide-react";
import type { Unit } from "@prisma/client";
import { UNIT_SHORT_LABELS } from "@/lib/constants/labels";
import { formatQuantity } from "@/lib/utils";
import type { ReceiptLotRow } from "./receipt-lots";

interface MaterialRow {
  key: string;
  name: string;
  code: string;
  unit: Unit;
  quantity: number;
  lots: number;
  shades: ShadeRow[];
}

interface ShadeRow {
  /** `null` = rollos capturados sin tono. */
  shade: string | null;
  quantity: number;
  lots: number;
}

/**
 * Cuánto llegó de cada tela en ESTA guía.
 *
 * La ficha listaba los rollos uno por uno y nada más. Con una guía de dos
 * telas y cuarenta rollos, saber cuánto fue de cada una obligaba a sumar a
 * mano en la pantalla —que es justo lo que se hace con la factura enfrente,
 * y donde una suma mal hecha se paga—.
 *
 * Se agrupa por tela Y unidad: la misma tela capturada en metros y en kilos
 * son dos renglones, porque sumarlos daría un número que no significa nada.
 *
 * Se calcula de los rollos que la página ya tiene en memoria, sin volver a
 * preguntarle nada a la base.
 */
export function ReceiptMaterialTotals({ lots }: { lots: ReceiptLotRow[] }) {
  if (lots.length === 0) return null;

  const rows = groupByMaterial(lots);
  const totalLots = rows.reduce((sum, row) => sum + row.lots, 0);

  return (
    <section className="flat-surface p-4">
      <div className="mb-3 flex items-baseline justify-between gap-2">
        <h2 className="flex items-center gap-1.5 text-sm font-semibold uppercase tracking-wide">
          <Package className="size-4" aria-hidden />
          Qué llegó
        </h2>
        <span className="tabular text-xs text-muted-foreground">
          {totalLots} {totalLots === 1 ? "rollo" : "rollos"}
        </span>
      </div>

      <ul className="divide-y divide-border">
        {rows.map((row) => (
          <li key={row.key} className="py-2">
            <div className="flex items-baseline justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{row.name}</p>
                <p className="tabular text-xs text-muted-foreground">
                  {row.code} · {row.lots} {row.lots === 1 ? "rollo" : "rollos"}
                </p>
              </div>

              {/* Grande: es la cifra que se compara con la factura, de pie y
                  con el papel en la otra mano. */}
              <span className="tabular shrink-0 text-lg font-semibold">
                {formatQuantity(row.quantity, {
                  unit: UNIT_SHORT_LABELS[row.unit],
                })}
              </span>
            </div>

            <ShadeBreakdown shades={row.shades} unit={row.unit} />
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * Se suma `initialQuantity` y no `currentQuantity` porque la pregunta es qué
 * ENTRÓ con esta guía. El saldo de hoy ya bajó por los cortes, y usarlo haría
 * ver una recepción vieja como si hubiera traído menos tela de la que de
 * verdad se bajó del camión.
 */
function groupByMaterial(lots: ReceiptLotRow[]): MaterialRow[] {
  const grouped = new Map<string, MaterialRow>();

  for (const lot of lots) {
    const key = `${lot.material.code}:${lot.unit}`;
    const existing = grouped.get(key);

    const row =
      existing ??
      {
        key,
        name: lot.material.name,
        code: lot.material.code,
        unit: lot.unit,
        quantity: 0,
        lots: 0,
        shades: [],
      };

    row.quantity = round4(row.quantity + lot.initialQuantity);
    row.lots += 1;
    addToShade(row.shades, lot);
    grouped.set(key, row);
  }

  // De mayor a menor: la tela de la que más llegó es la que da nombre a la
  // guía y la primera que se revisa. Los tonos, igual.
  const rows = [...grouped.values()].sort((a, b) => b.quantity - a.quantity);
  for (const row of rows) row.shades.sort((a, b) => b.quantity - a.quantity);

  return rows;
}

function addToShade(shades: ShadeRow[], lot: ReceiptLotRow): void {
  const shade = lot.shade ?? null;
  const existing = shades.find((entry) => entry.shade === shade);

  if (existing) {
    existing.quantity = round4(existing.quantity + lot.initialQuantity);
    existing.lots += 1;
    return;
  }

  shades.push({ shade, quantity: lot.initialQuantity, lots: 1 });
}

/**
 * Cuánto llegó de cada tono de ESA tela.
 *
 * Una misma tela llega en varias partidas de tintura, y dos tonos en un
 * tendido son prenda rechazada: saber cuántos rollos y metros vinieron de
 * cada uno es lo que dice qué pedido se puede cortar de un solo tono.
 *
 * Si ningún rollo trae tono no se pinta: un único renglón "Sin tono" que
 * repite el total de arriba sólo estorba.
 */
function ShadeBreakdown({ shades, unit }: { shades: ShadeRow[]; unit: Unit }) {
  if (shades.every((entry) => entry.shade === null)) return null;

  return (
    <ul className="mt-2 flex flex-col border-l-2 border-border pl-3">
      {shades.map((entry) => (
        <li
          key={entry.shade ?? ""}
          className="flex items-baseline justify-between gap-3 py-0.5 text-sm"
        >
          <span className="flex min-w-0 items-center gap-1.5">
            <Palette
              className="size-3 shrink-0 text-muted-foreground"
              aria-hidden
            />
            <span className="tabular truncate">
              {entry.shade ?? "Sin tono"}
            </span>
          </span>
          <span className="tabular shrink-0 text-right">
            {formatQuantity(entry.quantity, { unit: UNIT_SHORT_LABELS[unit] })}
            <span className="text-muted-foreground">
              {" "}
              · {entry.lots} {entry.lots === 1 ? "rollo" : "rollos"}
            </span>
          </span>
        </li>
      ))}
    </ul>
  );
}

/** Los mismos 4 decimales que guarda la base: sumar en coma flotante deja cola. */
function round4(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}
