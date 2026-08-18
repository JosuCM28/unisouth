"use client";

import { Plus, Trash2 } from "lucide-react";
import type { CutTag } from "@prisma/client";
import { CUT_TAG_COLORS, CUT_TAG_LABELS } from "@/lib/constants/labels";
import { cn } from "@/lib/utils";
import { SearchSelect } from "@/components/shared/search-select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export interface SizeOption {
  id: string;
  code: string;
  name: string;
  group: string | null;
}

/** Un renglón de la tabla de corte, a medio teclear. */
export interface CutLineDraft {
  /** Identidad local del renglón: los renglones nuevos aún no tienen id real. */
  key: string;
  sizeId: string;
  /** Texto, no número: el input vive a medio teclear. */
  quantity: string;
  bundles: string;
  tag: CutTag | "";
  notes: string;
}

interface Props {
  sizes: SizeOption[];
  lines: CutLineDraft[];
  onChange: (lines: CutLineDraft[]) => void;
}

const TAG_OPTIONS = (Object.keys(CUT_TAG_LABELS) as CutTag[]).map((tag) => ({
  value: tag,
  label: CUT_TAG_LABELS[tag],
}));

/**
 * La tabla de corte: cuántas prendas de cada talla salen y en cuántos bultos.
 *
 * Reproduce la hoja de papel que hoy se llena a mano en el taller —talla,
 * cantidad a cortar, bultos y el color del foleo—, porque es el documento con
 * el que la gente ya sabe trabajar. Cambiarles el formato sería cambiarles el
 * proceso, y volverían a la libreta.
 *
 * NO mueve inventario: eso lo hacen los rollos del vale. Aquí sólo se declara
 * qué se va a cortar con esa tela.
 */
export function IssueCutTable({ sizes, lines, onChange }: Props) {
  function addLine() {
    onChange([
      ...lines,
      {
        key: crypto.randomUUID(),
        sizeId: "",
        quantity: "",
        bundles: "1",
        tag: "",
        notes: "",
      },
    ]);
  }

  function updateLine(key: string, patch: Partial<CutLineDraft>) {
    onChange(
      lines.map((line) => (line.key === key ? { ...line, ...patch } : line)),
    );
  }

  function removeLine(key: string) {
    onChange(lines.filter((line) => line.key !== key));
  }

  // Las tallas ya usadas no se vuelven a ofrecer: dos renglones de la misma
  // talla en la misma salida son un error de captura, no un caso real.
  function optionsFor(currentSizeId: string) {
    const used = new Set(
      lines.map((line) => line.sizeId).filter((id) => id !== currentSizeId),
    );

    return sizes
      .filter((size) => !used.has(size.id))
      .map((size) => ({
        value: size.id,
        label: size.code,
        hint: size.name,
        keywords: size.group ?? undefined,
      }));
  }

  /* La cantidad es POR BULTO: 64 en 2 bultos son 128 prendas. Sumar la
     cantidad sin multiplicar dejaría el total en la mitad de lo que sale. */
  const totals = lines.reduce(
    (acc, line) => {
      const quantity = Number(line.quantity) || 0;
      const bundles = Number(line.bundles) || 0;

      return {
        perBundle: acc.perBundle + quantity,
        bundles: acc.bundles + bundles,
        pieces: acc.pieces + quantity * bundles,
      };
    },
    { perBundle: 0, bundles: 0, pieces: 0 },
  );

  return (
    <div className="flex flex-col gap-3">
      {lines.length === 0 && (
        <p className="text-sm text-muted-foreground">
          Sin desglose de corte. Agrégalo si esta salida va al taller.
        </p>
      )}

      {/* Celular: una tarjeta por talla. Una tabla de 5 columnas en 375px
          obliga a barrer de lado con el teléfono en una mano. */}
      <ul className="flex flex-col gap-3 md:hidden">
        {lines.map((line) => (
          <li key={line.key} className="flat-surface flex flex-col gap-2 p-3">
            <div className="flex items-center gap-2">
              <div className="min-w-0 flex-1">
                <SearchSelect
                  options={optionsFor(line.sizeId)}
                  value={line.sizeId}
                  onChange={(value) => updateLine(line.key, { sizeId: value })}
                  placeholder="Talla"
                  searchPlaceholder="Buscar talla…"
                />
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="touch-target shrink-0"
                onClick={() => removeLine(line.key)}
                aria-label="Quitar talla"
              >
                <Trash2 className="size-4" aria-hidden />
              </Button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <NumberInput
                label="Cantidad a cortar"
                value={line.quantity}
                onChange={(value) => updateLine(line.key, { quantity: value })}
              />
              <NumberInput
                label="Bultos"
                value={line.bundles}
                onChange={(value) => updateLine(line.key, { bundles: value })}
              />
            </div>

            <TagPicker
              value={line.tag}
              onChange={(tag) => updateLine(line.key, { tag })}
            />

            <Input
              value={line.notes}
              onChange={(event) =>
                updateLine(line.key, { notes: event.target.value })
              }
              placeholder="Anotaciones"
              className="touch-target"
            />
          </li>
        ))}
      </ul>

      {/* Desde md: la tabla, igual que la hoja de papel. */}
      {lines.length > 0 && (
        <div className="hidden md:block">
          <div className="flat-surface overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-border text-left">
                  <Th>Talla</Th>
                  <Th className="w-32">Cantidad a cortar</Th>
                  <Th className="w-24">Bultos</Th>
                  <Th className="w-24">Total</Th>
                  <Th className="w-40">Foleo</Th>
                  <Th>Anotaciones</Th>
                  <Th className="w-12" />
                </tr>
              </thead>
              <tbody>
                {lines.map((line) => (
                  <tr key={line.key} className="border-b border-border">
                    <td className="p-2">
                      <SearchSelect
                        options={optionsFor(line.sizeId)}
                        value={line.sizeId}
                        onChange={(value) =>
                          updateLine(line.key, { sizeId: value })
                        }
                        placeholder="Talla"
                        searchPlaceholder="Buscar talla…"
                      />
                    </td>
                    <td className="p-2">
                      <Input
                        inputMode="numeric"
                        value={line.quantity}
                        onChange={(event) =>
                          updateLine(line.key, { quantity: event.target.value })
                        }
                        className="tabular touch-target text-right"
                      />
                    </td>
                    <td className="p-2">
                      <Input
                        inputMode="numeric"
                        value={line.bundles}
                        onChange={(event) =>
                          updateLine(line.key, { bundles: event.target.value })
                        }
                        className="tabular touch-target text-right"
                      />
                    </td>
                    {/* Calculado, no capturable: es cantidad × bultos y
                        dejarlo editar permitiría que no cuadre con la hoja. */}
                    <td className="tabular p-2 text-right font-medium">
                      {(Number(line.quantity) || 0) *
                        (Number(line.bundles) || 0)}
                    </td>
                    <td className="p-2">
                      <TagPicker
                        value={line.tag}
                        onChange={(tag) => updateLine(line.key, { tag })}
                      />
                    </td>
                    <td className="p-2">
                      <Input
                        value={line.notes}
                        onChange={(event) =>
                          updateLine(line.key, { notes: event.target.value })
                        }
                        placeholder="—"
                        className="touch-target"
                      />
                    </td>
                    <td className="p-2">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="touch-target"
                        onClick={() => removeLine(line.key)}
                        aria-label="Quitar talla"
                      >
                        <Trash2 className="size-4" aria-hidden />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="font-medium">
                  <td className="p-2">Total</td>
                  <td className="tabular p-2 text-right">{totals.perBundle}</td>
                  <td className="tabular p-2 text-right">{totals.bundles}</td>
                  {/* El total de cortes que se entregan. */}
                  <td className="tabular p-2 text-right text-base font-bold">
                    {totals.pieces}
                  </td>
                  <td colSpan={3} />
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between gap-2">
        <Button
          type="button"
          variant="outline"
          className="touch-target"
          onClick={addLine}
        >
          <Plus className="size-4" aria-hidden />
          Agregar talla
        </Button>

        {lines.length > 0 && (
          <p className="tabular text-sm text-muted-foreground md:hidden">
            {totals.pieces} cortes · {totals.bundles} bultos
          </p>
        )}
      </div>
    </div>
  );
}

/**
 * Selector de foleo que se pinta del color elegido.
 *
 * El color va como estilo en línea y no como clase de Tailwind: son colores
 * físicos del papel, no tokens del tema, y deben verse igual en pantalla
 * clara, oscura y en la hoja impresa.
 */
function TagPicker({
  value,
  onChange,
}: {
  value: CutTag | "";
  onChange: (tag: CutTag | "") => void;
}) {
  const colors = value ? CUT_TAG_COLORS[value] : null;

  return (
    <div className="flex items-center gap-2">
      <div className="min-w-0 flex-1">
        <SearchSelect
          options={TAG_OPTIONS}
          value={value}
          onChange={(next) => onChange(next as CutTag | "")}
          placeholder="Foleo"
          searchPlaceholder="Buscar color…"
          clearLabel="Sin foleo"
        />
      </div>
      {colors && (
        <span
          className="size-6 shrink-0 border border-border"
          style={{ backgroundColor: colors.background }}
          aria-hidden
        />
      )}
    </div>
  );
}

function NumberInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      <Input
        inputMode="numeric"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="tabular touch-target text-right"
      />
    </label>
  );
}

function Th({
  children,
  className,
}: {
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <th
      className={cn(
        "p-2 text-xs font-medium uppercase tracking-wide text-muted-foreground",
        className,
      )}
    >
      {children}
    </th>
  );
}
